/**
 * Integration tests for WorkspaceService against a real PostgreSQL adapter.
 *
 * These tests are skipped unless DATABASE_URL is set in the environment.
 * Run them with:
 *
 *   DATABASE_URL=postgres://... pnpm --filter @platform/core test
 *
 * They verify the same invariants as the unit tests but through the real
 * persistence adapter, catching SQL errors, constraint violations, and
 * transaction rollback that the in-memory adapter cannot simulate.
 */
import type { Workspace } from '@platform/ports-authorization';
import type { RepositoryPort } from '@platform/ports-persistence';

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import {
  createInMemoryAudit,
  createInMemoryAuthz,
  createInMemoryLogger,
  makeUserContext,
} from '../testing/index.js';
import { WorkspaceService } from './workspace.service.js';

// ── Guard: skip unless a real database is available ───────────────────────────

// eslint-disable-next-line no-restricted-syntax -- test-only env probe; bypassing getEnv() is intentional
const DATABASE_URL = process.env['DATABASE_URL'];
const haveDatabase = !!DATABASE_URL;

// ── Lazy imports (only loaded when database is available) ─────────────────────

// pg and the postgres adapter are not declared as deps of @platform/core
// (only devDeps in the workspace). Dynamic `String(...)` prevents TypeScript
// from resolving the module type at compile time, avoiding TS2307 errors.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Pool = any;

async function createPgRepo<T extends { id: string }>(
  pool: Pool,
  table: string,
): Promise<RepositoryPort<T>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
  const mod: any = await import(String('@platform/adapter-persistence-postgres'));
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  return new mod.PostgresRepositoryAdapter(pool, table, console) as unknown as RepositoryPort<T>;
}

// ── Test suite (skipped without database) ─────────────────────────────────────

describe.skipIf(!haveDatabase)('WorkspaceService — PostgreSQL integration', () => {
  let pool: Pool;
  let service: WorkspaceService;
  let audit: ReturnType<typeof createInMemoryAudit>;
  let workspaceIds: string[] = [];

  beforeAll(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
    const pgMod: any = await import(String('pg'));
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
    pool = new pgMod.Pool({ connectionString: DATABASE_URL });

    const workspacesRepo = await createPgRepo<Workspace>(pool, 'workspaces');
    const membersRepo = await createPgRepo<{
      id: string;
      workspaceId: string;
      userId: string;
      status: string;
    }>(pool, 'workspace_members');

    audit = createInMemoryAudit();
    service = new WorkspaceService(
      createInMemoryAuthz(),
      workspacesRepo,
      membersRepo,
      audit,
      createInMemoryLogger({ silent: false }),
    );
  });

  afterAll(async () => {
    // Clean up any workspaces created by this test run
    if (pool && workspaceIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await pool.query(`DELETE FROM workspaces WHERE id = ANY($1)`, [workspaceIds]);
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    await pool?.end();
  });

  beforeEach(() => {
    audit.reset();
  });

  it('creates and retrieves a workspace', async () => {
    const ctx = makeUserContext({ userId: 'integration-user-1' });
    const slug = `integration-test-${String(Date.now())}`;

    const createResult = await service.create(ctx, { name: 'Integration Test WS', slug });
    expect(createResult.isOk()).toBe(true);

    const ws = createResult._unsafeUnwrap();
    workspaceIds.push(ws.id);

    const getCtx = makeUserContext({ userId: 'integration-user-1', workspaceId: ws.id });
    const getResult = await service.getById(getCtx, ws.id);

    expect(getResult.isOk()).toBe(true);
    expect(getResult._unsafeUnwrap().slug).toBe(slug);
  });

  it('enforces slug uniqueness at the database level', async () => {
    const ctx = makeUserContext({ userId: 'integration-user-1' });
    const slug = `unique-slug-${String(Date.now())}`;

    const first = await service.create(ctx, { name: 'First', slug });
    expect(first.isOk()).toBe(true);
    workspaceIds.push(first._unsafeUnwrap().id);

    const second = await service.create(ctx, { name: 'Second', slug });
    expect(second.isErr()).toBe(true);
    expect(second._unsafeUnwrapErr().code).toBe('CONFLICT');
  });

  it('updates with optimistic locking — rejects stale version', async () => {
    const ctx = makeUserContext({ userId: 'integration-user-1' });
    const slug = `lock-test-${String(Date.now())}`;

    const createResult = await service.create(ctx, { name: 'Lock Test', slug });
    expect(createResult.isOk()).toBe(true);
    const ws = createResult._unsafeUnwrap();
    workspaceIds.push(ws.id);

    const updateCtx = makeUserContext({ userId: 'integration-user-1', workspaceId: ws.id });

    // Successful update bumps the version
    const update1 = await service.update(updateCtx, {
      id: ws.id,
      version: ws.version,
      name: 'Updated',
    });
    expect(update1.isOk()).toBe(true);

    // Stale update (version still 1) should fail
    const update2 = await service.update(updateCtx, {
      id: ws.id,
      version: ws.version,
      name: 'Stale',
    });
    expect(update2.isErr()).toBe(true);
    expect(update2._unsafeUnwrapErr().code).toBe('CONFLICT');
  });

  it('emits audit events that are captured by the in-memory audit adapter', async () => {
    const ctx = makeUserContext({ userId: 'integration-user-1' });
    const slug = `audit-test-${String(Date.now())}`;

    await service.create(ctx, { name: 'Audit Test', slug });

    expect(audit.events).toContainEqual(
      expect.objectContaining({ eventType: 'workspace.created', outcome: 'success' }),
    );
    if (audit.events[0])
      workspaceIds.push((audit.events[0] as { workspaceId?: string }).workspaceId ?? '');
  });
});
