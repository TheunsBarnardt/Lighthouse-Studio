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

import { ConflictError, EntityNotFoundError, PersistenceError } from '@platform/ports-persistence';
import mssql from 'mssql';
import { err, ok } from 'neverthrow';

import { translateFilter } from './filter-translator.js';

// ── System columns ────────────────────────────────────────────────────────────

export const ARCHIVE_COL = '_pf_archived_at';
export const VERSION_COL = '_pf_version';

const SYSTEM_COLS = new Set([ARCHIVE_COL, VERSION_COL]);

// ── Error mapping ─────────────────────────────────────────────────────────────

function mapMssqlError(cause: unknown): PersistenceError {
  const num = (cause as { number?: number }).number;
  if (num === 2627 || num === 2601)
    return new PersistenceError('CONSTRAINT_VIOLATION', 'Unique constraint violation', cause);
  if (num === 1205) return new PersistenceError('DEADLOCK', 'Deadlock detected', cause);
  return new PersistenceError('UNKNOWN', `Database error: ${String(cause)}`, cause);
}

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
      parts.push(`[${field}] ${dir.toUpperCase()}`);
    }
  }
  return parts.length ? `ORDER BY ${parts.join(', ')}` : '';
}

// ── Bind named params into a mssql Request ────────────────────────────────────

function bindParams(req: mssql.Request, params: Record<string, unknown>): void {
  for (const [name, value] of Object.entries(params)) {
    if (value === null || value === undefined) {
      req.input(name, mssql.NVarChar, null);
    } else if (typeof value === 'number' && Number.isInteger(value)) {
      req.input(name, mssql.BigInt, value);
    } else if (typeof value === 'number') {
      req.input(name, mssql.Float, value);
    } else if (typeof value === 'boolean') {
      req.input(name, mssql.Bit, value ? 1 : 0);
    } else if (value instanceof Date) {
      req.input(name, mssql.DateTimeOffset, value);
    } else {
      req.input(name, mssql.NVarChar, value as string);
    }
  }
}

// ── Repository ────────────────────────────────────────────────────────────────

class MssqlCustomerTableRepository implements CustomerTableRepository {
  private readonly fqt: string;

  constructor(
    private readonly pool: mssql.ConnectionPool,
    ns: string,
    tableName: string,
    private readonly pk: string,
    private readonly cols: ReadonlyArray<string>,
  ) {
    this.fqt = `[${ns}].[${tableName}]`;
  }

  private userCols(): ReadonlyArray<string> {
    return this.cols.filter((c) => !SYSTEM_COLS.has(c));
  }

  async findById(id: string): Promise<Result<CustomerRow | null, PersistenceError>> {
    try {
      const req = this.pool.request();
      req.input('pk', mssql.NVarChar, id);
      const res = await req.query(
        `SELECT * FROM ${this.fqt} WHERE [${this.pk}] = @pk AND [${ARCHIVE_COL}] IS NULL`,
      );
      if (res.recordset.length === 0) return ok(null);
      return ok(stripSystem(res.recordset[0] as Record<string, unknown>));
    } catch (e) {
      return err(mapMssqlError(e));
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
      const params: Record<string, unknown> = {};
      const conditions: string[] = [];

      if (!opts?.includeArchived) {
        conditions.push(`[${ARCHIVE_COL}] IS NULL`);
      }

      if (opts?.filter) {
        const translated = translateFilter(opts.filter as Filter<Record<string, unknown>>, [
          ...this.userCols(),
        ]);
        if (translated.isErr())
          return err(new PersistenceError('UNKNOWN', translated.error.message));
        if (translated.value.sql !== 'TRUE') {
          conditions.push(translated.value.sql);
          Object.assign(params, translated.value.params);
        }
      }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const orderBy = opts?.sort
        ? buildOrderBy(opts.sort, [...this.userCols()])
        : `ORDER BY (SELECT NULL)`;
      const limit = opts?.page?.limit ?? 50;
      const offset = opts?.page?.offset ?? 0;

      const countReq = this.pool.request();
      bindParams(countReq, params);
      const countRes = await countReq.query(`SELECT COUNT(*) AS total FROM ${this.fqt} ${where}`);
      const total = Number((countRes.recordset[0] as Record<string, unknown>)['total'] ?? 0);

      // MSSQL rejects FETCH NEXT 0 ROWS; skip data query when limit is 0 (count-only path)
      if (limit === 0) return ok({ items: [], total, limit, offset });

      const dataReq = this.pool.request();
      bindParams(dataReq, params);
      dataReq.input('__limit', mssql.Int, limit);
      dataReq.input('__offset', mssql.Int, offset);
      const dataRes = await dataReq.query(
        `SELECT * FROM ${this.fqt} ${where} ${orderBy} OFFSET @__offset ROWS FETCH NEXT @__limit ROWS ONLY`,
      );
      const items = (dataRes.recordset as Record<string, unknown>[]).map(stripSystem);
      return ok({ items, total, limit, offset });
    } catch (e) {
      return err(mapMssqlError(e));
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
      const fields = Object.keys(entity).filter((k) => !SYSTEM_COLS.has(k));
      const colList = fields.map((k) => `[${k}]`).join(', ');
      const paramNames = fields.map((_, i) => `@c${String(i)}`).join(', ');

      const req = this.pool.request();
      req.input('v', mssql.Int, 1);
      fields.forEach((k, i) => {
        const v = entity[k];
        if (v === null || v === undefined) req.input(`c${String(i)}`, mssql.NVarChar, null);
        else if (typeof v === 'number' && Number.isInteger(v))
          req.input(`c${String(i)}`, mssql.BigInt, v);
        else if (typeof v === 'number') req.input(`c${String(i)}`, mssql.Float, v);
        else if (typeof v === 'boolean') req.input(`c${String(i)}`, mssql.Bit, v ? 1 : 0);
        else req.input(`c${String(i)}`, mssql.NVarChar, v as string);
      });

      const res = await req.query(
        `INSERT INTO ${this.fqt} (${colList}, [${VERSION_COL}]) OUTPUT inserted.* VALUES (${paramNames}, @v)`,
      );
      return ok(stripSystem(res.recordset[0] as Record<string, unknown>));
    } catch (e) {
      if (
        (e as { number?: number }).number === 2627 ||
        (e as { number?: number }).number === 2601
      ) {
        return err(new ConflictError(`Duplicate ${this.pk}: ${String(entity[this.pk])}`));
      }
      return err(mapMssqlError(e));
    }
  }

  async update(
    id: string,
    changes: Partial<CustomerRow>,
    opts?: { expectedVersion?: number },
  ): Promise<Result<CustomerRow, PersistenceError | EntityNotFoundError | ConflictError>> {
    const tx = new mssql.Transaction(this.pool);
    try {
      await tx.begin(mssql.ISOLATION_LEVEL.READ_COMMITTED);

      const lockReq = new mssql.Request(tx);
      lockReq.input('pk', mssql.NVarChar, id);
      const lockRes = await lockReq.query(
        `SELECT [${VERSION_COL}], [${ARCHIVE_COL}] FROM ${this.fqt} WITH (UPDLOCK, ROWLOCK) WHERE [${this.pk}] = @pk`,
      );
      if (lockRes.recordset.length === 0) {
        await tx.rollback();
        return err(new EntityNotFoundError('Row', id));
      }
      const locked = lockRes.recordset[0] as Record<string, unknown>;
      if (locked[ARCHIVE_COL] !== null && locked[ARCHIVE_COL] !== undefined) {
        await tx.rollback();
        return err(new EntityNotFoundError('Row', id));
      }
      if (opts?.expectedVersion !== undefined && locked[VERSION_COL] !== opts.expectedVersion) {
        await tx.rollback();
        return err(
          new ConflictError(
            `Version mismatch: expected ${String(opts.expectedVersion)}, got ${String(locked[VERSION_COL])}`,
          ),
        );
      }

      const fields = Object.keys(changes).filter((k) => !SYSTEM_COLS.has(k));
      if (fields.length === 0) {
        await tx.rollback();
        const row = await this.findById(id);
        if (row.isErr()) return err(row.error);
        return ok(row.value ?? ({} as CustomerRow));
      }

      const setClauses = fields.map((k, i) => `[${k}] = @u${String(i)}`).join(', ');
      const req = new mssql.Request(tx);
      req.input('pk', mssql.NVarChar, id);
      fields.forEach((k, i) => {
        const v = changes[k];
        if (v === null || v === undefined) req.input(`u${String(i)}`, mssql.NVarChar, null);
        else if (typeof v === 'number' && Number.isInteger(v))
          req.input(`u${String(i)}`, mssql.BigInt, v);
        else if (typeof v === 'number') req.input(`u${String(i)}`, mssql.Float, v);
        else if (typeof v === 'boolean') req.input(`u${String(i)}`, mssql.Bit, v ? 1 : 0);
        else req.input(`u${String(i)}`, mssql.NVarChar, v as string);
      });

      const res = await req.query(
        `UPDATE ${this.fqt} SET ${setClauses}, [${VERSION_COL}] = [${VERSION_COL}] + 1 OUTPUT inserted.* WHERE [${this.pk}] = @pk`,
      );
      await tx.commit();
      return ok(stripSystem(res.recordset[0] as Record<string, unknown>));
    } catch (e) {
      await tx.rollback().catch(() => undefined);
      return err(mapMssqlError(e));
    }
  }

  async archive(id: string): Promise<Result<void, PersistenceError | EntityNotFoundError>> {
    try {
      const req = this.pool.request();
      req.input('pk', mssql.NVarChar, id);
      const res = await req.query(
        `UPDATE ${this.fqt} SET [${ARCHIVE_COL}] = SYSDATETIMEOFFSET() WHERE [${this.pk}] = @pk AND [${ARCHIVE_COL}] IS NULL`,
      );
      if (res.rowsAffected[0] === 0) return err(new EntityNotFoundError('Row', id));
      return ok(undefined);
    } catch (e) {
      return err(mapMssqlError(e));
    }
  }

  async restore(id: string): Promise<Result<void, PersistenceError | EntityNotFoundError>> {
    try {
      const req = this.pool.request();
      req.input('pk', mssql.NVarChar, id);
      const res = await req.query(
        `UPDATE ${this.fqt} SET [${ARCHIVE_COL}] = NULL WHERE [${this.pk}] = @pk`,
      );
      if (res.rowsAffected[0] === 0) return err(new EntityNotFoundError('Row', id));
      return ok(undefined);
    } catch (e) {
      return err(mapMssqlError(e));
    }
  }

  async hardDelete(id: string): Promise<Result<void, PersistenceError | EntityNotFoundError>> {
    try {
      const req = this.pool.request();
      req.input('pk', mssql.NVarChar, id);
      const res = await req.query(`DELETE FROM ${this.fqt} WHERE [${this.pk}] = @pk`);
      if (res.rowsAffected[0] === 0) return err(new EntityNotFoundError('Row', id));
      return ok(undefined);
    } catch (e) {
      return err(mapMssqlError(e));
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

export class MssqlCustomerRepositoryProvider implements CustomerRepositoryProviderPort {
  constructor(private readonly pool: mssql.ConnectionPool) {}

  buildRepository(descriptor: CustomerTableDescriptor): CustomerTableRepository {
    return new MssqlCustomerTableRepository(
      this.pool,
      descriptor.namespace,
      descriptor.tableName,
      descriptor.primaryKeyColumn,
      descriptor.columnNames,
    );
  }
}
