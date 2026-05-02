import type { LoggerPort, MetricsPort, TracerPort } from '@platform/ports-observability';
import type { Db, Document, Filter as MongoFilter } from 'mongodb';
import type { Result } from 'neverthrow';

import {
  ConflictError,
  EntityNotFoundError,
  PersistenceError,
  type Filter,
  type Page,
  type PaginatedResult,
  type RepositoryPort,
  type Sort,
} from '@platform/ports-persistence';
import { err, ok } from 'neverthrow';

import type { EntityMapper } from './mapper.js';

import { translateFilter } from './filter-translator.js';

// ── Configuration ─────────────────────────────────────────────────────────────

export interface MongoCollectionConfig {
  /** MongoDB collection name. */
  collection: string;
  /**
   * Exhaustive list of valid document field names.
   * Used to validate filter field names before executing queries.
   */
  fields: ReadonlyArray<string>;
}

// ── Error mapping ─────────────────────────────────────────────────────────────

function mapMongoError(cause: unknown): PersistenceError {
  const code = (cause as { code?: number }).code;
  if (code === 11000 || code === 11001)
    return new PersistenceError('CONSTRAINT_VIOLATION', 'Duplicate key violation', cause);
  if (code === 112)
    return new PersistenceError('DEADLOCK', 'Write conflict (concurrent update)', cause);
  if (code === 50) return new PersistenceError('TIMEOUT', 'MaxTimeMS exceeded', cause);
  return new PersistenceError('UNKNOWN', `MongoDB error: ${String(cause)}`, cause);
}

// ── Sort builder ──────────────────────────────────────────────────────────────

function buildSort<TEntity>(sort: Sort<TEntity>, validFields: ReadonlyArray<string>): Document {
  const result: Document = {};
  for (const [field, dir] of Object.entries(sort)) {
    if (validFields.includes(field) && (dir === 'asc' || dir === 'desc')) {
      result[field] = dir === 'asc' ? 1 : -1;
    }
  }
  return result;
}

// ── Factory ───────────────────────────────────────────────────────────────────

export interface MongoRepositoryDeps {
  logger?: LoggerPort;
  metrics?: MetricsPort;
  tracer?: TracerPort;
  /** maxTimeMS per operation. Defaults to 30 000. */
  maxTimeMs?: number;
}

/**
 * Creates a RepositoryPort<TEntity> backed by a MongoDB collection.
 *
 * Optimistic locking via _version integer field.
 * Soft delete via _archived_at Date field.
 * All queries include { _archived_at: null } unless includeArchived is true.
 */
export function createMongoRepository<TEntity extends { id: string }>(
  db: Db,
  config: MongoCollectionConfig,
  mapper: EntityMapper<TEntity>,
  deps?: MongoRepositoryDeps,
): RepositoryPort<TEntity> {
  const { logger, metrics, tracer } = deps ?? {};
  const maxTimeMs = deps?.maxTimeMs ?? 30_000;
  const col = db.collection(config.collection);
  const validFields = config.fields;

  const durationHistogram = metrics?.histogram('platform_mongo_query_duration_seconds', {
    description: 'MongoDB query duration',
    boundaries: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
  });

  function recordDuration(operation: string, durationMs: number): void {
    durationHistogram?.record(durationMs / 1000, {
      operation,
      collection: config.collection,
    });
    if (durationMs > 1000) {
      logger?.warn('Slow MongoDB query', {
        operation,
        collection: config.collection,
        duration_ms: durationMs,
      });
    }
  }

  async function withSpan<T>(name: string, fn: () => Promise<T>): Promise<T> {
    if (tracer) return tracer.withSpan(`db.${name}`, fn);
    return fn();
  }

  const liveFilter: MongoFilter<Document> = { _archived_at: null };

  return {
    async findById(id: string): Promise<Result<TEntity | null, PersistenceError>> {
      return withSpan('findById', async () => {
        const start = Date.now();
        try {
          const doc = await col.findOne(
            { _id: id, _archived_at: null } as unknown as MongoFilter<Document>,
            { maxTimeMS: maxTimeMs },
          );
          recordDuration('findById', Date.now() - start);
          return ok(doc ? mapper.fromDocument(doc) : null);
        } catch (e) {
          return err(mapMongoError(e));
        }
      });
    },

    async findOne(filter: Filter<TEntity>): Promise<Result<TEntity | null, PersistenceError>> {
      return withSpan('findOne', async () => {
        const translated = translateFilter(filter, validFields);
        if (translated.isErr()) {
          return err(new PersistenceError('UNKNOWN', translated.error.message));
        }
        const start = Date.now();
        try {
          const doc = await col.findOne(
            { ...liveFilter, ...translated.value },
            { maxTimeMS: maxTimeMs },
          );
          recordDuration('findOne', Date.now() - start);
          return ok(doc ? mapper.fromDocument(doc) : null);
        } catch (e) {
          return err(mapMongoError(e));
        }
      });
    },

    async findMany(opts?: {
      filter?: Filter<TEntity>;
      sort?: Sort<TEntity>;
      page?: Page;
      includeArchived?: boolean;
    }): Promise<Result<PaginatedResult<TEntity>, PersistenceError>> {
      return withSpan('findMany', async () => {
        const baseFilter: MongoFilter<Document> = opts?.includeArchived ? {} : liveFilter;
        let mongoFilter: MongoFilter<Document> = baseFilter;

        if (opts?.filter) {
          const translated = translateFilter(opts.filter, validFields);
          if (translated.isErr()) {
            return err(new PersistenceError('UNKNOWN', translated.error.message));
          }
          mongoFilter = { ...baseFilter, ...translated.value };
        }

        const sortDoc = opts?.sort ? buildSort(opts.sort, validFields) : { id: 1 };
        const page = opts?.page ?? { limit: 100, offset: 0 };

        const start = Date.now();
        try {
          const [docs, total] = await Promise.all([
            col
              .find(mongoFilter, { maxTimeMS: maxTimeMs })
              .sort(sortDoc)
              .skip(page.offset)
              .limit(page.limit)
              .toArray(),
            col.countDocuments(mongoFilter, { maxTimeMS: maxTimeMs }),
          ]);
          recordDuration('findMany', Date.now() - start);
          const items = docs.map((d) => mapper.fromDocument(d));
          return ok({ items, total, limit: page.limit, offset: page.offset });
        } catch (e) {
          return err(mapMongoError(e));
        }
      });
    },

    async count(filter?: Filter<TEntity>): Promise<Result<number, PersistenceError>> {
      return withSpan('count', async () => {
        let mongoFilter: MongoFilter<Document> = liveFilter;
        if (filter) {
          const translated = translateFilter(filter, validFields);
          if (translated.isErr()) {
            return err(new PersistenceError('UNKNOWN', translated.error.message));
          }
          mongoFilter = { ...liveFilter, ...translated.value };
        }
        const start = Date.now();
        try {
          const total = await col.countDocuments(mongoFilter, { maxTimeMS: maxTimeMs });
          recordDuration('count', Date.now() - start);
          return ok(total);
        } catch (e) {
          return err(mapMongoError(e));
        }
      });
    },

    async create(entity: TEntity): Promise<Result<TEntity, PersistenceError | ConflictError>> {
      return withSpan('create', async () => {
        const doc = mapper.toDocument(entity);
        // Ensure lifecycle fields
        if (!('_version' in doc)) doc['_version'] = 1;
        if (!('_archived_at' in doc)) doc['_archived_at'] = null;
        if (!('_created_at' in doc)) doc['_created_at'] = new Date();
        if (!('_updated_at' in doc)) doc['_updated_at'] = new Date();

        const start = Date.now();
        try {
          await col.insertOne(doc, { writeConcern: { w: 'majority' } });
          recordDuration('create', Date.now() - start);
          return ok(mapper.fromDocument(doc));
        } catch (e) {
          const code = (e as { code?: number }).code;
          if (code === 11000 || code === 11001) {
            return err(
              new ConflictError(`Duplicate key in ${config.collection}`, { cause: String(e) }),
            );
          }
          return err(mapMongoError(e));
        }
      });
    },

    async update(
      id: string,
      changes: Partial<Omit<TEntity, 'id'>>,
      opts?: { expectedVersion?: number },
    ): Promise<Result<TEntity, PersistenceError | EntityNotFoundError | ConflictError>> {
      return withSpan('update', async () => {
        const partialDoc = mapper.partialToDocument(changes as Partial<TEntity>);
        partialDoc['_updated_at'] = new Date();

        const query = {
          _id: id,
          _archived_at: null,
          ...(opts?.expectedVersion !== undefined ? { _version: opts.expectedVersion } : {}),
        } as unknown as MongoFilter<Document>;

        const updateDoc = {
          $set: partialDoc,
          $inc: { _version: 1 },
        };

        const start = Date.now();
        try {
          const result = await col.findOneAndUpdate(query, updateDoc, {
            returnDocument: 'after',
            maxTimeMS: maxTimeMs,
            writeConcern: { w: 'majority' },
          });
          recordDuration('update', Date.now() - start);

          if (!result) {
            // Distinguish not-found vs version mismatch
            const existing = await col.findOne({ _id: id } as unknown as MongoFilter<Document>, {
              projection: { _version: 1 },
            });
            if (!existing) return err(new EntityNotFoundError(config.collection, id));
            return err(new ConflictError('Version mismatch — concurrent update detected'));
          }

          return ok(mapper.fromDocument(result));
        } catch (e) {
          return err(mapMongoError(e));
        }
      });
    },

    async archive(id: string): Promise<Result<void, PersistenceError | EntityNotFoundError>> {
      return withSpan('archive', async () => {
        const start = Date.now();
        try {
          const result = await col.updateOne(
            { _id: id, _archived_at: null } as unknown as MongoFilter<Document>,
            { $set: { _archived_at: new Date(), _updated_at: new Date() } },
            { writeConcern: { w: 'majority' } },
          );
          recordDuration('archive', Date.now() - start);
          if (result.matchedCount === 0) {
            return err(new EntityNotFoundError(config.collection, id));
          }
          return ok(undefined);
        } catch (e) {
          return err(mapMongoError(e));
        }
      });
    },

    async hardDelete(id: string): Promise<Result<void, PersistenceError | EntityNotFoundError>> {
      return withSpan('hardDelete', async () => {
        logger?.warn('Hard delete invoked', { collection: config.collection, id });
        const start = Date.now();
        try {
          const result = await col.deleteOne({ _id: id } as unknown as MongoFilter<Document>, {
            writeConcern: { w: 'majority' },
          });
          recordDuration('hardDelete', Date.now() - start);
          if (result.deletedCount === 0) {
            return err(new EntityNotFoundError(config.collection, id));
          }
          return ok(undefined);
        } catch (e) {
          return err(mapMongoError(e));
        }
      });
    },
  };
}
