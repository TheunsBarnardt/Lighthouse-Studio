import type { Workspace } from '@platform/ports-authorization';

import { describe, it, expect, beforeEach } from 'vitest';

import {
  createInMemoryAudit,
  createInMemoryAuthz,
  createInMemoryLogger,
  createInMemoryRepo,
  makeUserContext,
} from '../testing/index.js';
import { WorkspaceService } from './workspace.service.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeAdapters(opts?: { denyAll?: boolean; denyActions?: string[] }) {
  const authzOpts: Parameters<typeof createInMemoryAuthz>[0] = {};
  if (opts?.denyAll) authzOpts['deny'] = opts.denyAll;
  if (opts?.denyActions) authzOpts['denyActions'] = opts.denyActions;
  return {
    authz: createInMemoryAuthz(authzOpts),
    workspaces: createInMemoryRepo<Workspace>(),
    members: createInMemoryRepo<{
      id: string;
      workspaceId: string;
      userId: string;
      status: string;
    }>(),
    audit: createInMemoryAudit(),
    logger: createInMemoryLogger(),
  };
}

function makeService(opts?: { denyAll?: boolean; denyActions?: string[] }) {
  const adapters = makeAdapters(opts);
  const service = new WorkspaceService(
    adapters.authz,
    adapters.workspaces,
    adapters.members,
    adapters.audit,
    adapters.logger,
  );
  return { service, adapters };
}

// ── create ─────────────────────────────────────────────────────────────────────

describe('WorkspaceService.create', () => {
  it('creates a workspace with valid input', async () => {
    const { service } = makeService();
    const ctx = makeUserContext({ userId: 'user-1' });

    const result = await service.create(ctx, { name: 'Acme Corp', slug: 'acme-corp' });

    expect(result.isOk()).toBe(true);
    const ws = result._unsafeUnwrap();
    expect(ws.name).toBe('Acme Corp');
    expect(ws.slug).toBe('acme-corp');
    expect(ws.ownerUserId).toBe('user-1');
    expect(ws.version).toBe(1);
  });

  it('persists the workspace in the repo', async () => {
    const { service, adapters } = makeService();
    const ctx = makeUserContext({ userId: 'user-1' });

    const result = await service.create(ctx, { name: 'Acme Corp', slug: 'acme-corp' });
    expect(result.isOk()).toBe(true);

    expect(adapters.workspaces.store.size).toBe(1);
  });

  it('emits a workspace.created audit event on success', async () => {
    const { service, adapters } = makeService();
    const ctx = makeUserContext({ userId: 'user-1' });

    await service.create(ctx, { name: 'Acme Corp', slug: 'acme-corp' });

    expect(adapters.audit.events).toContainEqual(
      expect.objectContaining({ eventType: 'workspace.created', outcome: 'success' }),
    );
  });

  it('rejects a slug with uppercase letters', async () => {
    const { service } = makeService();
    const ctx = makeUserContext();

    const result = await service.create(ctx, { name: 'Test', slug: 'Test-Workspace' });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('VALIDATION');
  });

  it('rejects a slug with spaces', async () => {
    const { service } = makeService();
    const ctx = makeUserContext();

    const result = await service.create(ctx, { name: 'Test', slug: 'test workspace' });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('VALIDATION');
  });

  it('rejects empty name', async () => {
    const { service } = makeService();
    const ctx = makeUserContext();

    const result = await service.create(ctx, { name: '', slug: 'test' });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('VALIDATION');
  });

  it('rejects duplicate slug', async () => {
    const { service } = makeService();
    const ctx = makeUserContext({ userId: 'user-1' });

    await service.create(ctx, { name: 'First', slug: 'my-slug' });
    const second = await service.create(ctx, { name: 'Second', slug: 'my-slug' });

    expect(second.isErr()).toBe(true);
    expect(second._unsafeUnwrapErr().code).toBe('CONFLICT');
  });

  it('returns FORBIDDEN when authorization is denied', async () => {
    const { service, adapters } = makeService({ denyAll: true });
    const ctx = makeUserContext();

    const result = await service.create(ctx, { name: 'Test', slug: 'test' });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('FORBIDDEN');
    expect(adapters.audit.events).toContainEqual(expect.objectContaining({ outcome: 'denied' }));
  });

  it('does not emit success audit when authorization fails', async () => {
    const { service, adapters } = makeService({ denyAll: true });
    const ctx = makeUserContext();

    await service.create(ctx, { name: 'Test', slug: 'test' });

    const successEvents = adapters.audit.events.filter(
      (e) => e.outcome === 'success' && e.eventType === 'workspace.created',
    );
    expect(successEvents).toHaveLength(0);
  });
});

// ── update ─────────────────────────────────────────────────────────────────────

describe('WorkspaceService.update', () => {
  let ctx = makeUserContext({ userId: 'owner', workspaceId: 'ws-1' });
  let adapters: ReturnType<typeof makeAdapters>;
  let service: WorkspaceService;

  beforeEach(async () => {
    ctx = makeUserContext({ userId: 'owner', workspaceId: 'ws-1' });
    ({ service, adapters } = makeService());
    await service.create(makeUserContext({ userId: 'owner' }), { name: 'Original', slug: 'ws-1' });
    const ws = [...adapters.workspaces.store.values()][0]!;
    // Patch workspaceId on context to match the created workspace id
    ctx = makeUserContext({ userId: 'owner', workspaceId: ws.id });
  });

  it('updates name and description', async () => {
    const ws = [...adapters.workspaces.store.values()][0]!;
    const result = await service.update(ctx, {
      id: ws.id,
      version: ws.version,
      name: 'Updated',
      description: 'desc',
    });

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().name).toBe('Updated');
  });

  it('emits workspace.updated audit event', async () => {
    const ws = [...adapters.workspaces.store.values()][0]!;
    adapters.audit.reset();

    await service.update(ctx, { id: ws.id, version: ws.version, name: 'Updated' });

    expect(adapters.audit.events).toContainEqual(
      expect.objectContaining({ eventType: 'workspace.updated', outcome: 'success' }),
    );
  });

  it('returns CONFLICT on optimistic lock mismatch', async () => {
    const ws = [...adapters.workspaces.store.values()][0]!;
    const result = await service.update(ctx, {
      id: ws.id,
      version: ws.version + 99,
      name: 'Stale update',
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('CONFLICT');
  });

  it('returns WORKSPACE_CONTEXT_REQUIRED when workspaceId is missing from ctx', async () => {
    const ws = [...adapters.workspaces.store.values()][0]!;
    const noWsCtx = makeUserContext({ userId: 'owner' });
    const result = await service.update(noWsCtx, { id: ws.id, version: 1, name: 'X' });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('WORKSPACE_CONTEXT_REQUIRED');
  });

  it('returns VALIDATION error on invalid input', async () => {
    const result = await service.update(ctx, { id: 'not-a-uuid', version: 1, name: 'X' });
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('VALIDATION');
  });
});

// ── archive ────────────────────────────────────────────────────────────────────

describe('WorkspaceService.archive', () => {
  it('archives a workspace and emits audit event', async () => {
    const { service, adapters } = makeService();
    const createCtx = makeUserContext({ userId: 'owner' });
    await service.create(createCtx, { name: 'To Archive', slug: 'to-archive' });
    const ws = [...adapters.workspaces.store.values()][0]!;

    const ctx = makeUserContext({ userId: 'owner', workspaceId: ws.id });
    const result = await service.archive(ctx, { id: ws.id, version: ws.version });

    expect(result.isOk()).toBe(true);
    expect(adapters.audit.events).toContainEqual(
      expect.objectContaining({ eventType: 'workspace.archived', outcome: 'success' }),
    );
  });

  it('returns FORBIDDEN when authorization denied', async () => {
    const { service, adapters } = makeService({ denyActions: ['workspace.archive'] });
    const createAdapters = makeAdapters();
    const createSvc = new WorkspaceService(
      createAdapters.authz,
      adapters.workspaces,
      adapters.members,
      createAdapters.audit,
      createAdapters.logger,
    );
    await createSvc.create(makeUserContext({ userId: 'owner' }), {
      name: 'WS',
      slug: 'ws-a',
    });
    const ws = [...adapters.workspaces.store.values()][0]!;
    const ctx = makeUserContext({ userId: 'owner', workspaceId: ws.id });

    const result = await service.archive(ctx, { id: ws.id, version: ws.version });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('FORBIDDEN');
  });
});

// ── getById ────────────────────────────────────────────────────────────────────

describe('WorkspaceService.getById', () => {
  it('returns the workspace when found and scoped correctly', async () => {
    const { service, adapters } = makeService();
    await service.create(makeUserContext({ userId: 'owner' }), {
      name: 'Test WS',
      slug: 'test-ws',
    });
    const ws = [...adapters.workspaces.store.values()][0]!;
    const ctx = makeUserContext({ userId: 'owner', workspaceId: ws.id });

    const result = await service.getById(ctx, ws.id);

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().id).toBe(ws.id);
  });

  it('returns FORBIDDEN when requesting a different workspace', async () => {
    const { service, adapters } = makeService();
    await service.create(makeUserContext({ userId: 'owner' }), {
      name: 'Test WS',
      slug: 'test-ws',
    });
    const ws = [...adapters.workspaces.store.values()][0]!;
    const ctx = makeUserContext({ userId: 'owner', workspaceId: 'different-ws-id' });

    const result = await service.getById(ctx, ws.id);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('FORBIDDEN');
  });

  it('returns NOT_FOUND for unknown id', async () => {
    const { service } = makeService();
    const ctx = makeUserContext({ userId: 'owner', workspaceId: 'ws-1' });

    const result = await service.getById(ctx, 'nonexistent-id');

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('NOT_FOUND');
  });
});

// ── delete ─────────────────────────────────────────────────────────────────────

describe('WorkspaceService.delete', () => {
  it('hard-deletes a workspace', async () => {
    const { service, adapters } = makeService();
    await service.create(makeUserContext({ userId: 'owner' }), {
      name: 'Delete Me',
      slug: 'delete-me',
    });
    const ws = [...adapters.workspaces.store.values()][0]!;
    const ctx = makeUserContext({ userId: 'owner' });

    const result = await service.delete(ctx, ws.id);

    expect(result.isOk()).toBe(true);
    expect(adapters.workspaces.store.size).toBe(0);
    expect(adapters.audit.events).toContainEqual(
      expect.objectContaining({ eventType: 'workspace.deleted', outcome: 'success' }),
    );
  });
});
