import type {
  ColumnMeta,
  QueryPlan,
  RawExecuteOptions,
  RawQueryPort,
  RawQueryResult,
} from '@platform/ports-persistence';
import type { Pool, FieldDef } from 'pg';

import { PersistenceError } from '@platform/ports-persistence';
import { err, ok, type Result } from 'neverthrow';

// ── Named-parameter → positional conversion ───────────────────────────────────

interface ConvertedQuery {
  text: string;
  values: unknown[];
}

function convertNamedParams(query: string, parameters: Record<string, unknown>): ConvertedQuery {
  const values: unknown[] = [];
  const nameToIndex = new Map<string, number>();

  const text = query.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_match, name: string) => {
    if (!nameToIndex.has(name)) {
      values.push(parameters[name] ?? null);
      nameToIndex.set(name, values.length);
    }
    return `$${String(nameToIndex.get(name))}`;
  });

  return { text, values };
}

// ── LIMIT injection ───────────────────────────────────────────────────────────
// Appends LIMIT if the outermost SELECT has none. Operates on SQL text only —
// the adapter does NOT use a full AST here; the classifier already validated the query.

function injectRowLimit(query: string, limit: number): string {
  const trimmed = query.trim().replace(/;+$/, '');
  // Avoid double-injecting if LIMIT is already present at the top level
  const hasTopLevelLimit = /\bLIMIT\s+\d+\s*$/i.test(trimmed);
  if (hasTopLevelLimit) return query;
  return `${trimmed} LIMIT ${String(limit)}`;
}

// ── Column metadata extraction ────────────────────────────────────────────────

function extractColumns(fields: readonly FieldDef[]): ColumnMeta[] {
  return fields.map((f) => ({
    name: f.name,
    dataType: String(f.dataTypeID),
  }));
}

// ── Per-role pool factory ─────────────────────────────────────────────────────

export interface RawQueryPools {
  readonly: Pool;
  console_writer: Pool;
  /** Optional read replica pool for read-only console queries. Falls back to `readonly` if absent. */
  readonlyReplica?: Pool;
}

// ── Adapter ───────────────────────────────────────────────────────────────────

export class PostgresRawQueryAdapter implements RawQueryPort {
  constructor(private readonly pools: RawQueryPools) {}

  private _poolFor(role: 'readonly' | 'console_writer'): Pool {
    if (role === 'readonly' && this.pools.readonlyReplica) {
      return this.pools.readonlyReplica;
    }
    return this.pools[role];
  }

  async execute(opts: RawExecuteOptions): Promise<Result<RawQueryResult, PersistenceError>> {
    const pool = this._poolFor(opts.role);
    const client = await pool.connect();
    const start = Date.now();
    let timedOut = false;

    // Obtain the backend PID so we can cancel it via abortSignal
    let backendPid: number | null = null;
    try {
      const pidResult = await client.query('SELECT pg_backend_pid() AS pid');
      backendPid = (pidResult.rows[0] as { pid: number }).pid;
    } catch {
      // Non-fatal — cancel won't work but the query can still proceed
    }

    // Wire abort signal: send pg_cancel_backend when triggered
    const onAbort = () => {
      if (backendPid !== null) {
        // Use a separate pool client to cancel — fire-and-forget
        void pool.query(`SELECT pg_cancel_backend($1)`, [backendPid]).catch(() => undefined);
      }
    };

    opts.abortSignal?.addEventListener('abort', onAbort);

    try {
      // Bail immediately if already aborted before query starts
      if (opts.abortSignal?.aborted) {
        return err(new PersistenceError('CANCELLED', 'Query was cancelled before execution'));
      }

      // Statement-level timeout (database enforces this)
      await client.query(`SET statement_timeout = ${String(opts.timeoutMs)}`);

      if (opts.wrapInTransaction) {
        await client.query('BEGIN');
      }

      // Convert :name params to $1, $2, ...
      const { text, values } = convertNamedParams(opts.query, opts.parameters);

      // Inject row limit on the query text
      const limitedQuery = injectRowLimit(text, opts.rowLimit);

      let result;
      try {
        result = await client.query(limitedQuery, values);
        if (opts.wrapInTransaction) {
          await client.query('COMMIT');
        }
      } catch (innerCause) {
        if (opts.wrapInTransaction) {
          await client.query('ROLLBACK').catch(() => undefined);
        }
        throw innerCause;
      }

      const rows = result.rows as Record<string, unknown>[];
      const truncated = rows.length > opts.rowLimit;
      const limited = rows.slice(0, opts.rowLimit);

      return ok({
        rows: limited,
        rowCount: result.rowCount ?? limited.length,
        truncated,
        durationMs: Date.now() - start,
        columns: extractColumns(result.fields),
      });
    } catch (cause) {
      const dur = Date.now() - start;
      timedOut = dur >= opts.timeoutMs;
      // A cancellation surfaces as a specific pg error code
      if (opts.abortSignal?.aborted || (cause as { code?: string }).code === '57014') {
        return err(new PersistenceError('CANCELLED', 'Query was cancelled'));
      }
      return err(mapPgError(cause));
    } finally {
      opts.abortSignal?.removeEventListener('abort', onAbort);
      // Destroy the client on timeout or cancel to prevent leaving queries running
      const dur = Date.now() - start;
      if (timedOut || dur >= opts.timeoutMs || opts.abortSignal?.aborted) {
        client.release(true);
      } else {
        client.release();
      }
    }
  }

  async explain(opts: RawExecuteOptions): Promise<Result<QueryPlan, PersistenceError>> {
    const pool = this.pools[opts.role];
    const client = await pool.connect();
    const start = Date.now();

    try {
      await client.query(`SET statement_timeout = ${String(opts.timeoutMs)}`);

      const { text, values } = convertNamedParams(opts.query, opts.parameters);
      const explainQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${text}`;

      const result = await client.query(explainQuery, values);
      const plan = (result.rows[0] as Record<string, unknown>)['QUERY PLAN'] ?? result.rows;

      return ok({
        format: 'json',
        plan,
        durationMs: Date.now() - start,
      });
    } catch (cause) {
      return err(mapPgError(cause));
    } finally {
      client.release();
    }
  }
}

// ── Error mapping ─────────────────────────────────────────────────────────────

function mapPgError(cause: unknown): PersistenceError {
  const code = (cause as { code?: string }).code;
  if (code === '57014') return new PersistenceError('TIMEOUT', 'Query statement timeout', cause);
  if (code === '42501')
    return new PersistenceError('PERMISSION_DENIED', 'Permission denied', cause);
  if (code?.startsWith('42'))
    return new PersistenceError('PERMISSION_DENIED', 'Database permission error', cause);
  if (code === '40P01') return new PersistenceError('DEADLOCK', 'Deadlock detected', cause);
  return new PersistenceError('UNKNOWN', `Query execution failed: ${String(cause)}`, cause);
}
