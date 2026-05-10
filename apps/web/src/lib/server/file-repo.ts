import { ok, err } from 'neverthrow';
/**
 * JSON file-backed repository for dev persistence.
 * Implements the same RepositoryPort interface as createInMemoryRepo but
 * flushes to a .json file on every mutation so data survives server restarts.
 * Self-contained: no dependency on @platform/ports-persistence.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Minimal error classes matching the shape of ports-persistence errors
class RepoConflictError extends Error {
  readonly code = 'CONFLICT';
  readonly statusCode = 409;
  constructor(
    message: string,
    readonly metadata: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ConflictError';
  }
}

class RepoNotFoundError extends Error {
  readonly code = 'NOT_FOUND';
  readonly statusCode = 404;
  constructor(entity: string, id: string) {
    super(`${entity} not found: ${id}`);
    this.name = 'EntityNotFoundError';
    this.metadata = { entity, id };
  }
  readonly metadata: Record<string, unknown>;
}

type Entity = { id: string; version?: number };

const DATA_DIR = join(process.cwd(), '.lighthouse-data');

/* eslint-disable security/detect-non-literal-fs-filename -- paths are constructed from a fixed DATA_DIR constant and a trusted internal name, not user input */

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function load<T>(name: string): Map<string, T> {
  try {
    ensureDir();
    const path = join(DATA_DIR, `${name}.json`);
    if (!existsSync(path)) return new Map();
    const raw = readFileSync(path, 'utf-8');
    const entries = JSON.parse(raw) as [string, T][];
    return new Map(entries);
  } catch {
    return new Map();
  }
}

function flush<T>(name: string, store: Map<string, T>) {
  try {
    ensureDir();
    writeFileSync(join(DATA_DIR, `${name}.json`), JSON.stringify([...store.entries()]), 'utf-8');
  } catch {
    // best-effort; server logs will surface any persistent failure
  }
}

/* eslint-enable security/detect-non-literal-fs-filename */

function matchesFilter<T extends Entity>(entity: T, filter: unknown): boolean {
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

export function createFileRepo<TEntity extends Entity>(name: string) {
  const store = load<TEntity>(name);
  const save = () => {
    flush(name, store);
  };

  return {
    store,

    findById(id: string) {
      return Promise.resolve(ok(store.get(id) ?? null));
    },

    findOne(filter: unknown) {
      for (const entity of store.values()) {
        if ((entity as Record<string, unknown>)['archivedAt'] != null) continue;
        if (matchesFilter(entity, filter)) return Promise.resolve(ok(entity));
      }
      return Promise.resolve(ok(null));
    },

    findMany(opts?: { filter?: unknown; includeArchived?: boolean }) {
      const items: TEntity[] = [];
      for (const entity of store.values()) {
        if (opts?.filter && !matchesFilter(entity, opts.filter)) continue;
        const e = entity as Record<string, unknown>;
        if (!opts?.includeArchived && e['archivedAt'] != null) continue;
        items.push(entity);
      }
      return Promise.resolve(ok({ items, total: items.length, limit: items.length, offset: 0 }));
    },

    count(filter?: unknown) {
      let n = 0;
      for (const entity of store.values()) {
        if (!filter || matchesFilter(entity, filter)) n++;
      }
      return Promise.resolve(ok(n));
    },

    create(entity: TEntity) {
      if (store.has(entity.id)) {
        return Promise.resolve(
          err(new RepoConflictError('Entity already exists', { id: entity.id })),
        );
      }
      const created = { ...entity, version: entity.version ?? 1 } as TEntity;
      store.set(entity.id, created);
      save();
      return Promise.resolve(ok(created));
    },

    update(id: string, changes: Partial<Omit<TEntity, 'id'>>, opts?: { expectedVersion?: number }) {
      const existing = store.get(id);
      if (!existing) return Promise.resolve(err(new RepoNotFoundError('entity', id)));
      if (
        opts?.expectedVersion !== undefined &&
        (existing as Record<string, unknown>)['version'] !== opts.expectedVersion
      ) {
        return Promise.resolve(
          err(new RepoConflictError(`Version mismatch: expected ${String(opts.expectedVersion)}`)),
        );
      }
      const currentVersion = (existing as Record<string, unknown>)['version'];
      const updated = {
        ...existing,
        ...changes,
        version: typeof currentVersion === 'number' ? currentVersion + 1 : 1,
      } as TEntity;
      store.set(id, updated);
      save();
      return Promise.resolve(ok(updated));
    },

    archive(id: string) {
      const existing = store.get(id);
      if (!existing) return Promise.resolve(err(new RepoNotFoundError('entity', id)));
      store.set(id, { ...existing, archivedAt: new Date().toISOString() } as TEntity);
      save();
      return Promise.resolve(ok(undefined));
    },

    hardDelete(id: string) {
      if (!store.has(id)) return Promise.resolve(err(new RepoNotFoundError('entity', id)));
      store.delete(id);
      save();
      return Promise.resolve(ok(undefined));
    },
  };
}
