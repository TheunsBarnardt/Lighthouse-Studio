import type {
  ConflictError as PersistenceConflict,
  EntityNotFoundError,
  RepositoryPort,
} from '@platform/ports-persistence';

import {
  ConflictError as PConflict,
  EntityNotFoundError as PNotFound,
  type PersistenceError as PError,
} from '@platform/ports-persistence';
import { ok, err, type Result } from 'neverthrow';
// PError is the PersistenceError class used in return type annotations throughout this file.

type Entity = { id: string; version?: number };

/**
 * Fully in-memory RepositoryPort implementation for unit tests.
 *
 * Supports optimistic locking via the version field when entities carry one.
 * All methods operate on a plain Map; no actual database involved.
 */
export function createInMemoryRepo<TEntity extends Entity>(): RepositoryPort<TEntity> & {
  /** Direct access to the underlying store for test assertions. */
  store: Map<string, TEntity>;
} {
  const store = new Map<string, TEntity>();

  function matchesFilter(entity: TEntity, filter: unknown): boolean {
    if (!filter || typeof filter !== 'object') return true;
    const f = filter as Record<string, unknown>;

    if ('_and' in f && Array.isArray(f['_and'])) {
      return (f['_and'] as unknown[]).every((sub) => matchesFilter(entity, sub));
    }
    if ('_or' in f && Array.isArray(f['_or'])) {
      return (f['_or'] as unknown[]).some((sub) => matchesFilter(entity, sub));
    }

    for (const [key, condition] of Object.entries(f)) {
      if (key.startsWith('_')) continue;
      const entityVal = (entity as Record<string, unknown>)[key];
      if (condition && typeof condition === 'object') {
        const cond = condition as Record<string, unknown>;
        if ('_eq' in cond && entityVal !== cond['_eq']) return false;
        if ('_neq' in cond && entityVal === cond['_neq']) return false;
        if ('_in' in cond && Array.isArray(cond['_in']) && !cond['_in'].includes(entityVal))
          return false;
      }
    }
    return true;
  }

  return {
    store,

    findById(id: string): Promise<Result<TEntity | null, PError>> {
      return Promise.resolve(ok(store.get(id) ?? null));
    },

    findOne(filter: unknown): Promise<Result<TEntity | null, PError>> {
      for (const entity of store.values()) {
        if ((entity as Record<string, unknown>)['archivedAt'] != null) continue;
        if (matchesFilter(entity, filter)) return Promise.resolve(ok(entity));
      }
      return Promise.resolve(ok(null));
    },

    findMany(opts?: {
      filter?: unknown;
      includeArchived?: boolean;
    }): Promise<
      Result<{ items: TEntity[]; total: number; limit: number; offset: number }, PError>
    > {
      const items: TEntity[] = [];
      for (const entity of store.values()) {
        if (opts?.filter && !matchesFilter(entity, opts.filter)) continue;
        const e = entity as Record<string, unknown>;
        if (!opts?.includeArchived && e['archivedAt'] != null) continue;
        items.push(entity);
      }
      return Promise.resolve(ok({ items, total: items.length, limit: items.length, offset: 0 }));
    },

    count(filter?: unknown): Promise<Result<number, PError>> {
      let n = 0;
      for (const entity of store.values()) {
        if (!filter || matchesFilter(entity, filter)) n++;
      }
      return Promise.resolve(ok(n));
    },

    create(entity: TEntity): Promise<Result<TEntity, PError | PersistenceConflict>> {
      if (store.has(entity.id)) {
        return Promise.resolve(err(new PConflict('Entity already exists', { id: entity.id })));
      }
      const created = { ...entity, version: entity.version ?? 1 } as TEntity;
      store.set(entity.id, created);
      return Promise.resolve(ok(created));
    },

    update(
      id: string,
      changes: Partial<Omit<TEntity, 'id'>>,
      opts?: { expectedVersion?: number },
    ): Promise<Result<TEntity, PError | EntityNotFoundError | PersistenceConflict>> {
      const existing = store.get(id);
      if (!existing) {
        return Promise.resolve(err(new PNotFound('entity', id)));
      }
      if (
        opts?.expectedVersion !== undefined &&
        (existing as Record<string, unknown>)['version'] !== opts.expectedVersion
      ) {
        return Promise.resolve(
          err(new PConflict(`Version mismatch: expected ${String(opts.expectedVersion)}`, {})),
        );
      }
      const currentVersion = (existing as Record<string, unknown>)['version'];
      const updated = {
        ...existing,
        ...changes,
        version: typeof currentVersion === 'number' ? currentVersion + 1 : 1,
      } as TEntity;
      store.set(id, updated);
      return Promise.resolve(ok(updated));
    },

    archive(id: string): Promise<Result<void, PError | EntityNotFoundError>> {
      const existing = store.get(id);
      if (!existing) return Promise.resolve(err(new PNotFound('entity', id)));
      store.set(id, { ...existing, archivedAt: new Date() } as TEntity);
      return Promise.resolve(ok(undefined));
    },

    hardDelete(id: string): Promise<Result<void, PError | EntityNotFoundError>> {
      if (!store.has(id)) return Promise.resolve(err(new PNotFound('entity', id)));
      store.delete(id);
      return Promise.resolve(ok(undefined));
    },
  };
}
