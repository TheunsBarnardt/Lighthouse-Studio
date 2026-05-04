/**
 * ApiRequestHandler performance tests — PostgreSQL adapter.
 *
 * Measures end-to-end p95 latency through the full ApiRequestHandler pipeline
 * (rate limiter, authz, schema resolution, repo, audit — all in-memory except Postgres).
 *
 * Only runs when PERF_TEST=true AND a Postgres connection URL is set:
 *
 *   PERF_TEST=true POSTGRES_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres pnpm test api-handler.perf
 *
 * Targets (p95):
 *   list (1 000 rows in table)   < 200 ms
 *   create single row            < 100 ms
 *   bulk-create 1 000 rows       < 5 000 ms
 */

import { NoopMetrics } from '@platform/adapter-observability-memory';
import {
  ApiRequestHandler,
  PerWorkspaceRepositoryFactory,
  type CustomerSchema,
  type SchemaService,
} from '@platform/core';
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

// ── Guards ─────────────────────────────────────────────────────────────────────

const PERF_TEST = process.env['PERF_TEST'] === 'true';

const POSTGRES_URL = process.env['POSTGRES_DIRECT_URL'] ?? process.env['POSTGRES_URL'];

// ── Constants ──────────────────────────────────────────────────────────────────

const WS_SLUG = 'perf_ws';
const SCHEMA_SLUG = 'perf';
const TABLE_NAME = 'orders';
const TABLE_ID = 'tbl_orders';
const PG_NS = `cust_${WS_SLUG}`;
const SEED_ROWS = 1_000;
const ITERATIONS = 50;
const BULK_SIZE = 1_000;

const FIXED_SCHEMA: CustomerSchema = {
  id: 'sch_perf',
  workspaceId: 'ws_perf',
  name: 'Perf Schema',
  slug: SCHEMA_SLUG,
  version: 1,
  databaseDriver: 'postgres',
  tables: [
    {
      id: TABLE_ID,
      name: TABLE_NAME,
      columns: [
        { id: 'col_id', name: 'id', type: { kind: 'text' }, nullable: false },
        { id: 'col_name', name: 'name', type: { kind: 'text' }, nullable: false },
        { id: 'col_amount', name: 'amount', type: { kind: 'integer' }, nullable: true },
      ],
      indexes: [],
      foreignKeys: [],
      constraints: [],
      primaryKey: { kind: 'single', columnId: 'col_id' },
    },
  ],
  metadata: {
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    createdBy: 'perf',
    updatedBy: 'perf',
    lastDeployedAt: new Date('2025-01-01'),
    deployedVersion: 1,
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function p95(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  const idx = Math.ceil(sorted.length * 0.95) - 1;
  return sorted[Math.max(0, idx)] ?? 0;
}

async function time<T>(fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const t0 = performance.now();
  const result = await fn();
  return { result, ms: performance.now() - t0 };
}

let pool: Pool | undefined;

function makeHandler() {
  if (!pool) throw new Error('Pool not initialised');
  const provider = new PostgresCustomerRepositoryProvider(pool);
  const repos = new PerWorkspaceRepositoryFactory(provider, createInMemoryLogger());
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

// ── Setup / teardown ───────────────────────────────────────────────────────────

beforeAll(async () => {
  if (!PERF_TEST || !POSTGRES_URL) return;

  pool = new Pool({ connectionString: POSTGRES_URL, max: 5 });
  await pool.query(`CREATE SCHEMA IF NOT EXISTS "${PG_NS}"`);
  await pool.query(`DROP TABLE IF EXISTS "${PG_NS}"."${TABLE_NAME}"`);
  await pool.query(`
    CREATE TABLE "${PG_NS}"."${TABLE_NAME}" (
      id                  TEXT        NOT NULL PRIMARY KEY,
      name                TEXT        NOT NULL,
      amount              INTEGER,
      "${ARCHIVE_COL}"    TIMESTAMPTZ,
      "${VERSION_COL}"    INTEGER     NOT NULL DEFAULT 1
    )
  `);

  // Seed SEED_ROWS rows for list/count benchmarks
  const batchSize = 500;
  for (let offset = 0; offset < SEED_ROWS; offset += batchSize) {
    const count = Math.min(batchSize, SEED_ROWS - offset);
    const values = Array.from(
      { length: count },
      (_, i) => `('${uuidv7()}', 'Order ${offset + i}', ${(offset + i) % 1000})`,
    ).join(', ');
    await pool.query(`INSERT INTO "${PG_NS}"."${TABLE_NAME}" (id, name, amount) VALUES ${values}`);
  }
});

afterAll(async () => {
  if (!pool) return;
  await pool.query(`DROP SCHEMA IF EXISTS "${PG_NS}" CASCADE`);
  await pool.end();
});

// ── Benchmarks ─────────────────────────────────────────────────────────────────

describe.skipIf(!PERF_TEST || !POSTGRES_URL)('ApiRequestHandler perf — PostgreSQL', () => {
  it(`list p95 < 200 ms (${SEED_ROWS}-row table, ${ITERATIONS} iterations)`, async () => {
    const handler = makeHandler();
    const ctx = makeUserContext({ workspaceId: 'ws_perf' });
    const samples: number[] = [];

    for (let i = 0; i < ITERATIONS; i++) {
      const { ms } = await time(() =>
        handler.handle({
          method: 'GET',
          params: { workspaceSlug: WS_SLUG, schemaSlug: SCHEMA_SLUG, table: TABLE_NAME },
          queryParams: { limit: '50' },
          body: undefined,
          ctx,
          principal: null,
        }),
      );
      samples.push(ms);
    }

    const result = p95(samples);
    process.stdout.write(`  list p95: ${result.toFixed(1)} ms\n`);
    expect(result).toBeLessThan(200);
  });

  it(`create single row p95 < 100 ms (${ITERATIONS} iterations)`, async () => {
    const handler = makeHandler();
    const ctx = makeUserContext({ workspaceId: 'ws_perf' });
    const samples: number[] = [];

    for (let i = 0; i < ITERATIONS; i++) {
      const { ms } = await time(() =>
        handler.handle({
          method: 'POST',
          params: { workspaceSlug: WS_SLUG, schemaSlug: SCHEMA_SLUG, table: TABLE_NAME },
          queryParams: {},
          body: { id: uuidv7(), name: `Perf row ${i}`, amount: i },
          ctx,
          principal: null,
        }),
      );
      samples.push(ms);
    }

    const result = p95(samples);
    process.stdout.write(`  create p95: ${result.toFixed(1)} ms\n`);
    expect(result).toBeLessThan(100);
  });

  it(`bulk-create ${BULK_SIZE} rows p95 < 5 000 ms (10 iterations)`, async () => {
    const handler = makeHandler();
    const ctx = makeUserContext({ workspaceId: 'ws_perf' });
    const samples: number[] = [];
    const bulkIterations = 10;

    for (let iter = 0; iter < bulkIterations; iter++) {
      const rows = Array.from({ length: BULK_SIZE }, (_, i) => ({
        id: uuidv7(),
        name: `Bulk ${iter}-${i}`,
        amount: i,
      }));

      const { ms } = await time(() =>
        handler.handle({
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
        }),
      );
      samples.push(ms);
    }

    const result = p95(samples);
    process.stdout.write(`  bulk-create ${BULK_SIZE} rows p95: ${result.toFixed(1)} ms\n`);
    expect(result).toBeLessThan(5_000);
  });
});
