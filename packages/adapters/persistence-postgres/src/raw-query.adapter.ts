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

// ── Statement splitter ────────────────────────────────────────────────────────
// Splits multi-statement SQL on semicolons, ignoring those inside string literals.
// The classifier already validated the statements so we trust the input is parseable.

function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDollarQuote = false;
  let dollarTag = '';
  let i = 0;

  while (i < sql.length) {
    const ch = sql[i] as string;

    if (!inSingleQuote && !inDollarQuote && ch === "'") {
      inSingleQuote = true;
      current += ch;
    } else if (inSingleQuote && ch === "'") {
      inSingleQuote = false;
      current += ch;
    } else if (!inSingleQuote && !inDollarQuote && ch === '$') {
      // Detect dollar-quoting ($$...$$)
      const rest = sql.slice(i);
      const tagMatch = /^\$([^$]*)\$/.exec(rest);
      if (tagMatch) {
        if (dollarTag === tagMatch[0]) {
          inDollarQuote = false;
          dollarTag = '';
          current += tagMatch[0];
          i += tagMatch[0].length;
          continue;
        } else {
          inDollarQuote = true;
          dollarTag = tagMatch[0];
          current += tagMatch[0];
          i += tagMatch[0].length;
          continue;
        }
      }
      current += ch;
    } else if (!inSingleQuote && !inDollarQuote && ch === ';') {
      const trimmed = current.trim();
      if (trimmed) statements.push(trimmed);
      current = '';
    } else {
      current += ch;
    }
    i++;
  }

  const trimmed = current.trim();
  if (trimmed) statements.push(trimmed);
  return statements;
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

      // Convert :name params to $1, $2, ...
      const { text, values } = convertNamedParams(opts.query, opts.parameters);

      if (opts.wrapInTransaction) {
        // Multi-statement write: run each statement individually inside a transaction
        // to collect per-statement row counts. Simple semicolon split is safe here
        // because the classifier already validated the statements.
        const statements = splitStatements(text);
        await client.query('BEGIN');
        const statementsAffected: { statement: number; rowsAffected: number }[] = [];
        let lastResult;
        try {
          for (let i = 0; i < statements.length; i++) {
            const stmt = statements[i];
            if (!stmt) continue;
            lastResult = await client.query(stmt, i === 0 ? values : []);
            statementsAffected.push({ statement: i + 1, rowsAffected: lastResult.rowCount ?? 0 });
          }
          await client.query('COMMIT');
        } catch (innerCause) {
          await client.query('ROLLBACK').catch(() => undefined);
          throw innerCause;
        }
        const rows = (lastResult?.rows ?? []) as Record<string, unknown>[];
        const totalRows = statementsAffected.reduce((s, r) => s + r.rowsAffected, 0);
        return ok({
          rows,
          rowCount: totalRows,
          truncated: false,
          durationMs: Date.now() - start,
          columns: lastResult ? extractColumns(lastResult.fields) : [],
          statementsAffected,
        });
      }

      // Single statement: inject row limit and execute normally
      const limitedQuery = injectRowLimit(text, opts.rowLimit);
      const result = await client.query(limitedQuery, values);

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
