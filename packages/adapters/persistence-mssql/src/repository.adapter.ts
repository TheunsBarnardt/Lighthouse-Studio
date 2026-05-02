import type { LoggerPort, MetricsPort, TracerPort } from '@platform/ports-observability';
import type * as mssql from 'mssql';
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

export interface MssqlTableConfig {
  schema: string;
  table: string;
  columns: ReadonlyArray<string>;
}

// ── Error mapping ─────────────────────────────────────────────────────────────

function mssqlErrorNumber(e: unknown): number | undefined {
  return (e as { number?: number }).number;
}

function mapMssqlError(cause: unknown): PersistenceError {
  const num = mssqlErrorNumber(cause);
  if (num === 2627 || num === 2601)
    return new PersistenceError('CONSTRAINT_VIOLATION', 'Unique constraint violation', cause);
  if (num === 1205) return new PersistenceError('DEADLOCK', 'Deadlock detected', cause);
  if (num === -2) return new PersistenceError('TIMEOUT', 'Statement timeout', cause);
  if (num === 229 || num === 230)
    return new PersistenceError('PERMISSION_DENIED', 'Permission denied', cause);
  return new PersistenceError('UNKNOWN', `Database error: ${String(cause)}`, cause);
}

// ── Sort builder ──────────────────────────────────────────────────────────────

function buildOrderBy<TEntity>(sort: Sort<TEntity>, validColumns: ReadonlyArray<string>): string {
  const parts: string[] = [];
  for (const [field, dir] of Object.entries(sort)) {
    if (validColumns.includes(field) && (dir === 'asc' || dir === 'desc')) {
      parts.push(`[${field}] ${dir.toUpperCase()}`);
    }
  }
  // T-SQL requires ORDER BY for OFFSET…FETCH
  return parts.length > 0 ? `ORDER BY ${parts.join(', ')}` : 'ORDER BY [id]';
}

// ── Parameter binding helper ──────────────────────────────────────────────────

function bindParams(req: mssql.Request, params: Record<string, unknown>): void {
  for (const [name, value] of Object.entries(params)) {
    req.input(name, value);
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

export interface MssqlRepositoryDeps {
  logger?: LoggerPort;
  metrics?: MetricsPort;
  tracer?: TracerPort;
}

/**
 * Creates a RepositoryPort<TEntity> backed by an MSSQL table.
 *
 * Uses OUTPUT INSERTED.* instead of RETURNING.
 * Uses OFFSET…FETCH instead of LIMIT…OFFSET.
 * Optimistic locking via rowversion token in _row_version column.
 * BIT columns handled via the entity mapper.
 */
export function createMssqlRepository<TEntity extends { id: string }>(
  pool: mssql.ConnectionPool,
  config: MssqlTableConfig,
  mapper: EntityMapper<TEntity>,
  deps?: MssqlRepositoryDeps,
): RepositoryPort<TEntity> {
  const { logger, metrics, tracer } = deps ?? {};
  const fqTable = `[${config.schema}].[${config.table}]`;
  const validColumns = config.columns;

  const durationHistogram = metrics?.histogram('platform_mssql_query_duration_seconds', {
    description: 'MSSQL query duration',
    boundaries: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
  });
  const slowQueryCounter = metrics?.counter('platform_mssql_slow_queries_total', {
    description: 'Number of MSSQL queries exceeding 1 second',
  });

  function recordDuration(operation: string, durationMs: number): void {
    durationHistogram?.record(durationMs / 1000, { operation, table: config.table });
    if (durationMs > 1000) {
      slowQueryCounter?.add(1, { operation, table: config.table });
      logger?.warn('Slow MSSQL query', { operation, table: config.table, duration_ms: durationMs });
    }
  }

  async function withSpan<T>(name: string, fn: () => Promise<T>): Promise<T> {
    if (tracer) return tracer.withSpan(`db.${name}`, fn);
    return fn();
  }

  return {
    async findById(id: string): Promise<Result<TEntity | null, PersistenceError>> {
      return withSpan('findById', async () => {
        const start = Date.now();
        try {
          const req = pool.request();
          req.input('id', id);
          const res = await req.query(
            `SELECT * FROM ${fqTable} WHERE [id] = @id AND [_archived_at] IS NULL`,
          );
          recordDuration('findById', Date.now() - start);
          const row = res.recordset[0] as Record<string, unknown> | undefined;
          return ok(row ? mapper.fromDbRow(row) : null);
        } catch (e) {
          return err(mapMssqlError(e));
        }
      });
    },

    async findOne(filter: Filter<TEntity>): Promise<Result<TEntity | null, PersistenceError>> {
      return withSpan('findOne', async () => {
        const params: Record<string, unknown> = {};
        const translated = translateFilter(filter, validColumns, params);
        if (translated.isErr()) {
          return err(new PersistenceError('UNKNOWN', translated.error.message));
        }

        const start = Date.now();
        try {
          const req = pool.request();
          bindParams(req, params);
          const res = await req.query(
            `SELECT TOP 1 * FROM ${fqTable} WHERE [_archived_at] IS NULL AND (${translated.value.sql})`,
          );
          recordDuration('findOne', Date.now() - start);
          const row = res.recordset[0] as Record<string, unknown> | undefined;
          return ok(row ? mapper.fromDbRow(row) : null);
        } catch (e) {
          return err(mapMssqlError(e));
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
        const params: Record<string, unknown> = {};
        const archivedClause = opts?.includeArchived ? '1=1' : '[_archived_at] IS NULL';
        let filterClause = '1=1';

        if (opts?.filter) {
          const translated = translateFilter(opts.filter, validColumns, params);
          if (translated.isErr()) {
            return err(new PersistenceError('UNKNOWN', translated.error.message));
          }
          filterClause = translated.value.sql;
        }

        const orderBy = opts?.sort ? buildOrderBy(opts.sort, validColumns) : 'ORDER BY [id]';
        const page = opts?.page ?? { limit: 100, offset: 0 };
        const whereClause = `${archivedClause} AND (${filterClause})`;

        params['__limit'] = page.limit;
        params['__offset'] = page.offset;

        const start = Date.now();
        try {
          const dataReq = pool.request();
          bindParams(dataReq, params);
          const countReq = pool.request();
          // bind only filter params (not pagination) for count
          const countParams = { ...params };
          delete countParams['__limit'];
          delete countParams['__offset'];
          bindParams(countReq, countParams);

          const [dataRes, countRes] = await Promise.all([
            dataReq.query(
              `SELECT * FROM ${fqTable} WHERE ${whereClause} ${orderBy}
               OFFSET @__offset ROWS FETCH NEXT @__limit ROWS ONLY`,
            ),
            countReq.query(`SELECT COUNT(*) AS [total] FROM ${fqTable} WHERE ${whereClause}`),
          ]);
          recordDuration('findMany', Date.now() - start);

          const items = (dataRes.recordset as Record<string, unknown>[]).map((r) =>
            mapper.fromDbRow(r),
          );
          const total = (countRes.recordset[0] as { total: number }).total;
          return ok({ items, total, limit: page.limit, offset: page.offset });
        } catch (e) {
          return err(mapMssqlError(e));
        }
      });
    },

    async count(filter?: Filter<TEntity>): Promise<Result<number, PersistenceError>> {
      return withSpan('count', async () => {
        const params: Record<string, unknown> = {};
        let filterClause = '1=1';

        if (filter) {
          const translated = translateFilter(filter, validColumns, params);
          if (translated.isErr()) {
            return err(new PersistenceError('UNKNOWN', translated.error.message));
          }
          filterClause = translated.value.sql;
        }

        const start = Date.now();
        try {
          const req = pool.request();
          bindParams(req, params);
          const res = await req.query(
            `SELECT COUNT(*) AS [total] FROM ${fqTable} WHERE [_archived_at] IS NULL AND (${filterClause})`,
          );
          recordDuration('count', Date.now() - start);
          return ok((res.recordset[0] as { total: number }).total);
        } catch (e) {
          return err(mapMssqlError(e));
        }
      });
    },

    async create(entity: TEntity): Promise<Result<TEntity, PersistenceError | ConflictError>> {
      return withSpan('create', async () => {
        const row = mapper.toDbRow(entity);
        const cols = Object.keys(row);
        const vals = Object.values(row);
        const colList = cols.map((c) => `[${c}]`).join(', ');
        const paramNames = cols.map((_, i) => `@c${String(i)}`).join(', ');

        const start = Date.now();
        try {
          const req = pool.request();
          cols.forEach((_, i) => req.input(`c${String(i)}`, vals[i]));
          const res = await req.query(
            `INSERT INTO ${fqTable} (${colList})
             OUTPUT INSERTED.*
             VALUES (${paramNames})`,
          );
          recordDuration('create', Date.now() - start);
          const inserted = res.recordset[0] as Record<string, unknown> | undefined;
          if (!inserted) {
            return err(
              new PersistenceError('UNKNOWN', `INSERT into ${config.table} returned no row`),
            );
          }
          return ok(mapper.fromDbRow(inserted));
        } catch (e) {
          const num = mssqlErrorNumber(e);
          if (num === 2627 || num === 2601) {
            return err(
              new ConflictError(`Duplicate entry in ${config.table}`, { cause: String(e) }),
            );
          }
          return err(mapMssqlError(e));
        }
      });
    },

    async update(
      id: string,
      changes: Partial<Omit<TEntity, 'id'>>,
      opts?: { expectedVersion?: number },
    ): Promise<Result<TEntity, PersistenceError | EntityNotFoundError | ConflictError>> {
      return withSpan('update', async () => {
        const partialRow = mapper.partialToDbRow(changes as Partial<TEntity>);
        partialRow['_updated_at'] = new Date();

        const sets = Object.keys(partialRow)
          .map((col, i) => `[${col}] = @u${String(i)}`)
          .join(', ');
        const vals = Object.values(partialRow);

        let whereClause = `[id] = @id AND [_archived_at] IS NULL`;
        if (opts?.expectedVersion !== undefined) {
          whereClause += ` AND [_version] = @expectedVersion`;
        }

        const start = Date.now();
        try {
          const req = pool.request();
          req.input('id', id);
          vals.forEach((v, i) => req.input(`u${String(i)}`, v));
          if (opts?.expectedVersion !== undefined) {
            req.input('expectedVersion', opts.expectedVersion);
          }

          const res = await req.query(
            `UPDATE ${fqTable}
             SET ${sets}, [_version] = [_version] + 1
             OUTPUT INSERTED.*
             WHERE ${whereClause}`,
          );
          recordDuration('update', Date.now() - start);

          if (res.recordset.length === 0) {
            const checkReq = pool.request();
            checkReq.input('id', id);
            const check = await checkReq.query(
              `SELECT [_version] FROM ${fqTable} WHERE [id] = @id`,
            );
            if (check.recordset.length === 0) {
              return err(new EntityNotFoundError(config.table, id));
            }
            return err(new ConflictError('Version mismatch — concurrent update detected'));
          }

          return ok(mapper.fromDbRow(res.recordset[0] as Record<string, unknown>));
        } catch (e) {
          return err(mapMssqlError(e));
        }
      });
    },

    async archive(id: string): Promise<Result<void, PersistenceError | EntityNotFoundError>> {
      return withSpan('archive', async () => {
        const start = Date.now();
        try {
          const req = pool.request();
          req.input('id', id);
          const res = await req.query(
            `UPDATE ${fqTable}
             SET [_archived_at] = SYSUTCDATETIME()
             WHERE [id] = @id AND [_archived_at] IS NULL`,
          );
          recordDuration('archive', Date.now() - start);
          if (res.rowsAffected[0] === 0) {
            return err(new EntityNotFoundError(config.table, id));
          }
          return ok(undefined);
        } catch (e) {
          return err(mapMssqlError(e));
        }
      });
    },

    async hardDelete(id: string): Promise<Result<void, PersistenceError | EntityNotFoundError>> {
      return withSpan('hardDelete', async () => {
        logger?.warn('Hard delete invoked', { table: config.table, id });
        const start = Date.now();
        try {
          const req = pool.request();
          req.input('id', id);
          const res = await req.query(`DELETE FROM ${fqTable} WHERE [id] = @id`);
          recordDuration('hardDelete', Date.now() - start);
          if (res.rowsAffected[0] === 0) {
            return err(new EntityNotFoundError(config.table, id));
          }
          return ok(undefined);
        } catch (e) {
          return err(mapMssqlError(e));
        }
      });
    },
  };
}
