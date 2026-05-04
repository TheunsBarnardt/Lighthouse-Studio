/**
 * API-layer conformance tests — PostgreSQL adapter.
 *
 * Exercises ApiRequestHandler → PerWorkspaceRepositoryFactory → PostgresCustomerRepositoryProvider
 * against a live Postgres instance. All platform services (authz, audit, metrics, …) use
 * their in-memory stubs so only the persistence path is real.
 *
 * Connection: POSTGRES_URL or POSTGRES_DIRECT_URL environment variable.
 *
 *   POSTGRES_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres pnpm test
 *
 * Tests are skipped automatically when no URL is set.
 */

import type { CustomerSchema, SchemaService } from '@platform/core';

import { NoopMetrics } from '@platform/adapter-observability-memory';
import { ApiRequestHandler, PerWorkspaceRepositoryFactory } from '@platform/core';
import {
  createInMemoryAudit,
  createInMemoryAuthz,
  createInMemoryLogger,
  createInMemoryRateLimiter,
  createInMemoryRepo,
  createInMemoryTracer,
  makeUserContext,
} from '@platform/core/testing';
import { ok } from 'neverthrow';
import { Pool } from 'pg';
import { uuidv7 } from 'uuidv7';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PostgresCustomerRepositoryProvider } from '../src/customer-repository.adapter.js';
import { ARCHIVE_COL, VERSION_COL } from '../src/customer-repository.adapter.js';

// ── Env / skip guard ───────────────────────────────────────────────────────────

const POSTGRES_URL = process.env['POSTGRES_DIRECT_URL'] ?? process.env['POSTGRES_URL'];

const WS_SLUG = 'test_ws';
const SCHEMA_SLUG = 'myschema';
const TABLE_NAME = 'products';
const TABLE_ID = 'tbl_products';
const COL_ID = 'col_id';
const COL_NAME = 'col_name';
const COL_PRICE = 'col_price';
// Postgres SQL schema used as the customer namespace
const PG_NS = `cust_${WS_SLUG}`;

const FIXED_SCHEMA: CustomerSchema = {
  id: 'sch_test',
  workspaceId: 'ws_test',
  name: 'Test Schema',
  slug: SCHEMA_SLUG,
  version: 1,
  databaseDriver: 'postgres',
  tables: [
    {
      id: TABLE_ID,
      name: TABLE_NAME,
      columns: [
        { id: COL_ID, name: 'id', type: { kind: 'text' }, nullable: false },
        { id: COL_NAME, name: 'name', type: { kind: 'text' }, nullable: false },
        { id: COL_PRICE, name: 'price', type: { kind: 'integer' }, nullable: true },
      ],
      indexes: [],
      foreignKeys: [],
      constraints: [],
      primaryKey: { kind: 'single', columnId: COL_ID },
    },
  ],
  metadata: {
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    createdBy: 'test',
    updatedBy: 'test',
    lastDeployedAt: new Date('2025-01-01'),
    deployedVersion: 1,
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

let pool: Pool | undefined;

function makeHandler() {
  if (!pool) throw new Error('Pool not initialised');

  const provider = new PostgresCustomerRepositoryProvider(pool);
  const repos = new PerWorkspaceRepositoryFactory(provider, createInMemoryLogger());

  // Minimal SchemaService duck-type: only resolveDeployedSchema is called by ApiRequestHandler
  const schemas = {
    resolveDeployedSchema: (_ctx: unknown, _slug: string) => Promise.resolve(ok(FIXED_SCHEMA)),
  } as unknown as SchemaService;

  return new ApiRequestHandler(
    schemas,
    createInMemoryAuthz(),
    repos,
    createInMemoryAudit(),
    createInMemoryLogger(),
    createInMemoryRateLimiter(),
    new NoopMetrics(),
    createInMemoryRepo(),
    createInMemoryTracer(),
  );
}

function makeCtx() {
  return makeUserContext({ workspaceId: 'ws_test' });
}

async function clear() {
  await pool!.query(`DELETE FROM "${PG_NS}"."${TABLE_NAME}"`);
}

// ── Setup / teardown ───────────────────────────────────────────────────────────

beforeAll(async () => {
  if (!POSTGRES_URL) {
    process.stdout.write('Skipping Postgres API-handler conformance tests — no POSTGRES_URL set\n');
    return;
  }

  pool = new Pool({ connectionString: POSTGRES_URL, max: 3 });
  try {
    await pool.query(`CREATE SCHEMA IF NOT EXISTS "${PG_NS}"`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "${PG_NS}"."${TABLE_NAME}" (
        id                  TEXT        PRIMARY KEY,
        name                TEXT        NOT NULL,
        price               INTEGER,
        "${ARCHIVE_COL}"    TIMESTAMPTZ,
        "${VERSION_COL}"    INTEGER     NOT NULL DEFAULT 1
      )
    `);
  } catch (e) {
    process.stderr.write(`Postgres API-handler setup failed: ${String(e)}\n`);
    await pool.end();
    pool = undefined;
  }
});

afterAll(async () => {
  if (!pool) return;
  await pool.query(`DROP SCHEMA IF EXISTS "${PG_NS}" CASCADE`);
  await pool.end();
});

// ── Conformance tests ──────────────────────────────────────────────────────────

describe.skipIf(!POSTGRES_URL)('ApiRequestHandler — PostgreSQL conformance', () => {
  it('creates a row and retrieves it via GET', async () => {
    await clear();
    const handler = makeHandler();
    const ctx = makeCtx();
    const id = uuidv7();

    const createResult = await handler.handle({
      method: 'POST',
      params: { workspaceSlug: WS_SLUG, schemaSlug: SCHEMA_SLUG, table: TABLE_NAME },
      queryParams: {},
      body: { id, name: 'Widget', price: 42 },
      ctx,
      principal: null,
    });

    expect(createResult.isOk()).toBe(true);
    const created = createResult._unsafeUnwrap();
    expect(created.statusCode).toBe(201);

    const getResult = await handler.handle({
      method: 'GET',
      params: { workspaceSlug: WS_SLUG, schemaSlug: SCHEMA_SLUG, table: TABLE_NAME, id },
      queryParams: {},
      body: undefined,
      ctx,
      principal: null,
    });

    expect(getResult.isOk()).toBe(true);
    const row = getResult._unsafeUnwrap();
    expect(row.statusCode).toBe(200);
    expect((row.body as Record<string, unknown>)['data']).toMatchObject({
      id,
      name: 'Widget',
      price: 42,
    });
  });

  it('lists rows with pagination', async () => {
    await clear();
    const handler = makeHandler();
    const ctx = makeCtx();

    for (let i = 0; i < 5; i++) {
      await handler.handle({
        method: 'POST',
        params: { workspaceSlug: WS_SLUG, schemaSlug: SCHEMA_SLUG, table: TABLE_NAME },
        queryParams: {},
        body: { id: uuidv7(), name: `Item ${i}`, price: i * 10 },
        ctx,
        principal: null,
      });
    }

    const listResult = await handler.handle({
      method: 'GET',
      params: { workspaceSlug: WS_SLUG, schemaSlug: SCHEMA_SLUG, table: TABLE_NAME },
      queryParams: { limit: '3' },
      body: undefined,
      ctx,
      principal: null,
    });

    expect(listResult.isOk()).toBe(true);
    const list = listResult._unsafeUnwrap();
    expect(list.statusCode).toBe(200);
    const body = list.body as Record<string, unknown>;
    expect(Array.isArray(body['data'])).toBe(true);
    expect((body['data'] as unknown[]).length).toBeLessThanOrEqual(3);
  });

  it('counts rows', async () => {
    await clear();
    const handler = makeHandler();
    const ctx = makeCtx();

    for (let i = 0; i < 4; i++) {
      await handler.handle({
        method: 'POST',
        params: { workspaceSlug: WS_SLUG, schemaSlug: SCHEMA_SLUG, table: TABLE_NAME },
        queryParams: {},
        body: { id: uuidv7(), name: `Counted ${i}` },
        ctx,
        principal: null,
      });
    }

    const countResult = await handler.handle({
      method: 'GET',
      params: {
        workspaceSlug: WS_SLUG,
        schemaSlug: SCHEMA_SLUG,
        table: TABLE_NAME,
        subresource: 'count',
      },
      queryParams: {},
      body: undefined,
      ctx,
      principal: null,
    });

    expect(countResult.isOk()).toBe(true);
    expect(countResult._unsafeUnwrap().statusCode).toBe(200);
    const body = countResult._unsafeUnwrap().body as Record<string, unknown>;
    expect(body['count']).toBe(4);
  });

  it('archives and restores a row', async () => {
    await clear();
    const handler = makeHandler();
    const ctx = makeCtx();
    const id = uuidv7();

    await handler.handle({
      method: 'POST',
      params: { workspaceSlug: WS_SLUG, schemaSlug: SCHEMA_SLUG, table: TABLE_NAME },
      queryParams: {},
      body: { id, name: 'ToArchive' },
      ctx,
      principal: null,
    });

    const archiveResult = await handler.handle({
      method: 'DELETE',
      params: { workspaceSlug: WS_SLUG, schemaSlug: SCHEMA_SLUG, table: TABLE_NAME, id },
      queryParams: {},
      body: undefined,
      ctx,
      principal: null,
    });
    expect(archiveResult._unsafeUnwrap().statusCode).toBe(204);

    const restoreResult = await handler.handle({
      method: 'POST',
      params: {
        workspaceSlug: WS_SLUG,
        schemaSlug: SCHEMA_SLUG,
        table: TABLE_NAME,
        id,
        subresource: 'restore',
      },
      queryParams: {},
      body: undefined,
      ctx,
      principal: null,
    });
    expect(restoreResult._unsafeUnwrap().statusCode).toBe(200);
  });

  it('bulk-creates rows atomically', async () => {
    await clear();
    const handler = makeHandler();
    const ctx = makeCtx();
    const rows = Array.from({ length: 5 }, (_, i) => ({ id: uuidv7(), name: `Bulk ${i}` }));

    const bulkResult = await handler.handle({
      method: 'POST',
      params: {
        workspaceSlug: WS_SLUG,
        schemaSlug: SCHEMA_SLUG,
        table: TABLE_NAME,
        subresource: 'bulk',
      },
      queryParams: {},
      body: { items: rows },
      ctx,
      principal: null,
    });

    expect(bulkResult.isOk()).toBe(true);
    expect(bulkResult._unsafeUnwrap().statusCode).toBe(201);
    const body = bulkResult._unsafeUnwrap().body as Record<string, unknown>;
    expect(Array.isArray(body['data'])).toBe(true);
    expect((body['data'] as unknown[]).length).toBe(5);
  });

  it('hard-deletes a row', async () => {
    await clear();
    const handler = makeHandler();
    const ctx = makeCtx();
    const id = uuidv7();

    await handler.handle({
      method: 'POST',
      params: { workspaceSlug: WS_SLUG, schemaSlug: SCHEMA_SLUG, table: TABLE_NAME },
      queryParams: {},
      body: { id, name: 'ToHardDelete' },
      ctx,
      principal: null,
    });

    const deleteResult = await handler.handle({
      method: 'DELETE',
      params: { workspaceSlug: WS_SLUG, schemaSlug: SCHEMA_SLUG, table: TABLE_NAME, id },
      queryParams: { hard: 'true' },
      body: undefined,
      ctx,
      principal: null,
    });
    expect(deleteResult._unsafeUnwrap().statusCode).toBe(204);

    const getResult = await handler.handle({
      method: 'GET',
      params: { workspaceSlug: WS_SLUG, schemaSlug: SCHEMA_SLUG, table: TABLE_NAME, id },
      queryParams: {},
      body: undefined,
      ctx,
      principal: null,
    });
    expect(getResult._unsafeUnwrap().statusCode).toBe(404);
  });
});
