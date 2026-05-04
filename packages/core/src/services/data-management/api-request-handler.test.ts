import type { MetricsPort } from '@platform/ports-observability';

/**
 * Integration tests for ApiRequestHandler.
 *
 * Uses in-memory adapters — no real database. Covers the full request pipeline:
 * rate limiting, schema resolution, authorization, CRUD, bulk operations,
 * field projection, audit events, and error paths.
 */
import { describe, it, expect } from 'vitest';

import type { IdempotencyRecord } from '../../idempotency/types.js';
import type { ApiRequest } from './api-request-handler.js';
import type { CustomerSchema } from './schema-model.js';

import { ApprovalRoutingEngine } from '../../approvals/approval-routing.engine.js';
import {
  createInMemoryAudit,
  createInMemoryAuthz,
  createInMemoryCustomerRepoProvider,
  createInMemoryDdl,
  createInMemoryIntrospection,
  createInMemoryLogger,
  createInMemoryMigration,
  createInMemoryRateLimiter,
  createInMemoryRepo,
  createInMemoryTracer,
  makeUserContext,
} from '../../testing/index.js';
import { ApiRequestHandler } from './api-request-handler.js';
import { PerWorkspaceRepositoryFactory } from './per-workspace-repository-factory.js';
import { SchemaService } from './schema.service.js';

// ── Noop metrics ───────────────────────────────────────────────────────────────

const noopMetrics: MetricsPort = {
  counter: () => ({ add: () => undefined }),
  histogram: () => ({ record: () => undefined }),
  gauge: () => ({ set: () => undefined }),
};

// ── Test schema ────────────────────────────────────────────────────────────────

const WORKSPACE_ID = 'ws-test-001';
const WORKSPACE_SLUG = 'test';
const SCHEMA_SLUG = 'main';

const testSchema: CustomerSchema = {
  id: 'schema-001',
  workspaceId: WORKSPACE_ID,
  name: 'Main Schema',
  slug: SCHEMA_SLUG,
  databaseDriver: 'postgres',
  version: 1,
  tables: [
    {
      id: 'table-users',
      name: 'users',
      columns: [
        { id: 'col-id', name: 'id', type: { kind: 'uuid' }, nullable: false },
        { id: 'col-name', name: 'name', type: { kind: 'text' }, nullable: false },
        {
          id: 'col-email',
          name: 'email',
          type: { kind: 'text' },
          nullable: true,
          isPii: true,
          piiCategory: 'contact',
        },
        { id: 'col-age', name: 'age', type: { kind: 'integer' }, nullable: true },
      ],
      primaryKey: { kind: 'single', columnId: 'col-id' },
      indexes: [],
      foreignKeys: [],
      constraints: [],
    },
  ],
  metadata: {
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    createdBy: 'system',
    updatedBy: 'system',
    deployedVersion: 1,
  },
};

// ── Fixtures ───────────────────────────────────────────────────────────────────

function makeFixtures(opts: { denyAll?: boolean } = {}) {
  const authzOpts = opts.denyAll ? { deny: true as const } : {};
  const authz = createInMemoryAuthz(authzOpts);
  const schemasRepo = createInMemoryRepo<CustomerSchema>();
  const audit = createInMemoryAudit();
  const logger = createInMemoryLogger();
  const rateLimiter = createInMemoryRateLimiter();
  const customerRepoProvider = createInMemoryCustomerRepoProvider();
  const repoFactory = new PerWorkspaceRepositoryFactory(customerRepoProvider, logger);

  const schemaService = new SchemaService(
    authz,
    schemasRepo,
    createInMemoryRepo(),
    createInMemoryIntrospection(),
    createInMemoryDdl(),
    createInMemoryMigration(),
    audit,
    logger,
    new ApprovalRoutingEngine(),
  );

  const idempotencyRepo = createInMemoryRepo<IdempotencyRecord>();

  const handler = new ApiRequestHandler(
    schemaService,
    authz,
    repoFactory,
    audit,
    logger,
    rateLimiter,
    noopMetrics,
    idempotencyRepo,
    createInMemoryTracer(),
  );

  return { handler, schemasRepo, audit, rateLimiter };
}

async function seedSchema(schemasRepo: ReturnType<typeof createInMemoryRepo<CustomerSchema>>) {
  await schemasRepo.create(testSchema);
}

function makeRequest(override: Partial<ApiRequest> = {}): ApiRequest {
  const ctx = makeUserContext({ userId: 'user-1', workspaceId: WORKSPACE_ID });
  return {
    method: 'GET',
    params: { workspaceSlug: WORKSPACE_SLUG, schemaSlug: SCHEMA_SLUG, table: 'users' },
    queryParams: {},
    body: undefined,
    ctx,
    principal: null,
    ...override,
  };
}

// ── List ───────────────────────────────────────────────────────────────────────

describe('ApiRequestHandler — List', () => {
  it('returns empty list when table has no rows', async () => {
    const { handler, schemasRepo } = makeFixtures();
    await seedSchema(schemasRepo);

    const result = await handler.handle(makeRequest());
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().statusCode).toBe(200);
    expect((result._unsafeUnwrap().body as { data: unknown[] }).data).toHaveLength(0);
  });

  it('returns error when schema not found', async () => {
    const { handler } = makeFixtures();
    const result = await handler.handle(makeRequest());
    expect(result.isErr()).toBe(true);
  });

  it('returns error when table not found in schema', async () => {
    const { handler, schemasRepo } = makeFixtures();
    await seedSchema(schemasRepo);

    const result = await handler.handle(
      makeRequest({
        params: { workspaceSlug: WORKSPACE_SLUG, schemaSlug: SCHEMA_SLUG, table: 'nonexistent' },
      }),
    );
    expect(result.isErr()).toBe(true);
  });

  it('returns 403 when authorization denied', async () => {
    const { handler, schemasRepo } = makeFixtures({ denyAll: true });
    await seedSchema(schemasRepo);

    const result = await handler.handle(makeRequest());
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().statusCode).toBe(403);
  });
});

// ── Create & GetOne ────────────────────────────────────────────────────────────

describe('ApiRequestHandler — Create & GetOne', () => {
  it('creates a row and retrieves it by id', async () => {
    const { handler, schemasRepo } = makeFixtures();
    await seedSchema(schemasRepo);

    const createResult = await handler.handle(
      makeRequest({
        method: 'POST',
        body: { id: 'row-1', name: 'Alice', email: 'alice@example.com' },
      }),
    );
    expect(createResult.isOk()).toBe(true);
    expect(createResult._unsafeUnwrap().statusCode).toBe(201);

    const getResult = await handler.handle(
      makeRequest({
        params: {
          workspaceSlug: WORKSPACE_SLUG,
          schemaSlug: SCHEMA_SLUG,
          table: 'users',
          id: 'row-1',
        },
      }),
    );
    expect(getResult.isOk()).toBe(true);
    expect((getResult._unsafeUnwrap().body as Record<string, unknown>)['name']).toBe('Alice');
  });

  it('returns 400 when body is not an object', async () => {
    const { handler, schemasRepo } = makeFixtures();
    await seedSchema(schemasRepo);

    const result = await handler.handle(
      makeRequest({ method: 'POST', body: ['not', 'an', 'object'] }),
    );
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().statusCode).toBe(400);
  });
});

// ── Update ─────────────────────────────────────────────────────────────────────

describe('ApiRequestHandler — Update', () => {
  it('updates an existing row', async () => {
    const { handler, schemasRepo } = makeFixtures();
    await seedSchema(schemasRepo);

    await handler.handle(makeRequest({ method: 'POST', body: { id: 'row-1', name: 'Alice' } }));

    const updateResult = await handler.handle(
      makeRequest({
        method: 'PUT',
        params: {
          workspaceSlug: WORKSPACE_SLUG,
          schemaSlug: SCHEMA_SLUG,
          table: 'users',
          id: 'row-1',
        },
        body: { name: 'Alicia' },
      }),
    );
    expect(updateResult.isOk()).toBe(true);
    expect(updateResult._unsafeUnwrap().statusCode).toBe(200);
    expect((updateResult._unsafeUnwrap().body as Record<string, unknown>)['name']).toBe('Alicia');
  });
});

// ── Archive & Restore ──────────────────────────────────────────────────────────

describe('ApiRequestHandler — Archive & Restore', () => {
  it('soft-deletes a row and restores it', async () => {
    const { handler, schemasRepo } = makeFixtures();
    await seedSchema(schemasRepo);

    await handler.handle(makeRequest({ method: 'POST', body: { id: 'row-1', name: 'Bob' } }));

    const archiveResult = await handler.handle(
      makeRequest({
        method: 'DELETE',
        params: {
          workspaceSlug: WORKSPACE_SLUG,
          schemaSlug: SCHEMA_SLUG,
          table: 'users',
          id: 'row-1',
        },
      }),
    );
    expect(archiveResult._unsafeUnwrap().statusCode).toBe(204);

    // Not in default list
    const listResult = await handler.handle(makeRequest());
    expect((listResult._unsafeUnwrap().body as { data: unknown[] }).data).toHaveLength(0);

    // Visible with include_archived=true
    const archivedList = await handler.handle(
      makeRequest({ queryParams: { include_archived: 'true' } }),
    );
    expect((archivedList._unsafeUnwrap().body as { data: unknown[] }).data).toHaveLength(1);

    // Restore
    const restoreResult = await handler.handle(
      makeRequest({
        method: 'POST',
        params: {
          workspaceSlug: WORKSPACE_SLUG,
          schemaSlug: SCHEMA_SLUG,
          table: 'users',
          id: 'row-1',
          subresource: 'restore',
        },
      }),
    );
    expect(restoreResult._unsafeUnwrap().statusCode).toBe(200);

    // Now visible in default list
    const afterRestore = await handler.handle(makeRequest());
    expect((afterRestore._unsafeUnwrap().body as { data: unknown[] }).data).toHaveLength(1);
  });
});

// ── Count ──────────────────────────────────────────────────────────────────────

describe('ApiRequestHandler — Count', () => {
  it('returns correct count', async () => {
    const { handler, schemasRepo } = makeFixtures();
    await seedSchema(schemasRepo);

    await handler.handle(makeRequest({ method: 'POST', body: { id: 'r1', name: 'A' } }));
    await handler.handle(makeRequest({ method: 'POST', body: { id: 'r2', name: 'B' } }));

    const result = await handler.handle(
      makeRequest({
        params: {
          workspaceSlug: WORKSPACE_SLUG,
          schemaSlug: SCHEMA_SLUG,
          table: 'users',
          subresource: 'count',
        },
      }),
    );
    expect(result._unsafeUnwrap().statusCode).toBe(200);
    expect((result._unsafeUnwrap().body as { count: number }).count).toBe(2);
  });
});

// ── Bulk Create ────────────────────────────────────────────────────────────────

describe('ApiRequestHandler — Bulk Create', () => {
  it('creates multiple rows in one call', async () => {
    const { handler, schemasRepo } = makeFixtures();
    await seedSchema(schemasRepo);

    const rows = Array.from({ length: 5 }, (_, i) => ({ id: `r${i}`, name: `User ${i}` }));
    const result = await handler.handle(
      makeRequest({
        method: 'POST',
        params: {
          workspaceSlug: WORKSPACE_SLUG,
          schemaSlug: SCHEMA_SLUG,
          table: 'users',
          subresource: 'bulk',
        },
        body: rows,
      }),
    );
    expect(result._unsafeUnwrap().statusCode).toBe(201);
    expect((result._unsafeUnwrap().body as unknown[]).length).toBe(5);
  });

  it('rejects bulk create over 1000 rows', async () => {
    const { handler, schemasRepo } = makeFixtures();
    await seedSchema(schemasRepo);

    const rows = Array.from({ length: 1001 }, (_, i) => ({ id: `r${i}`, name: `U${i}` }));
    const result = await handler.handle(
      makeRequest({
        method: 'POST',
        params: {
          workspaceSlug: WORKSPACE_SLUG,
          schemaSlug: SCHEMA_SLUG,
          table: 'users',
          subresource: 'bulk',
        },
        body: rows,
      }),
    );
    expect(result._unsafeUnwrap().statusCode).toBe(400);
  });
});

// ── Field projection ───────────────────────────────────────────────────────────

describe('ApiRequestHandler — Field projection', () => {
  it('projects only requested fields', async () => {
    const { handler, schemasRepo } = makeFixtures();
    await seedSchema(schemasRepo);

    await handler.handle(
      makeRequest({ method: 'POST', body: { id: 'r1', name: 'Alice', email: 'a@b.com', age: 30 } }),
    );

    const result = await handler.handle(makeRequest({ queryParams: { fields: 'id,name' } }));
    const items = (result._unsafeUnwrap().body as { data: Record<string, unknown>[] }).data;
    expect(items[0]).toHaveProperty('id');
    expect(items[0]).toHaveProperty('name');
    expect(items[0]).not.toHaveProperty('email');
    expect(items[0]).not.toHaveProperty('age');
  });
});

// ── Workspace required ─────────────────────────────────────────────────────────

describe('ApiRequestHandler — Workspace required', () => {
  it('returns error when context lacks workspaceId', async () => {
    const { handler, schemasRepo } = makeFixtures();
    await seedSchema(schemasRepo);

    const ctx = makeUserContext({ userId: 'user-1' }); // no workspaceId
    const result = await handler.handle(makeRequest({ ctx }));
    expect(result.isErr()).toBe(true);
  });
});

// ── Audit events ───────────────────────────────────────────────────────────────

describe('ApiRequestHandler — Audit events', () => {
  it('emits ROW_CREATED audit event on create', async () => {
    const { handler, schemasRepo, audit } = makeFixtures();
    await seedSchema(schemasRepo);

    await handler.handle(makeRequest({ method: 'POST', body: { id: 'r1', name: 'Alice' } }));
    expect(audit.events.some((e) => e.eventType === 'data_management.api.row_created')).toBe(true);
  });

  it('emits ROW_ARCHIVED audit event on soft delete', async () => {
    const { handler, schemasRepo, audit } = makeFixtures();
    await seedSchema(schemasRepo);

    await handler.handle(makeRequest({ method: 'POST', body: { id: 'r1', name: 'Alice' } }));
    await handler.handle(
      makeRequest({
        method: 'DELETE',
        params: {
          workspaceSlug: WORKSPACE_SLUG,
          schemaSlug: SCHEMA_SLUG,
          table: 'users',
          id: 'r1',
        },
      }),
    );
    expect(audit.events.some((e) => e.eventType === 'data_management.api.row_archived')).toBe(true);
  });

  it('emits BULK_CREATED audit event on bulk create', async () => {
    const { handler, schemasRepo, audit } = makeFixtures();
    await seedSchema(schemasRepo);

    await handler.handle(
      makeRequest({
        method: 'POST',
        params: {
          workspaceSlug: WORKSPACE_SLUG,
          schemaSlug: SCHEMA_SLUG,
          table: 'users',
          subresource: 'bulk',
        },
        body: [
          { id: 'r1', name: 'A' },
          { id: 'r2', name: 'B' },
        ],
      }),
    );
    expect(audit.events.some((e) => e.eventType === 'data_management.api.bulk_created')).toBe(true);
  });
});

// ── Idempotency ────────────────────────────────────────────────────────────────

describe('ApiRequestHandler — Idempotency', () => {
  it('returns the same response on duplicate create with same Idempotency-Key', async () => {
    const { handler, schemasRepo } = makeFixtures();
    await seedSchema(schemasRepo);

    const ctx = makeUserContext({
      userId: 'user-1',
      workspaceId: WORKSPACE_ID,
      idempotencyKey: 'idem-key-001',
    });

    const first = await handler.handle(
      makeRequest({ method: 'POST', body: { id: 'row-idem', name: 'Idem Alice' }, ctx }),
    );
    expect(first._unsafeUnwrap().statusCode).toBe(201);

    // Second request with same key — should return cached 201, not a 409 conflict
    const second = await handler.handle(
      makeRequest({ method: 'POST', body: { id: 'row-idem', name: 'Idem Alice' }, ctx }),
    );
    expect(second._unsafeUnwrap().statusCode).toBe(201);
    expect((second._unsafeUnwrap().body as Record<string, unknown>)['name']).toBe('Idem Alice');
  });

  it('executes independently when no Idempotency-Key is provided', async () => {
    const { handler, schemasRepo } = makeFixtures();
    await seedSchema(schemasRepo);

    // Two POSTs with different IDs — both should succeed independently
    const r1 = await handler.handle(makeRequest({ method: 'POST', body: { id: 'a1', name: 'A' } }));
    const r2 = await handler.handle(makeRequest({ method: 'POST', body: { id: 'a2', name: 'B' } }));
    expect(r1._unsafeUnwrap().statusCode).toBe(201);
    expect(r2._unsafeUnwrap().statusCode).toBe(201);
  });
});

// ── Sort ───────────────────────────────────────────────────────────────────────

describe('ApiRequestHandler — Sort', () => {
  it('returns rows in descending name order with ?sort=-name', async () => {
    const { handler, schemasRepo } = makeFixtures();
    await seedSchema(schemasRepo);

    await handler.handle(makeRequest({ method: 'POST', body: { id: 'r1', name: 'Alice' } }));
    await handler.handle(makeRequest({ method: 'POST', body: { id: 'r2', name: 'Charlie' } }));
    await handler.handle(makeRequest({ method: 'POST', body: { id: 'r3', name: 'Bob' } }));

    const result = await handler.handle(makeRequest({ queryParams: { sort: '-name' } }));
    expect(result._unsafeUnwrap().statusCode).toBe(200);
    const items = (result._unsafeUnwrap().body as { data: Record<string, unknown>[] }).data;
    expect(items.map((r) => r['name'])).toEqual(['Charlie', 'Bob', 'Alice']);
  });

  it('ignores unknown columns in sort param', async () => {
    const { handler, schemasRepo } = makeFixtures();
    await seedSchema(schemasRepo);

    await handler.handle(makeRequest({ method: 'POST', body: { id: 'r1', name: 'Alice' } }));

    // ?sort=nonexistent should not crash — treated as no-op sort
    const result = await handler.handle(makeRequest({ queryParams: { sort: 'nonexistent' } }));
    expect(result._unsafeUnwrap().statusCode).toBe(200);
  });
});

// ── Cursor pagination ──────────────────────────────────────────────────────────

describe('ApiRequestHandler — Cursor pagination', () => {
  it('paginates all rows using nextCursor without duplicates or gaps', async () => {
    const { handler, schemasRepo } = makeFixtures();
    await seedSchema(schemasRepo);

    // Seed 5 rows with IDs that sort lexicographically: r1 < r2 < r3 < r4 < r5
    for (const id of ['r1', 'r2', 'r3', 'r4', 'r5']) {
      await handler.handle(makeRequest({ method: 'POST', body: { id, name: `User ${id}` } }));
    }

    // Page 1: limit=2, sort by id ascending
    const page1 = await handler.handle(makeRequest({ queryParams: { limit: '2', sort: 'id' } }));
    const page1Body = page1._unsafeUnwrap().body as {
      data: Record<string, unknown>[];
      meta: { nextCursor: string | null };
    };
    expect(page1Body.data).toHaveLength(2);
    expect(page1Body.meta.nextCursor).not.toBeNull();

    const cursor = page1Body.meta.nextCursor!;

    // Page 2: use the cursor
    const page2 = await handler.handle(
      makeRequest({ queryParams: { limit: '2', sort: 'id', cursor } }),
    );
    const page2Body = page2._unsafeUnwrap().body as {
      data: Record<string, unknown>[];
      meta: { nextCursor: string | null };
    };
    expect(page2Body.data).toHaveLength(2);

    // Page 3: last row
    const cursor2 = page2Body.meta.nextCursor!;
    const page3 = await handler.handle(
      makeRequest({ queryParams: { limit: '2', sort: 'id', cursor: cursor2 } }),
    );
    const page3Body = page3._unsafeUnwrap().body as {
      data: Record<string, unknown>[];
      meta: { nextCursor: string | null };
    };
    expect(page3Body.data).toHaveLength(1);
    expect(page3Body.meta.nextCursor).toBeNull();

    // All 5 rows returned, no overlap
    const allIds = [
      ...page1Body.data.map((r) => r['id']),
      ...page2Body.data.map((r) => r['id']),
      ...page3Body.data.map((r) => r['id']),
    ];
    expect(new Set(allIds).size).toBe(5);
  });

  it('returns null nextCursor when fewer rows than limit are returned', async () => {
    const { handler, schemasRepo } = makeFixtures();
    await seedSchema(schemasRepo);

    await handler.handle(makeRequest({ method: 'POST', body: { id: 'r1', name: 'Only' } }));

    const result = await handler.handle(makeRequest({ queryParams: { limit: '10' } }));
    const body = result._unsafeUnwrap().body as { meta: { nextCursor: string | null } };
    expect(body.meta.nextCursor).toBeNull();
  });
});

// ── Pagination performance warning ─────────────────────────────────────────────

describe('ApiRequestHandler — Pagination performance warning', () => {
  it('adds X-Pagination-Performance-Warning header when offset > 1000', async () => {
    const { handler, schemasRepo } = makeFixtures();
    await seedSchema(schemasRepo);

    const result = await handler.handle(makeRequest({ queryParams: { offset: '1001' } }));
    expect(result._unsafeUnwrap().statusCode).toBe(200);
    expect(result._unsafeUnwrap().headers?.['X-Pagination-Performance-Warning']).toBeDefined();
  });

  it('does not add warning header when offset <= 1000', async () => {
    const { handler, schemasRepo } = makeFixtures();
    await seedSchema(schemasRepo);

    const result = await handler.handle(makeRequest({ queryParams: { offset: '1000' } }));
    expect(result._unsafeUnwrap().headers?.['X-Pagination-Performance-Warning']).toBeUndefined();
  });
});
