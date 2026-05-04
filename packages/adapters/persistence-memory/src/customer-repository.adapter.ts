import type {
  CustomerRow,
  CustomerRepositoryProviderPort,
  CustomerTableDescriptor,
  CustomerTableRepository,
  PersistenceError,
} from '@platform/ports-persistence';
import type { Filter, Page, PaginatedResult, Sort } from '@platform/ports-persistence';
import type { Result } from 'neverthrow';

import { ConflictError, EntityNotFoundError } from '@platform/ports-persistence';
import { err, ok } from 'neverthrow';
import { uuidv7 } from 'uuidv7';

// ── In-memory customer table ───────────────────────────────────────────────────

class InMemoryCustomerTableRepository implements CustomerTableRepository {
  private readonly store = new Map<string, CustomerRow>();
  private readonly versions = new Map<string, number>();
  private readonly archived = new Set<string>();
  private readonly pk: string;

  constructor(descriptor: CustomerTableDescriptor) {
    this.pk = descriptor.primaryKeyColumn;
  }

  findById(id: string): Promise<Result<CustomerRow | null, PersistenceError>> {
    const row = this.store.get(id);
    if (!row || this.archived.has(id)) return Promise.resolve(ok(null));
    return Promise.resolve(ok({ ...row }));
  }

  async findOne(
    filter: Filter<CustomerRow>,
  ): Promise<Result<CustomerRow | null, PersistenceError>> {
    const result = await this.findMany({ filter, page: { limit: 1, offset: 0 } });
    if (result.isErr()) return err(result.error);
    return ok(result.value.items[0] ?? null);
  }

  findMany(opts?: {
    filter?: Filter<CustomerRow>;
    sort?: Sort<CustomerRow>;
    page?: Page;
    includeArchived?: boolean;
  }): Promise<Result<PaginatedResult<CustomerRow>, PersistenceError>> {
    let rows = Array.from(this.store.values()).filter(
      (r) => (opts?.includeArchived ?? false) || !this.archived.has(r[this.pk] as string),
    );

    const filter = opts?.filter;
    if (filter) {
      rows = rows.filter((r) => this.matchFilter(r, filter));
    }

    if (opts?.sort) {
      const entries = Object.entries(opts.sort) as [string, 'asc' | 'desc'][];
      rows.sort((a, b) => {
        for (const [col, dir] of entries) {
          const av = a[col];
          const bv = b[col];
          if (av === bv) continue;
          const cmp = (av ?? '') < (bv ?? '') ? -1 : 1;
          return dir === 'asc' ? cmp : -cmp;
        }
        return 0;
      });
    }

    const total = rows.length;
    const { limit = 50, offset = 0 } = opts?.page ?? {};
    const items = rows.slice(offset, offset + limit).map((r) => ({ ...r }));
    return Promise.resolve(ok({ items, total, limit, offset }));
  }

  async count(filter?: Filter<CustomerRow>): Promise<Result<number, PersistenceError>> {
    const result = await this.findMany({
      ...(filter !== undefined ? { filter } : {}),
      page: { limit: 10_000_000, offset: 0 },
    });
    if (result.isErr()) return err(result.error);
    return ok(result.value.total);
  }

  create(entity: CustomerRow): Promise<Result<CustomerRow, PersistenceError | ConflictError>> {
    const id = (entity[this.pk] as string | undefined) ?? uuidv7();
    const row = { ...entity, [this.pk]: id };
    if (this.store.has(id)) {
      return Promise.resolve(err(new ConflictError(`Duplicate ${this.pk}: ${id}`)));
    }
    this.store.set(id, row);
    this.versions.set(id, 1);
    return Promise.resolve(ok({ ...row }));
  }

  update(
    id: string,
    changes: Partial<CustomerRow>,
    opts?: { expectedVersion?: number },
  ): Promise<Result<CustomerRow, PersistenceError | EntityNotFoundError | ConflictError>> {
    const existing = this.store.get(id);
    if (!existing || this.archived.has(id)) {
      return Promise.resolve(err(new EntityNotFoundError('Row', id)));
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
    if (!this.store.has(id)) return Promise.resolve(err(new EntityNotFoundError('Row', id)));
    this.archived.add(id);
    return Promise.resolve(ok(undefined));
  }

  restore(id: string): Promise<Result<void, PersistenceError | EntityNotFoundError>> {
    if (!this.store.has(id)) return Promise.resolve(err(new EntityNotFoundError('Row', id)));
    this.archived.delete(id);
    return Promise.resolve(ok(undefined));
  }

  hardDelete(id: string): Promise<Result<void, PersistenceError | EntityNotFoundError>> {
    if (!this.store.has(id)) return Promise.resolve(err(new EntityNotFoundError('Row', id)));
    this.store.delete(id);
    this.versions.delete(id);
    this.archived.delete(id);
    return Promise.resolve(ok(undefined));
  }

  async bulkCreate(
    entities: CustomerRow[],
    opts?: { maxRows?: number },
  ): Promise<Result<CustomerRow[], PersistenceError>> {
    const max = opts?.maxRows ?? 1000;
    if (entities.length > max) {
      return err({
        kind: 'persistence',
        message: `Bulk create exceeds limit of ${String(max)}`,
      } as unknown as PersistenceError);
    }
    const results: CustomerRow[] = [];
    for (const entity of entities) {
      const result = await this.create(entity);
      if (result.isErr()) return err(result.error as PersistenceError);
      results.push(result.value);
    }
    return ok(results);
  }

  async bulkUpdate(
    filter: Filter<CustomerRow>,
    changes: Partial<CustomerRow>,
    opts?: { maxAffectedRows?: number },
  ): Promise<Result<{ affectedCount: number }, PersistenceError>> {
    const max = opts?.maxAffectedRows ?? 10000;
    const matchResult = await this.findMany({ filter, page: { limit: max, offset: 0 } });
    if (matchResult.isErr()) return err(matchResult.error);

    let affectedCount = 0;
    for (const row of matchResult.value.items) {
      const id = row[this.pk] as string;
      const r = await this.update(id, changes);
      if (r.isErr()) continue;
      affectedCount++;
    }
    return ok({ affectedCount });
  }

  async bulkDelete(
    filter: Filter<CustomerRow>,
    opts?: { maxAffectedRows?: number },
  ): Promise<Result<{ affectedCount: number }, PersistenceError>> {
    const max = opts?.maxAffectedRows ?? 10000;
    const matchResult = await this.findMany({ filter, page: { limit: max, offset: 0 } });
    if (matchResult.isErr()) return err(matchResult.error);

    let affectedCount = 0;
    for (const row of matchResult.value.items) {
      const id = row[this.pk] as string;
      await this.archive(id);
      affectedCount++;
    }
    return ok({ affectedCount });
  }

  private matchFilter(row: CustomerRow, filter: Filter<CustomerRow>): boolean {
    if ('_and' in filter) {
      return (filter as { _and: Filter<CustomerRow>[] })._and.every((f) =>
        this.matchFilter(row, f),
      );
    }
    if ('_or' in filter) {
      return (filter as { _or: Filter<CustomerRow>[] })._or.some((f) => this.matchFilter(row, f));
    }
    if ('_not' in filter) {
      return !this.matchFilter(row, (filter as { _not: Filter<CustomerRow> })._not);
    }
    // FieldFilter
    for (const [key, cond] of Object.entries(filter as Record<string, unknown>)) {
      const val = row[key];
      if (cond !== null && typeof cond === 'object' && !Array.isArray(cond)) {
        const op = cond as Record<string, unknown>;
        if ('_eq' in op && val !== op['_eq']) return false;
        if ('_neq' in op && val === op['_neq']) return false;
        if ('_in' in op && Array.isArray(op['_in']) && !(op['_in'] as unknown[]).includes(val))
          return false;
        if ('_nin' in op && Array.isArray(op['_nin']) && (op['_nin'] as unknown[]).includes(val))
          return false;
        if ('_lt' in op && !((val as number) < (op['_lt'] as number))) return false;
        if ('_lte' in op && !((val as number) <= (op['_lte'] as number))) return false;
        if ('_gt' in op && !((val as number) > (op['_gt'] as number))) return false;
        if ('_gte' in op && !((val as number) >= (op['_gte'] as number))) return false;
        if ('_is_null' in op && (val === null || val === undefined) !== op['_is_null'])
          return false;
      } else {
        if (val !== cond) return false;
      }
    }
    return true;
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────

export class InMemoryCustomerRepositoryProvider implements CustomerRepositoryProviderPort {
  private readonly tables = new Map<string, InMemoryCustomerTableRepository>();

  buildRepository(descriptor: CustomerTableDescriptor): CustomerTableRepository {
    const key = `${descriptor.namespace}.${descriptor.tableName}`;
    if (!this.tables.has(key)) {
      this.tables.set(key, new InMemoryCustomerTableRepository(descriptor));
    }
    const repo = this.tables.get(key);
    if (!repo) throw new Error(`Repository for ${key} was not set after initialization`);
    return repo;
  }

  /** Direct access for test assertions. */
  getTable(namespace: string, tableName: string): InMemoryCustomerTableRepository | undefined {
    return this.tables.get(`${namespace}.${tableName}`);
  }
}
