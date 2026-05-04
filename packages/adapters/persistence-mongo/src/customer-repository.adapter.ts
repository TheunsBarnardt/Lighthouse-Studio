import type {
  CustomerRepositoryProviderPort,
  CustomerRow,
  CustomerTableDescriptor,
  CustomerTableRepository,
  Filter,
  PaginatedResult,
  Sort,
} from '@platform/ports-persistence';
import type { Collection, Db, Filter as MongoFilter, Document } from 'mongodb';
import type { Result } from 'neverthrow';

import { ConflictError, EntityNotFoundError, PersistenceError } from '@platform/ports-persistence';
import { err, ok } from 'neverthrow';

import { translateFilter } from './filter-translator.js';

// ── System fields ─────────────────────────────────────────────────────────────

export const ARCHIVE_FIELD = '_pf_archived_at';
export const VERSION_FIELD = '_pf_version';

const SYSTEM_FIELDS = new Set([ARCHIVE_FIELD, VERSION_FIELD]);

// ── Error mapping ─────────────────────────────────────────────────────────────

function mapMongoError(cause: unknown): PersistenceError {
  const code = (cause as { code?: number }).code;
  if (code === 11000) return new PersistenceError('CONSTRAINT_VIOLATION', 'Duplicate key', cause);
  return new PersistenceError('UNKNOWN', `MongoDB error: ${String(cause)}`, cause);
}

function stripSystem(doc: Record<string, unknown>): CustomerRow {
  const out: CustomerRow = {};
  for (const [k, v] of Object.entries(doc)) {
    if (k === '_id') continue; // Mongo internal
    if (!SYSTEM_FIELDS.has(k)) out[k] = v;
  }
  return out;
}

function buildSort(
  sort: Sort<CustomerRow>,
  validCols: ReadonlyArray<string>,
): Record<string, 1 | -1> {
  const s: Record<string, 1 | -1> = {};
  for (const [field, dir] of Object.entries(sort)) {
    if (validCols.includes(field)) s[field] = dir === 'asc' ? 1 : -1;
  }
  return s;
}

// ── Repository ────────────────────────────────────────────────────────────────

class MongoCustomerTableRepository implements CustomerTableRepository {
  private readonly col: Collection;

  constructor(
    db: Db,
    collectionName: string,
    private readonly pk: string,
    private readonly cols: ReadonlyArray<string>,
  ) {
    this.col = db.collection(collectionName);
  }

  private userCols(): ReadonlyArray<string> {
    return this.cols.filter((c) => !SYSTEM_FIELDS.has(c));
  }

  private activeFilter(): MongoFilter<Document> {
    return { [ARCHIVE_FIELD]: null } as MongoFilter<Document>;
  }

  async findById(id: string): Promise<Result<CustomerRow | null, PersistenceError>> {
    try {
      const doc = await this.col.findOne({
        [this.pk]: id,
        [ARCHIVE_FIELD]: null,
      } as MongoFilter<Document>);
      if (!doc) return ok(null);
      return ok(stripSystem(doc as Record<string, unknown>));
    } catch (e) {
      return err(mapMongoError(e));
    }
  }

  async findOne(
    filter: Filter<CustomerRow>,
  ): Promise<Result<CustomerRow | null, PersistenceError>> {
    const many = await this.findMany({ filter, page: { limit: 1, offset: 0 } });
    if (many.isErr()) return err(many.error);
    return ok(many.value.items[0] ?? null);
  }

  async findMany(opts?: {
    filter?: Filter<CustomerRow>;
    sort?: Sort<CustomerRow>;
    page?: { limit: number; offset: number };
    includeArchived?: boolean;
  }): Promise<Result<PaginatedResult<CustomerRow>, PersistenceError>> {
    try {
      const mongoFilters: MongoFilter<Document>[] = [];

      if (!opts?.includeArchived) {
        mongoFilters.push(this.activeFilter());
      }

      if (opts?.filter) {
        const translated = translateFilter(opts.filter as Filter<Record<string, unknown>>, [
          ...this.userCols(),
        ]);
        if (translated.isErr())
          return err(new PersistenceError('UNKNOWN', translated.error.message));
        mongoFilters.push(translated.value);
      }

      const mongoFilter: MongoFilter<Document> =
        mongoFilters.length === 1
          ? (mongoFilters[0] as MongoFilter<Document>)
          : mongoFilters.length > 1
            ? { $and: mongoFilters }
            : {};

      const limit = opts?.page?.limit ?? 50;
      const offset = opts?.page?.offset ?? 0;
      const sort = opts?.sort ? buildSort(opts.sort, [...this.userCols()]) : {};

      const total = await this.col.countDocuments(mongoFilter);
      const docs = await this.col
        .find(mongoFilter)
        .sort(sort)
        .skip(offset)
        .limit(limit === 0 ? 1_000_000 : limit)
        .toArray();

      const items = (docs as Record<string, unknown>[]).map(stripSystem);
      return ok({ items, total, limit, offset });
    } catch (e) {
      return err(mapMongoError(e));
    }
  }

  async count(filter?: Filter<CustomerRow>): Promise<Result<number, PersistenceError>> {
    const r = await this.findMany({
      ...(filter !== undefined ? { filter } : {}),
      page: { limit: 0, offset: 0 },
    });
    if (r.isErr()) return err(r.error);
    return ok(r.value.total);
  }

  async create(
    entity: CustomerRow,
  ): Promise<Result<CustomerRow, PersistenceError | ConflictError>> {
    try {
      const doc: Record<string, unknown> = { ...entity, [ARCHIVE_FIELD]: null, [VERSION_FIELD]: 1 };
      await this.col.insertOne(doc as Document);
      return ok(stripSystem(doc));
    } catch (e) {
      if ((e as { code?: number }).code === 11000) {
        return err(new ConflictError(`Duplicate ${this.pk}: ${String(entity[this.pk])}`));
      }
      return err(mapMongoError(e));
    }
  }

  async update(
    id: string,
    changes: Partial<CustomerRow>,
    opts?: { expectedVersion?: number },
  ): Promise<Result<CustomerRow, PersistenceError | EntityNotFoundError | ConflictError>> {
    try {
      const query: MongoFilter<Document> = {
        [this.pk]: id,
        [ARCHIVE_FIELD]: null,
      } as MongoFilter<Document>;
      if (opts?.expectedVersion !== undefined) {
        (query as Record<string, unknown>)[VERSION_FIELD] = opts.expectedVersion;
      }

      const safeChanges: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(changes)) {
        if (!SYSTEM_FIELDS.has(k)) safeChanges[k] = v;
      }

      const res = await this.col.findOneAndUpdate(
        query,
        { $set: safeChanges, $inc: { [VERSION_FIELD]: 1 } },
        { returnDocument: 'after' },
      );

      if (!res) {
        // Check whether the row exists at all to distinguish not-found from version mismatch
        const exists = await this.col.findOne({ [this.pk]: id } as MongoFilter<Document>);
        if (!exists) return err(new EntityNotFoundError('Row', id));
        return err(new ConflictError(`Version mismatch or row archived`));
      }

      return ok(stripSystem(res as Record<string, unknown>));
    } catch (e) {
      return err(mapMongoError(e));
    }
  }

  async archive(id: string): Promise<Result<void, PersistenceError | EntityNotFoundError>> {
    try {
      const res = await this.col.updateOne(
        { [this.pk]: id, [ARCHIVE_FIELD]: null } as MongoFilter<Document>,
        { $set: { [ARCHIVE_FIELD]: new Date() } },
      );
      if (res.matchedCount === 0) return err(new EntityNotFoundError('Row', id));
      return ok(undefined);
    } catch (e) {
      return err(mapMongoError(e));
    }
  }

  async restore(id: string): Promise<Result<void, PersistenceError | EntityNotFoundError>> {
    try {
      const res = await this.col.updateOne({ [this.pk]: id } as MongoFilter<Document>, {
        $set: { [ARCHIVE_FIELD]: null },
      });
      if (res.matchedCount === 0) return err(new EntityNotFoundError('Row', id));
      return ok(undefined);
    } catch (e) {
      return err(mapMongoError(e));
    }
  }

  async hardDelete(id: string): Promise<Result<void, PersistenceError | EntityNotFoundError>> {
    try {
      const res = await this.col.deleteOne({ [this.pk]: id } as MongoFilter<Document>);
      if (res.deletedCount === 0) return err(new EntityNotFoundError('Row', id));
      return ok(undefined);
    } catch (e) {
      return err(mapMongoError(e));
    }
  }

  async bulkCreate(
    entities: CustomerRow[],
    opts?: { maxRows?: number },
  ): Promise<Result<CustomerRow[], PersistenceError>> {
    const max = opts?.maxRows ?? 1000;
    if (entities.length > max)
      return err(new PersistenceError('UNKNOWN', `Bulk create exceeds limit of ${String(max)}`));
    if (entities.length === 0) return ok([]);
    const results: CustomerRow[] = [];
    for (const entity of entities) {
      const r = await this.create(entity);
      if (r.isErr()) return err(r.error as PersistenceError);
      results.push(r.value);
    }
    return ok(results);
  }

  async bulkUpdate(
    filter: Filter<CustomerRow>,
    changes: Partial<CustomerRow>,
    opts?: { maxAffectedRows?: number },
  ): Promise<Result<{ affectedCount: number }, PersistenceError>> {
    const max = opts?.maxAffectedRows ?? 10000;
    const many = await this.findMany({ filter, page: { limit: max, offset: 0 } });
    if (many.isErr()) return err(many.error);
    let affectedCount = 0;
    for (const row of many.value.items) {
      const r = await this.update(row[this.pk] as string, changes);
      if (r.isErr()) return err(r.error as PersistenceError);
      affectedCount++;
    }
    return ok({ affectedCount });
  }

  async bulkDelete(
    filter: Filter<CustomerRow>,
    opts?: { maxAffectedRows?: number },
  ): Promise<Result<{ affectedCount: number }, PersistenceError>> {
    const max = opts?.maxAffectedRows ?? 10000;
    const many = await this.findMany({ filter, page: { limit: max, offset: 0 } });
    if (many.isErr()) return err(many.error);
    let affectedCount = 0;
    for (const row of many.value.items) {
      const r = await this.archive(row[this.pk] as string);
      if (r.isErr()) return err(r.error as PersistenceError);
      affectedCount++;
    }
    return ok({ affectedCount });
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────

export class MongoCustomerRepositoryProvider implements CustomerRepositoryProviderPort {
  constructor(private readonly db: Db) {}

  buildRepository(descriptor: CustomerTableDescriptor): CustomerTableRepository {
    // MongoDB: namespace is "cust_<slug>__", collection is "cust_<slug>__<tableName>"
    const collectionName = `${descriptor.namespace}${descriptor.tableName}`;
    return new MongoCustomerTableRepository(
      this.db,
      collectionName,
      descriptor.primaryKeyColumn,
      descriptor.columnNames,
    );
  }
}
