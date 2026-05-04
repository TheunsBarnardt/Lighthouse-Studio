import type {
  CustomerRepositoryProviderPort,
  CustomerRow,
  CustomerTableDescriptor,
  CustomerTableRepository,
  Filter,
  PaginatedResult,
  Sort,
} from '@platform/ports-persistence';
import type { Result } from 'neverthrow';
import type { Pool, PoolClient } from 'pg';

import { ConflictError, EntityNotFoundError, PersistenceError } from '@platform/ports-persistence';
import { err, ok } from 'neverthrow';

import { translateFilter } from './filter-translator.js';

// ── System columns injected by the platform into every customer table ──────────

/** Soft-delete timestamp. NULL = active; non-NULL = archived. */
export const ARCHIVE_COL = '_pf_archived_at';
/** Optimistic-locking version counter. */
export const VERSION_COL = '_pf_version';

const SYSTEM_COLS = new Set([ARCHIVE_COL, VERSION_COL]);

// ── Error mapping ─────────────────────────────────────────────────────────────

function mapPgError(cause: unknown): PersistenceError {
  const code = (cause as { code?: string }).code;
  if (code === '23505')
    return new PersistenceError('CONSTRAINT_VIOLATION', 'Unique constraint violation', cause);
  if (code === '40P01') return new PersistenceError('DEADLOCK', 'Deadlock detected', cause);
  if (code === '57014') return new PersistenceError('TIMEOUT', 'Query timeout', cause);
  return new PersistenceError('UNKNOWN', `Database error: ${String(cause)}`, cause);
}

// ── Helper ────────────────────────────────────────────────────────────────────

/** Strip platform system columns from a row before returning to callers. */
function stripSystem(row: Record<string, unknown>): CustomerRow {
  const out: CustomerRow = {};
  for (const [k, v] of Object.entries(row)) {
    if (!SYSTEM_COLS.has(k)) out[k] = v;
  }
  return out;
}

function buildOrderBy(sort: Sort<CustomerRow>, validCols: ReadonlyArray<string>): string {
  const parts: string[] = [];
  for (const [field, dir] of Object.entries(sort)) {
    if (validCols.includes(field) && (dir === 'asc' || dir === 'desc')) {
      parts.push(`"${field}" ${dir.toUpperCase()}`);
    }
  }
  return parts.length ? `ORDER BY ${parts.join(', ')}` : '';
}

// ── Repository implementation ─────────────────────────────────────────────────

class PostgresCustomerTableRepository implements CustomerTableRepository {
  private readonly fqt: string;
  private readonly allCols: ReadonlyArray<string>;

  constructor(
    private readonly pool: Pool,
    ns: string,
    tableName: string,
    private readonly pk: string,
    cols: ReadonlyArray<string>,
  ) {
    this.fqt = `"${ns}"."${tableName}"`;
    // Include system cols for queries; strip on output
    this.allCols = [...cols.filter((c) => !SYSTEM_COLS.has(c)), ARCHIVE_COL, VERSION_COL];
  }

  private userCols(): ReadonlyArray<string> {
    return this.allCols.filter((c) => !SYSTEM_COLS.has(c));
  }

  async findById(id: string): Promise<Result<CustomerRow | null, PersistenceError>> {
    try {
      const res = await this.pool.query(
        `SELECT * FROM ${this.fqt} WHERE "${this.pk}" = $1 AND "${ARCHIVE_COL}" IS NULL`,
        [id],
      );
      if (res.rows.length === 0) return ok(null);
      return ok(stripSystem(res.rows[0] as Record<string, unknown>));
    } catch (e) {
      return err(mapPgError(e));
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
    page?: Page;
    includeArchived?: boolean;
  }): Promise<Result<PaginatedResult<CustomerRow>, PersistenceError>> {
    try {
      const params: unknown[] = [];
      const conditions: string[] = [];

      if (!opts?.includeArchived) {
        conditions.push(`"${ARCHIVE_COL}" IS NULL`);
      }

      if (opts?.filter) {
        const translated = translateFilter(opts.filter as Filter<Record<string, unknown>>, [
          ...this.userCols(),
        ]);
        if (translated.isErr()) {
          return err(new PersistenceError('UNKNOWN', translated.error.message));
        }
        if (translated.value.sql !== 'TRUE') {
          // Offset existing params count
          const reindexed = translated.value.sql.replace(
            /\$(\d+)/g,
            (_, n: string) => `$${String(Number(n) + params.length)}`,
          );
          conditions.push(reindexed);
          params.push(...translated.value.params);
        }
      }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const orderBy = opts?.sort ? buildOrderBy(opts.sort, [...this.userCols()]) : '';
      const limit = opts?.page?.limit ?? 50;
      const offset = opts?.page?.offset ?? 0;

      const countRes = await this.pool.query(
        `SELECT COUNT(*) AS total FROM ${this.fqt} ${where}`,
        params,
      );
      const total = Number((countRes.rows[0] as Record<string, unknown>)['total'] ?? 0);

      const limitParam = `$${String(params.length + 1)}`;
      const offsetParam = `$${String(params.length + 2)}`;
      const dataRes = await this.pool.query(
        `SELECT * FROM ${this.fqt} ${where} ${orderBy} LIMIT ${limitParam} OFFSET ${offsetParam}`,
        [...params, limit, offset],
      );

      const items = (dataRes.rows as Record<string, unknown>[]).map(stripSystem);
      return ok({ items, total, limit, offset });
    } catch (e) {
      return err(mapPgError(e));
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
      const cols = this.userCols().filter((c) => c in entity || c === this.pk);
      const setCols = this.userCols().filter((c) => c in entity);
      const colList = setCols.map((c) => `"${c}"`).join(', ');
      const valList = setCols.map((_, i) => `$${String(i + 1)}`).join(', ');
      const vals = setCols.map((c) => entity[c]);
      void cols;

      const res = await this.pool.query(
        `INSERT INTO ${this.fqt} (${colList}, "${VERSION_COL}") VALUES (${valList}, 1) RETURNING *`,
        vals,
      );
      return ok(stripSystem(res.rows[0] as Record<string, unknown>));
    } catch (e) {
      if ((e as { code?: string }).code === '23505') {
        return err(new ConflictError(`Duplicate ${this.pk}: ${String(entity[this.pk])}`));
      }
      return err(mapPgError(e));
    }
  }

  async update(
    id: string,
    changes: Partial<CustomerRow>,
    opts?: { expectedVersion?: number },
  ): Promise<Result<CustomerRow, PersistenceError | EntityNotFoundError | ConflictError>> {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Lock the row
      const lockRes = await client.query(
        `SELECT "${VERSION_COL}", "${ARCHIVE_COL}" FROM ${this.fqt} WHERE "${this.pk}" = $1 FOR UPDATE`,
        [id],
      );
      if (lockRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return err(new EntityNotFoundError('Row', id));
      }
      const locked = lockRes.rows[0] as Record<string, unknown>;
      if (locked[ARCHIVE_COL] !== null && locked[ARCHIVE_COL] !== undefined) {
        await client.query('ROLLBACK');
        return err(new EntityNotFoundError('Row', id));
      }
      if (opts?.expectedVersion !== undefined && locked[VERSION_COL] !== opts.expectedVersion) {
        await client.query('ROLLBACK');
        return err(
          new ConflictError(
            `Version mismatch: expected ${String(opts.expectedVersion)}, got ${String(locked[VERSION_COL])}`,
          ),
        );
      }

      const fields = Object.keys(changes).filter((k) => !SYSTEM_COLS.has(k));
      if (fields.length === 0) {
        await client.query('ROLLBACK');
        const row = await this.findById(id);
        if (row.isErr()) return err(row.error);
        return ok(row.value ?? ({} as CustomerRow));
      }

      const setClauses = fields.map((k, i) => `"${k}" = $${String(i + 2)}`).join(', ');
      const versionClause = `"${VERSION_COL}" = "${VERSION_COL}" + 1`;
      const vals = [id, ...fields.map((k) => changes[k])];

      const res = await client.query(
        `UPDATE ${this.fqt} SET ${setClauses}, ${versionClause} WHERE "${this.pk}" = $1 RETURNING *`,
        vals,
      );
      await client.query('COMMIT');
      return ok(stripSystem(res.rows[0] as Record<string, unknown>));
    } catch (e) {
      await client.query('ROLLBACK').catch(() => undefined);
      return err(mapPgError(e));
    } finally {
      client.release();
    }
  }

  async archive(id: string): Promise<Result<void, PersistenceError | EntityNotFoundError>> {
    try {
      const res = await this.pool.query(
        `UPDATE ${this.fqt} SET "${ARCHIVE_COL}" = NOW() WHERE "${this.pk}" = $1 AND "${ARCHIVE_COL}" IS NULL`,
        [id],
      );
      if (res.rowCount === 0) return err(new EntityNotFoundError('Row', id));
      return ok(undefined);
    } catch (e) {
      return err(mapPgError(e));
    }
  }

  async restore(id: string): Promise<Result<void, PersistenceError | EntityNotFoundError>> {
    try {
      const res = await this.pool.query(
        `UPDATE ${this.fqt} SET "${ARCHIVE_COL}" = NULL WHERE "${this.pk}" = $1`,
        [id],
      );
      if (res.rowCount === 0) return err(new EntityNotFoundError('Row', id));
      return ok(undefined);
    } catch (e) {
      return err(mapPgError(e));
    }
  }

  async hardDelete(id: string): Promise<Result<void, PersistenceError | EntityNotFoundError>> {
    try {
      const res = await this.pool.query(`DELETE FROM ${this.fqt} WHERE "${this.pk}" = $1`, [id]);
      if (res.rowCount === 0) return err(new EntityNotFoundError('Row', id));
      return ok(undefined);
    } catch (e) {
      return err(mapPgError(e));
    }
  }

  async bulkCreate(
    entities: CustomerRow[],
    opts?: { maxRows?: number },
  ): Promise<Result<CustomerRow[], PersistenceError>> {
    const max = opts?.maxRows ?? 1000;
    if (entities.length > max) {
      return err(new PersistenceError('UNKNOWN', `Bulk create exceeds limit of ${String(max)}`));
    }
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

export class PostgresCustomerRepositoryProvider implements CustomerRepositoryProviderPort {
  constructor(private readonly pool: Pool) {}

  buildRepository(descriptor: CustomerTableDescriptor): CustomerTableRepository {
    return new PostgresCustomerTableRepository(
      this.pool,
      descriptor.namespace,
      descriptor.tableName,
      descriptor.primaryKeyColumn,
      descriptor.columnNames,
    );
  }
}

// ── Type import needed for findMany ──────────────────────────────────────────

interface Page {
  limit: number;
  offset: number;
}
