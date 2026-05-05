import type { QueryLanguage } from '@platform/ports-persistence';

// ── Domain types for the Query Console ────────────────────────────────────────

export type QueryStatus = 'succeeded' | 'failed' | 'timeout' | 'cancelled';

export interface QueryHistoryRecord {
  id: string;
  version: number;
  workspaceId: string;
  userId: string;
  queryText: string;
  queryLanguage: QueryLanguage;
  /** Parameter values; PII-flagged column values are redacted. */
  parameters: Record<string, unknown> | null;
  durationMs: number;
  rowsAffected: number | null;
  errorMessage: string | null;
  status: QueryStatus;
  /** First row schema and a small sample; never full results. */
  resultSummary: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface SavedQuery {
  id: string;
  version: number;
  workspaceId: string;
  createdByUserId: string;
  name: string;
  description: string | null;
  queryText: string;
  queryLanguage: QueryLanguage;
  defaultParameters: Record<string, unknown> | null;
  folderPath: string | null;
  shared: boolean;
  sharedCanRun: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  createdBy: string | null;
  updatedBy: string | null;
}

// ── Input / output types ───────────────────────────────────────────────────────

export interface ExecuteQueryInput {
  workspaceId: string;
  workspaceSlug: string;
  /** Driver for the workspace — determines which adapter and language rules apply. */
  databaseDriver: 'postgres' | 'mssql' | 'mongo';
  query: string;
  language: QueryLanguage;
  parameters?: Record<string, unknown>;
  rowLimit?: number;
  timeoutMs?: number;
  /** For multi-statement writes: user has confirmed in the UI. */
  confirmed?: boolean;
}

export interface ExplainQueryInput {
  workspaceId: string;
  workspaceSlug: string;
  databaseDriver: 'postgres' | 'mssql' | 'mongo';
  query: string;
  language: QueryLanguage;
  parameters?: Record<string, unknown>;
}

export interface SaveQueryInput {
  workspaceId: string;
  name: string;
  description?: string;
  queryText: string;
  queryLanguage: QueryLanguage;
  defaultParameters?: Record<string, unknown>;
  folderPath?: string;
  shared?: boolean;
  sharedCanRun?: boolean;
}

export interface UpdateSavedQueryInput {
  id: string;
  version: number;
  workspaceId: string;
  name?: string;
  description?: string;
  queryText?: string;
  queryLanguage?: QueryLanguage;
  defaultParameters?: Record<string, unknown>;
  folderPath?: string;
  shared?: boolean;
  sharedCanRun?: boolean;
}

export interface ListHistoryOptions {
  workspaceId: string;
  /** When set, filter to a specific user; admins can omit to see all. */
  userId?: string;
  limit: number;
  offset: number;
}

export interface ListSavedQueriesOptions {
  workspaceId: string;
  /** Include shared queries from other users. */
  includeShared?: boolean;
  folderPath?: string;
  limit: number;
  offset: number;
}

export interface ExportInput {
  workspaceId: string;
  workspaceSlug: string;
  databaseDriver: 'postgres' | 'mssql' | 'mongo';
  query: string;
  language: QueryLanguage;
  parameters?: Record<string, unknown>;
  format: 'csv' | 'jsonl';
}

// ── Confirmation required result ──────────────────────────────────────────────

/** Returned by execute() when a write/multi-statement query needs UI confirmation. */
export interface ConfirmationRequired {
  kind: 'confirmation_required';
  statementCount: number;
  affectedTables: string[];
  hasWriteStatements: boolean;
}

export type ExecuteQueryResult =
  | {
      kind: 'result';
      executionId: string;
      rows: Record<string, unknown>[];
      rowCount: number;
      truncated: boolean;
      durationMs: number;
      columns: Array<{ name: string; dataType: string }>;
      /** Per-statement row counts for multi-statement write queries. */
      statementsAffected?: { statement: number; rowsAffected: number }[];
    }
  | ConfirmationRequired;
