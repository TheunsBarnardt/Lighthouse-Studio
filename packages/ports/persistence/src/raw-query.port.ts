import type { Result } from 'neverthrow';

import type { PersistenceError } from './errors.js';

// ── Query language ────────────────────────────────────────────────────────────

export type QueryLanguage = 'sql_postgres' | 'sql_mssql' | 'mongo_aggregate' | 'mongo_find';

export type QueryRole = 'readonly' | 'console_writer';

// ── Column metadata ───────────────────────────────────────────────────────────

export interface ColumnMeta {
  name: string;
  dataType: string;
}

// ── Query plan ────────────────────────────────────────────────────────────────

export interface QueryPlan {
  format: 'json' | 'xml' | 'text';
  /** Parsed plan; exact shape depends on the database. */
  plan: unknown;
  durationMs: number;
}

// ── Execute options ───────────────────────────────────────────────────────────

export interface RawExecuteOptions {
  /** Platform workspace ID — used for connection routing and audit. */
  workspaceId: string;
  /** The workspace's customer namespace / schema name. */
  customerSchema: string;
  query: string;
  parameters: Record<string, unknown>;
  language: QueryLanguage;
  /** Database role to connect as. */
  role: QueryRole;
  /** Maximum query duration in milliseconds. */
  timeoutMs: number;
  /** Maximum number of rows to return. */
  rowLimit: number;
  abortSignal?: AbortSignal;
  /** When true, the adapter wraps execution in an explicit transaction (BEGIN/COMMIT/ROLLBACK). */
  wrapInTransaction?: boolean;
}

// ── Result ────────────────────────────────────────────────────────────────────

export interface RawQueryResult {
  rows: Record<string, unknown>[];
  /** Total rows returned by the DB before row-limit truncation. */
  rowCount: number;
  /** True if the row limit was hit and more rows exist. */
  truncated: boolean;
  durationMs: number;
  columns: ColumnMeta[];
}

// ── Port interface ────────────────────────────────────────────────────────────

export interface RawQueryPort {
  /**
   * Execute an ad-hoc query against the workspace's customer database.
   *
   * The adapter enforces:
   * - Statement timeout at the database level
   * - Row limit (LIMIT injection or stream truncation)
   * - Named-parameter binding (no string interpolation)
   * - Connection isolation (own connection, not shared with API traffic)
   */
  execute(opts: RawExecuteOptions): Promise<Result<RawQueryResult, PersistenceError>>;

  /**
   * Run EXPLAIN / execution plan analysis on the query.
   * For Postgres: EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
   * For MSSQL: SET SHOWPLAN_XML ON then the query
   * For Mongo: aggregate.explain('executionStats')
   */
  explain(opts: RawExecuteOptions): Promise<Result<QueryPlan, PersistenceError>>;
}
