import type { LoggerPort, MetricsPort, TracerPort } from '@platform/ports-observability';
import type { Result } from 'neverthrow';
import type { Pool } from 'pg';

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

export interface PostgresTableConfig {
  /** Database schema name, e.g. "public". */
  schema: string;
  /** Table name, e.g. "projects". */
  table: string;
  /**
   * Exhaustive list of valid column names.
   * Used to validate filter field names before executing queries.
   */
  columns: ReadonlyArray<string>;
}

// ── Error mapping ─────────────────────────────────────────────────────────────

function pgErrorCode(err: unknown): string | undefined {
  return (err as { code?: string }).code;
}

function mapPgError(cause: unknown): PersistenceError {
  const code = pgErrorCode(cause);
  if (code === '23505')
    return new PersistenceError('CONSTRAINT_VIOLATION', 'Unique constraint violation', cause);
  if (code === '40P01') return new PersistenceError('DEADLOCK', 'Deadlock detected', cause);
  if (code === '57014') return new PersistenceError('TIMEOUT', 'Statement timeout', cause);
  if (code?.startsWith('42'))
    return new PersistenceError('PERMISSION_DENIED', 'Permission denied', cause);
  return new PersistenceError('UNKNOWN', `Database error: ${String(cause)}`, cause);
}

// ── Sort builder ──────────────────────────────────────────────────────────────

function buildOrderBy<TEntity>(sort: Sort<TEntity>, validColumns: ReadonlyArray<string>): string {
  const parts: string[] = [];
  for (const [field, dir] of Object.entries(sort)) {
    if (validColumns.includes(field) && (dir === 'asc' || dir === 'desc')) {
      parts.push(`"${field}" ${dir.toUpperCase()}`);
    }
  }
  return parts.length > 0 ? `ORDER BY ${parts.join(', ')}` : '';
}

// ── Factory ───────────────────────────────────────────────────────────────────

export interface PostgresRepositoryDeps {
  logger?: LoggerPort;
  metrics?: MetricsPort;
  tracer?: TracerPort;
}

/**
 * Creates a RepositoryPort<TEntity> backed by a PostgreSQL table.
 *
 * The adapter assumes every table has the standard lifecycle columns from schema/_common.ts:
 *   id, _version, _archived_at, _created_at, _updated_at
 *
 * All queries are parameterised. No SQL concatenation of values.
 */
export function createPostgresRepository<TEntity extends { id: string }>(
  pool: Pool,
  config: PostgresTableConfig,
  mapper: EntityMapper<TEntity>,
  deps?: PostgresRepositoryDeps,
): RepositoryPort<TEntity> {
  const { logger, metrics, tracer } = deps ?? {};
  const fqTable = `"${config.schema}"."${config.table}"`;
  const validColumns = config.columns;

  const durationHistogram = metrics?.histogram('platform_postgres_query_duration_seconds', {
    description: 'Postgres query duration',
    boundaries: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
  });
  const slowQueryCounter = metrics?.counter('platform_postgres_slow_queries_total', {
    description: 'Number of Postgres queries exceeding 1 second',
  });

  function recordDuration(operation: string, durationMs: number): void {
    durationHistogram?.record(durationMs / 1000, { operation, table: config.table });
    if (durationMs > 1000) {
      slowQueryCounter?.add(1, { operation, table: config.table });
      logger?.warn('Slow Postgres query', {
        operation,
        table: config.table,
        duration_ms: durationMs,
      });
    }
  }

  async function withSpan<T>(name: string, fn: () => Promise<T>): Promise<T> {
    if (tracer) {
      return tracer.withSpan(`db.${name}`, fn);
    }
    return fn();
  }

  return {
    // ── findById ──────────────────────────────────────────────────────────────

    async findById(id: string): Promise<Result<TEntity | null, PersistenceError>> {
      return withSpan('findById', async () => {
        const start = Date.now();
        try {
          const res = await pool.query(
            `SELECT * FROM ${fqTable} WHERE "id" = $1 AND "_archived_at" IS NULL LIMIT 1`,
            [id],
          );
          recordDuration('findById', Date.now() - start);
          const row = res.rows[0] as Record<string, unknown> | undefined;
          return ok(row ? mapper.fromDbRow(row) : null);
        } catch (e) {
          return err(mapPgError(e));
        }
      });
    },

    // ── findOne ───────────────────────────────────────────────────────────────

    async findOne(filter: Filter<TEntity>): Promise<Result<TEntity | null, PersistenceError>> {
      return withSpan('findOne', async () => {
        const params: unknown[] = [];
        const translated = translateFilter(filter, validColumns, params);
        if (translated.isErr()) {
          return err(new PersistenceError('UNKNOWN', translated.error.message));
        }

        const start = Date.now();
        try {
          const res = await pool.query(
            `SELECT * FROM ${fqTable} WHERE "_archived_at" IS NULL AND (${translated.value.sql}) LIMIT 1`,
            params,
          );
          recordDuration('findOne', Date.now() - start);
          const row = res.rows[0] as Record<string, unknown> | undefined;
          return ok(row ? mapper.fromDbRow(row) : null);
        } catch (e) {
          return err(mapPgError(e));
        }
      });
    },

    // ── findMany ──────────────────────────────────────────────────────────────

    async findMany(opts?: {
      filter?: Filter<TEntity>;
      sort?: Sort<TEntity>;
      page?: Page;
      includeArchived?: boolean;
    }): Promise<Result<PaginatedResult<TEntity>, PersistenceError>> {
      return withSpan('findMany', async () => {
        const params: unknown[] = [];
        const archivedClause = opts?.includeArchived ? 'TRUE' : '"_archived_at" IS NULL';
        let filterClause = 'TRUE';

        if (opts?.filter) {
          const translated = translateFilter(opts.filter, validColumns, params);
          if (translated.isErr()) {
            return err(new PersistenceError('UNKNOWN', translated.error.message));
          }
          filterClause = translated.value.sql;
        }

        const orderBy = opts?.sort ? buildOrderBy(opts.sort, validColumns) : '';
        const page = opts?.page ?? { limit: 100, offset: 0 };

        params.push(page.limit);
        params.push(page.offset);

        const whereClause = `${archivedClause} AND (${filterClause})`;

        const start = Date.now();
        try {
          const [dataRes, countRes] = await Promise.all([
            pool.query(
              `SELECT * FROM ${fqTable} WHERE ${whereClause} ${orderBy} LIMIT $${String(params.length - 1)} OFFSET $${String(params.length)}`,
              params,
            ),
            pool.query(
              `SELECT COUNT(*)::int AS total FROM ${fqTable} WHERE ${whereClause}`,
              params.slice(0, params.length - 2),
            ),
          ]);
          recordDuration('findMany', Date.now() - start);

          const items = (dataRes.rows as Record<string, unknown>[]).map((r) => mapper.fromDbRow(r));
          const total = (countRes.rows[0] as { total: number }).total;
          return ok({ items, total, limit: page.limit, offset: page.offset });
        } catch (e) {
          return err(mapPgError(e));
        }
      });
    },

    // ── count ─────────────────────────────────────────────────────────────────

    async count(filter?: Filter<TEntity>): Promise<Result<number, PersistenceError>> {
      return withSpan('count', async () => {
        const params: unknown[] = [];
        let filterClause = 'TRUE';

        if (filter) {
          const translated = translateFilter(filter, validColumns, params);
          if (translated.isErr()) {
            return err(new PersistenceError('UNKNOWN', translated.error.message));
          }
          filterClause = translated.value.sql;
        }

        const start = Date.now();
        try {
          const res = await pool.query(
            `SELECT COUNT(*)::int AS total FROM ${fqTable} WHERE "_archived_at" IS NULL AND (${filterClause})`,
            params,
          );
          recordDuration('count', Date.now() - start);
          return ok((res.rows[0] as { total: number }).total);
        } catch (e) {
          return err(mapPgError(e));
        }
      });
    },

    // ── create ────────────────────────────────────────────────────────────────

    async create(entity: TEntity): Promise<Result<TEntity, PersistenceError | ConflictError>> {
      return withSpan('create', async () => {
        const row = mapper.toDbRow(entity);
        const cols = Object.keys(row);
        const vals = Object.values(row);
        const colList = cols.map((c) => `"${c}"`).join(', ');
        const paramList = vals.map((_, i) => `$${String(i + 1)}`).join(', ');

        const start = Date.now();
        try {
          const res = await pool.query(
            `INSERT INTO ${fqTable} (${colList}) VALUES (${paramList}) RETURNING *`,
            vals,
          );
          recordDuration('create', Date.now() - start);
          return ok(mapper.fromDbRow(res.rows[0] as Record<string, unknown>));
        } catch (e) {
          if (pgErrorCode(e) === '23505') {
            return err(
              new ConflictError(`Duplicate entry in ${config.table}`, { cause: String(e) }),
            );
          }
          return err(mapPgError(e));
        }
      });
    },

    // ── update ────────────────────────────────────────────────────────────────

    async update(
      id: string,
      changes: Partial<Omit<TEntity, 'id'>>,
      opts?: { expectedVersion?: number },
    ): Promise<Result<TEntity, PersistenceError | EntityNotFoundError | ConflictError>> {
      return withSpan('update', async () => {
        const partialRow = mapper.partialToDbRow(changes as Partial<TEntity>);

        // Always refresh _updated_at and increment _version
        partialRow['_updated_at'] = new Date();
        const params: unknown[] = Object.values(partialRow);
        const setClauses = Object.keys(partialRow)
          .map((col, i) => `"${col}" = $${String(i + 1)}`)
          .join(', ');

        let whereClause = `"id" = $${String(params.length + 1)} AND "_archived_at" IS NULL`;
        params.push(id);

        if (opts?.expectedVersion !== undefined) {
          params.push(opts.expectedVersion);
          whereClause += ` AND "_version" = $${String(params.length)}`;
        }

        const start = Date.now();
        try {
          const res = await pool.query(
            `UPDATE ${fqTable} SET ${setClauses}, "_version" = "_version" + 1 WHERE ${whereClause} RETURNING *`,
            params,
          );
          recordDuration('update', Date.now() - start);

          if (res.rowCount === 0) {
            // Check if the row exists at all to distinguish not-found from version conflict
            const check = await pool.query(`SELECT "_version" FROM ${fqTable} WHERE "id" = $1`, [
              id,
            ]);
            if (check.rowCount === 0) {
              return err(new EntityNotFoundError(config.table, id));
            }
            return err(new ConflictError('Version mismatch — concurrent update detected'));
          }

          return ok(mapper.fromDbRow(res.rows[0] as Record<string, unknown>));
        } catch (e) {
          return err(mapPgError(e));
        }
      });
    },

    // ── archive ───────────────────────────────────────────────────────────────

    async archive(id: string): Promise<Result<void, PersistenceError | EntityNotFoundError>> {
      return withSpan('archive', async () => {
        const start = Date.now();
        try {
          const res = await pool.query(
            `UPDATE ${fqTable} SET "_archived_at" = NOW() WHERE "id" = $1 AND "_archived_at" IS NULL`,
            [id],
          );
          recordDuration('archive', Date.now() - start);

          if (res.rowCount === 0) {
            return err(new EntityNotFoundError(config.table, id));
          }
          return ok(undefined);
        } catch (e) {
          return err(mapPgError(e));
        }
      });
    },

    // ── hardDelete ────────────────────────────────────────────────────────────

    async hardDelete(id: string): Promise<Result<void, PersistenceError | EntityNotFoundError>> {
      return withSpan('hardDelete', async () => {
        logger?.warn('Hard delete invoked', { table: config.table, id });

        const start = Date.now();
        try {
          const res = await pool.query(`DELETE FROM ${fqTable} WHERE "id" = $1`, [id]);
          recordDuration('hardDelete', Date.now() - start);

          if (res.rowCount === 0) {
            return err(new EntityNotFoundError(config.table, id));
          }
          return ok(undefined);
        } catch (e) {
          return err(mapPgError(e));
        }
      });
    },
  };
}
