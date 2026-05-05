// ── Query console permission actions ─────────────────────────────────────────
// Added to the platform's permission vocabulary (Objective 6).
//
// Default role grants:
//   workspace_owner, workspace_admin : all query.* permissions
//   architect, developer             : query.read, query.export
//   qa, reviewer, viewer             : query.read
//   (query.write is not granted to any built-in role by default)

export const QUERY_PERMISSIONS = {
  /** Execute SELECT queries via the query console. */
  READ: 'query.read',
  /** Execute INSERT / UPDATE / DELETE queries via the query console. */
  WRITE: 'query.write',
  /** Set query timeout above the workspace default (up to 5 minutes). */
  LONG_RUNNING: 'query.long_running',
  /** Set row limit above the workspace default (up to 100,000). */
  LARGE_RESULT: 'query.large_result',
  /** Export query results to CSV / JSON via signed URL. */
  EXPORT: 'query.export',
} as const;

export type QueryPermission = (typeof QUERY_PERMISSIONS)[keyof typeof QUERY_PERMISSIONS];

// ── Workspace-level tunable settings ─────────────────────────────────────────

export const QUERY_DEFAULTS = {
  TIMEOUT_MS: 30_000,
  MAX_TIMEOUT_MS: 300_000, // 5 minutes
  ROW_LIMIT: 1_000,
  MAX_ROW_LIMIT: 100_000,
  HISTORY_RETENTION_DAYS: 90,
} as const;
