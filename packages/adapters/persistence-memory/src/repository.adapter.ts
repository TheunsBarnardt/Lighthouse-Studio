import type { Result } from 'neverthrow';

import {
  ConflictError,
  EntityNotFoundError,
  type Filter,
  type Page,
  type PaginatedResult,
  type PersistenceError,
  type RepositoryPort,
  type Sort,
} from '@platform/ports-persistence';
import { err, ok } from 'neverthrow';

export class InMemoryRepository<TEntity extends { id: string }> implements RepositoryPort<TEntity> {
  private readonly store = new Map<string, TEntity>();
  private readonly versions = new Map<string, number>();
  private readonly archived = new Set<string>();

  findById(id: string): Promise<Result<TEntity | null, PersistenceError>> {
    const entity = this.store.get(id);
    if (!entity || this.archived.has(id)) return Promise.resolve(ok(null));
    return Promise.resolve(ok({ ...entity }));
  }

  async findOne(filter: Filter<TEntity>): Promise<Result<TEntity | null, PersistenceError>> {
    const result = await this.findMany({ filter, page: { limit: 1, offset: 0 } });
    if (result.isErr()) return err(result.error);
    const items = result.value.items;
    return ok(items[0] ?? null);
  }

  findMany(opts?: {
    filter?: Filter<TEntity>;
    sort?: Sort<TEntity>;
    page?: Page;
    includeArchived?: boolean;
  }): Promise<Result<PaginatedResult<TEntity>, PersistenceError>> {
    let items = Array.from(this.store.values()).filter(
      (e) => opts?.includeArchived ?? !this.archived.has(e.id),
    );
    const filter = opts?.filter;
    if (filter) {
      items = items.filter((e) => this.matchFilter(e, filter));
    }
    if (opts?.sort) {
      const sortEntries = Object.entries(opts.sort) as [keyof TEntity, 'asc' | 'desc'][];
      items.sort((a, b) => {
        for (const [key, dir] of sortEntries) {
          const av = a[key];
          const bv = b[key];
          if (av === bv) continue;
          const cmp = av < bv ? -1 : 1;
          return dir === 'asc' ? cmp : -cmp;
        }
        return 0;
      });
    }
    const total = items.length;
    const page = opts?.page ?? { limit: 100, offset: 0 };
    const paged = items.slice(page.offset, page.offset + page.limit);
    return Promise.resolve(
      ok({ items: paged.map((e) => ({ ...e })), total, limit: page.limit, offset: page.offset }),
    );
  }

  async count(filter?: Filter<TEntity>): Promise<Result<number, PersistenceError>> {
    const result = await this.findMany({
      ...(filter !== undefined ? { filter } : {}),
      page: { limit: 1_000_000, offset: 0 },
    });
    if (result.isErr()) return err(result.error);
    return ok(result.value.total);
  }

  create(entity: TEntity): Promise<Result<TEntity, PersistenceError | ConflictError>> {
    if (this.store.has(entity.id)) {
      return Promise.resolve(err(new ConflictError(`Duplicate id: ${entity.id}`)));
    }
    this.store.set(entity.id, { ...entity });
    this.versions.set(entity.id, 1);
    return Promise.resolve(ok({ ...entity }));
  }

  update(
    id: string,
    changes: Partial<Omit<TEntity, 'id'>>,
    opts?: { expectedVersion?: number },
  ): Promise<Result<TEntity, PersistenceError | EntityNotFoundError | ConflictError>> {
    const existing = this.store.get(id);
    if (!existing || this.archived.has(id)) {
      return Promise.resolve(err(new EntityNotFoundError('Entity', id)));
    }
    if (opts?.expectedVersion !== undefined) {
      const current = this.versions.get(id) ?? 1;
      if (current !== opts.expectedVersion) {
        return Promise.resolve(
          err(
            new ConflictError(
              `Version mismatch: expected ${String(opts.expectedVersion)}, got ${String(current)}`,
            ),
          ),
        );
      }
    }
    const updated = { ...existing, ...changes };
    this.store.set(id, updated);
    this.versions.set(id, (this.versions.get(id) ?? 1) + 1);
    return Promise.resolve(ok({ ...updated }));
  }

  archive(id: string): Promise<Result<void, PersistenceError | EntityNotFoundError>> {
    if (!this.store.has(id)) {
      return Promise.resolve(err(new EntityNotFoundError('Entity', id)));
    }
    this.archived.add(id);
    return Promise.resolve(ok(undefined));
  }

  hardDelete(id: string): Promise<Result<void, PersistenceError | EntityNotFoundError>> {
    if (!this.store.has(id)) {
      return Promise.resolve(err(new EntityNotFoundError('Entity', id)));
    }
    this.store.delete(id);
    this.versions.delete(id);
    this.archived.delete(id);
    return Promise.resolve(ok(undefined));
  }

  private matchFilter(entity: TEntity, filter: Filter<TEntity>): boolean {
    if ('_and' in filter) {
      return filter._and.every((f) => this.matchFilter(entity, f));
    }
    if ('_or' in filter) {
      return filter._or.some((f) => this.matchFilter(entity, f));
    }
    if ('_not' in filter) {
      return !this.matchFilter(entity, filter._not);
    }
    // FieldFilter
    for (const [key, value] of Object.entries(filter)) {
      const entityVal = entity[key as keyof TEntity];
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        const op = value as Record<string, unknown>;
        if ('_eq' in op && entityVal !== op['_eq']) return false;
        if ('_neq' in op && entityVal === op['_neq']) return false;
        if ('_in' in op && !Array.isArray(op['_in'])) return false;
        if (
          '_in' in op &&
          Array.isArray(op['_in']) &&
          !(op['_in'] as unknown[]).includes(entityVal)
        )
          return false;
        if ('_is_null' in op && (entityVal === null || entityVal === undefined) !== op['_is_null'])
          return false;
      } else {
        if (entityVal !== value) return false;
      }
    }
    return true;
  }
}
