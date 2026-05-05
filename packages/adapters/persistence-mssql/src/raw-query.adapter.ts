import type {
  ColumnMeta,
  QueryPlan,
  RawExecuteOptions,
  RawQueryPort,
  RawQueryResult,
} from '@platform/ports-persistence';

import { PersistenceError } from '@platform/ports-persistence';
import * as mssql from 'mssql';
import { err, ok, type Result } from 'neverthrow';

// ── Named-parameter → @p1, @p2, ... conversion ───────────────────────────────

interface ConvertedQuery {
  text: string;
  inputs: Array<{ name: string; value: unknown }>;
}

function convertNamedParams(
  query: string,
  parameters: Record<string, unknown>,
): ConvertedQuery {
  const inputs: Array<{ name: string; value: unknown }> = [];
  const nameToParam = new Map<string, string>();

  const text = query.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_match, name: string) => {
    if (!nameToParam.has(name)) {
      const paramName = `p${String(inputs.length + 1)}`;
      inputs.push({ name: paramName, value: parameters[name] ?? null });
      nameToParam.set(name, paramName);
    }
    return `@${nameToParam.get(name)}`;
  });

  return { text, inputs };
}

// ── LIMIT injection (TOP for T-SQL) ──────────────────────────────────────────

function injectRowLimit(query: string, limit: number): string {
  // Only inject TOP on outermost SELECT if not already present
  const trimmed = query.trim().replace(/;+$/, '');
  if (/^\s*SELECT\s+TOP\s+\d+/i.test(trimmed)) return query;
  return trimmed.replace(/^\s*SELECT\s+/i, `SELECT TOP ${String(limit)} `);
}

// ── Adapter ───────────────────────────────────────────────────────────────────

export interface MssqlRawQueryPools {
  readonly: mssql.ConnectionPool;
  console_writer: mssql.ConnectionPool;
}

export class MssqlRawQueryAdapter implements RawQueryPort {
  constructor(private readonly pools: MssqlRawQueryPools) {}

  async execute(opts: RawExecuteOptions): Promise<Result<RawQueryResult, PersistenceError>> {
    const pool = this.pools[opts.role];
    const start = Date.now();

    try {
      const request = pool.request();

      // Set query timeout
      request.timeout = opts.timeoutMs;

      // Bind named parameters
      const { text, inputs } = convertNamedParams(opts.query, opts.parameters);
      for (const { name, value } of inputs) {
        request.input(name, value);
      }

      const limitedQuery = injectRowLimit(text, opts.rowLimit);
      const result = await request.query(limitedQuery);

      const rows = (result.recordset as Record<string, unknown>[]) ?? [];
      const truncated = rows.length > opts.rowLimit;
      const limited = rows.slice(0, opts.rowLimit);

      const columns: ColumnMeta[] = result.recordset.columns
        ? Object.entries(result.recordset.columns).map(([name, meta]) => ({
            name,
            dataType: String((meta as Record<string, unknown>)['type'] ?? 'unknown'),
          }))
        : [];

      return ok({
        rows: limited,
        rowCount: result.rowsAffected[0] ?? limited.length,
        truncated,
        durationMs: Date.now() - start,
        columns,
      });
    } catch (cause) {
      return err(mapMssqlError(cause));
    }
  }

  async explain(opts: RawExecuteOptions): Promise<Result<QueryPlan, PersistenceError>> {
    const pool = this.pools[opts.role];
    const start = Date.now();

    try {
      // Use SET SHOWPLAN_ALL for text-based plan (SHOWPLAN_XML requires additional parsing)
      const setupReq = pool.request();
      await setupReq.query('SET SHOWPLAN_XML ON');

      const planReq = pool.request();
      planReq.timeout = opts.timeoutMs;
      const { text, inputs } = convertNamedParams(opts.query, opts.parameters);
      for (const { name, value } of inputs) {
        planReq.input(name, value);
      }
      const result = await planReq.query(text);

      await pool.request().query('SET SHOWPLAN_XML OFF');

      return ok({
        format: 'xml',
        plan: result.recordset,
        durationMs: Date.now() - start,
      });
    } catch (cause) {
      // Ensure SHOWPLAN_XML is turned off even on error
      await pool.request().query('SET SHOWPLAN_XML OFF').catch(() => undefined);
      return err(mapMssqlError(cause));
    }
  }
}

// ── Error mapping ─────────────────────────────────────────────────────────────

function mapMssqlError(cause: unknown): PersistenceError {
  if (cause instanceof mssql.RequestError) {
    if (cause.code === 'ETIMEOUT')
      return new PersistenceError('TIMEOUT', 'MSSQL query timeout', cause);
    if (cause.code === 'ELOGIN' || cause.number === 229)
      return new PersistenceError('PERMISSION_DENIED', 'MSSQL permission denied', cause);
  }
  return new PersistenceError('UNKNOWN', `MSSQL query failed: ${String(cause)}`, cause);
}
