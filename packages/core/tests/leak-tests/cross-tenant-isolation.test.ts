/**
 * Cross-tenant isolation test battery.
 *
 * These tests verify that workspace isolation is structural — not something
 * a caller can accidentally bypass. Any failure here is a P0: production has
 * the same leak.
 *
 * Tests use an in-process mock authorization adapter backed by simple Maps,
 * which allows fast, deterministic verification of the isolation contract.
 */

import type { RequestContext } from '@platform/ports-authorization';
import type { RepositoryPort } from '@platform/ports-persistence';

import { PersistenceError } from '@platform/ports-persistence';
import * as fc from 'fast-check';
import { err, ok } from 'neverthrow';
import { describe, expect, it } from 'vitest';

import { bindToContext } from '../../src/repositories/context-bound-repo.js';

// ── In-memory scoped entity ───────────────────────────────────────────────────

interface ScopedEntity {
  id: string;
  workspaceId: string;
  name: string;
}

function makeInMemoryRepo(data: ScopedEntity[]): RepositoryPort<ScopedEntity> {
  const store = new Map<string, ScopedEntity>(data.map((e) => [e.id, e]));

  return {
    findById: (id) => Promise.resolve(ok(store.get(id) ?? null)),
    findOne: (filter) => {
      const all = [...store.values()];
      const match = all.find((e) => matchesFilter(e, filter));
      return Promise.resolve(ok(match ?? null));
    },
    findMany: (opts) => {
      const all = [...store.values()];
      const f = opts?.filter;
      const filtered = f !== undefined ? all.filter((e) => matchesFilter(e, f)) : all;
      return Promise.resolve(
        ok({ items: filtered, total: filtered.length, limit: 100, offset: 0 }),
      );
    },
    count: (filter) => {
      const all = [...store.values()];
      const filtered = filter !== undefined ? all.filter((e) => matchesFilter(e, filter)) : all;
      return Promise.resolve(ok(filtered.length));
    },
    create: (entity) => {
      store.set(entity.id, entity);
      return Promise.resolve(ok(entity));
    },
    update: (id, changes) => {
      const existing = store.get(id);
      if (!existing) return Promise.resolve(err(new PersistenceError('UNKNOWN', 'Not found')));
      const updated = { ...existing, ...changes } as ScopedEntity;
      store.set(id, updated);
      return Promise.resolve(ok(updated));
    },
    archive: (id) => {
      const e = store.get(id);
      if (!e) return Promise.resolve(err(new PersistenceError('UNKNOWN', 'Not found')));
      store.delete(id);
      return Promise.resolve(ok(undefined));
    },
    hardDelete: (id) => {
      if (!store.has(id)) return Promise.resolve(err(new PersistenceError('UNKNOWN', 'Not found')));
      store.delete(id);
      return Promise.resolve(ok(undefined));
    },
  };
}

// Minimal filter evaluator for test in-memory repo
function matchesFilter(entity: ScopedEntity, filter: unknown): boolean {
  if (!filter || typeof filter !== 'object') return true;
  const f = filter as Record<string, unknown>;

  if ('_and' in f) {
    return (f['_and'] as unknown[]).every((sub) => matchesFilter(entity, sub));
  }
  if ('_or' in f) {
    return (f['_or'] as unknown[]).some((sub) => matchesFilter(entity, sub));
  }
  if ('workspaceId' in f) {
    const constraint = f['workspaceId'] as { _eq?: string };
    if (constraint['_eq'] !== undefined) return entity.workspaceId === constraint['_eq'];
  }
  if ('id' in f) {
    const constraint = f['id'] as { _eq?: string };
    if (constraint['_eq'] !== undefined) return entity.id === constraint['_eq'];
  }
  return true;
}

function makeCtx(workspaceId: string, userId = 'user-1'): RequestContext {
  return {
    userId,
    workspaceId,
    installationRoles: [],
    correlationId: 'corr-1',
    mfaSatisfied: false,
    _kind: 'user',
  };
}

function makeCtxNoWorkspace(): RequestContext {
  return {
    userId: 'user-1',
    installationRoles: [],
    correlationId: 'c1',
    mfaSatisfied: false,
    _kind: 'user',
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Cross-tenant isolation — bindToContext', () => {
  it('filters entities to the bound workspace — user in ws-A cannot see ws-B entities', async () => {
    const entities: ScopedEntity[] = [
      { id: 'e-1', workspaceId: 'ws-A', name: 'alpha' },
      { id: 'e-2', workspaceId: 'ws-B', name: 'beta' },
      { id: 'e-3', workspaceId: 'ws-A', name: 'gamma' },
    ];

    const repo = makeInMemoryRepo(entities);
    const ctxA = makeCtx('ws-A');
    const bound = bindToContext(repo, ctxA);

    const result = await bound.findMany();
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.items.every((e) => e.workspaceId === 'ws-A')).toBe(true);
      expect(result.value.items.find((e) => e.id === 'e-2')).toBeUndefined();
    }
  });

  it('findById on ws-B entity from ws-A context returns null', async () => {
    const entities: ScopedEntity[] = [{ id: 'e-2', workspaceId: 'ws-B', name: 'beta' }];
    const repo = makeInMemoryRepo(entities);
    const bound = bindToContext(repo, makeCtx('ws-A'));

    const result = await bound.findById('e-2');
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBeNull();
    }
  });

  it('update on ws-B entity from ws-A context returns error', async () => {
    const entities: ScopedEntity[] = [{ id: 'e-2', workspaceId: 'ws-B', name: 'beta' }];
    const repo = makeInMemoryRepo(entities);
    const bound = bindToContext(repo, makeCtx('ws-A'));

    const result = await bound.update('e-2', { name: 'hacked' });
    expect(result.isErr()).toBe(true);
  });

  it('archive on ws-B entity from ws-A context returns error', async () => {
    const entities: ScopedEntity[] = [{ id: 'e-2', workspaceId: 'ws-B', name: 'beta' }];
    const repo = makeInMemoryRepo(entities);
    const bound = bindToContext(repo, makeCtx('ws-A'));

    const result = await bound.archive('e-2');
    expect(result.isErr()).toBe(true);
  });

  it('hardDelete on ws-B entity from ws-A context returns error', async () => {
    const entities: ScopedEntity[] = [{ id: 'e-2', workspaceId: 'ws-B', name: 'beta' }];
    const repo = makeInMemoryRepo(entities);
    const bound = bindToContext(repo, makeCtx('ws-A'));

    const result = await bound.hardDelete('e-2');
    expect(result.isErr()).toBe(true);
  });

  it('create with mismatched workspaceId is rejected', async () => {
    const repo = makeInMemoryRepo([]);
    const bound = bindToContext(repo, makeCtx('ws-A'));

    const result = await bound.create({ id: 'e-new', workspaceId: 'ws-B', name: 'injected' });
    expect(result.isErr()).toBe(true);
  });

  it('missing workspaceId in context rejects all operations', async () => {
    const entities: ScopedEntity[] = [{ id: 'e-1', workspaceId: 'ws-A', name: 'alpha' }];
    const repo = makeInMemoryRepo(entities);
    const bound = bindToContext(repo, makeCtxNoWorkspace());

    const findResult = await bound.findMany();
    expect(findResult.isErr()).toBe(true);

    const createResult = await bound.create({ id: 'e-new', workspaceId: 'ws-A', name: 'test' });
    expect(createResult.isErr()).toBe(true);
  });
});

// ── Property-based cross-tenant tests ─────────────────────────────────────────

describe('Cross-tenant isolation — property-based', () => {
  it('entities in workspace A are never visible from workspace B context', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.uuid(),
            workspaceId: fc.constantFrom('ws-A', 'ws-B', 'ws-C'),
            name: fc.string({ minLength: 1, maxLength: 20 }),
          }),
          { minLength: 0, maxLength: 20 },
        ),
        fc.constantFrom('ws-A', 'ws-B', 'ws-C'),
        fc.constantFrom('ws-A', 'ws-B', 'ws-C'),
        async (entities, writerWs, readerWs) => {
          if (writerWs === readerWs) return;

          const repo = makeInMemoryRepo(entities);
          const readerCtx = makeCtx(readerWs);
          const bound = bindToContext(repo, readerCtx);

          const result = await bound.findMany();
          if (result.isErr()) return;

          const leaked = result.value.items.filter((e) => e.workspaceId !== readerWs);
          expect(leaked).toHaveLength(0);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('findById never returns an entity from a different workspace', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.constantFrom('ws-A', 'ws-B'),
        fc.constantFrom('ws-A', 'ws-B'),
        fc.string({ minLength: 1, maxLength: 10 }),
        async (entityId, entityWs, readerWs, name) => {
          if (entityWs === readerWs) return;

          const repo = makeInMemoryRepo([{ id: entityId, workspaceId: entityWs, name }]);
          const bound = bindToContext(repo, makeCtx(readerWs));

          const result = await bound.findById(entityId);
          expect(result.isOk()).toBe(true);
          if (result.isOk()) {
            expect(result.value).toBeNull();
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('mutations (update/archive/hardDelete) on foreign-workspace entities always fail', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.constantFrom('ws-A', 'ws-B'),
        fc.constantFrom('ws-A', 'ws-B'),
        async (entityId, entityWs, actorWs) => {
          if (entityWs === actorWs) return;

          const repo = makeInMemoryRepo([{ id: entityId, workspaceId: entityWs, name: 'x' }]);
          const bound = bindToContext(repo, makeCtx(actorWs));

          const updateResult = await bound.update(entityId, { name: 'hacked' });
          expect(updateResult.isErr()).toBe(true);

          const archiveResult = await bound.archive(entityId);
          expect(archiveResult.isErr()).toBe(true);

          const deleteResult = await bound.hardDelete(entityId);
          expect(deleteResult.isErr()).toBe(true);
        },
      ),
      { numRuns: 200 },
    );
  });
});
