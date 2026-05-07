// ── Data Management audit event types ─────────────────────────────────────────
// Extends the global AUDIT_EVENTS catalog in packages/core/src/compliance/audit-events.ts.
// All event types follow the pattern: data_management.<entity>.<action>

export const API_AUDIT_EVENTS = {
  // Row mutations — emitted on every successful mutating operation
  ROW_CREATED: 'data_management.api.row_created',
  ROW_UPDATED: 'data_management.api.row_updated',
  ROW_ARCHIVED: 'data_management.api.row_archived',
  ROW_RESTORED: 'data_management.api.row_restored',
  ROW_HARD_DELETED: 'data_management.api.row_hard_deleted',

  // Bulk mutations — one event per operation, not per row
  BULK_CREATED: 'data_management.api.bulk_created',
  BULK_UPDATED: 'data_management.api.bulk_updated',
  BULK_DELETED: 'data_management.api.bulk_deleted',

  // Access control events
  READ_DENIED: 'data_management.api.read_denied',
  RATE_LIMITED: 'data_management.api.rate_limited',

  // API key lifecycle
  API_KEY_CREATED: 'data_management.api.api_key_created',
  API_KEY_REVOKED: 'data_management.api.api_key_revoked',
  // Sampled — not emitted on every request, only periodically
  API_KEY_USED: 'data_management.api.api_key_used',
} as const;

export type ApiAuditEventType = (typeof API_AUDIT_EVENTS)[keyof typeof API_AUDIT_EVENTS];

export const SCHEMA_AUDIT_EVENTS = {
  SCHEMA_CREATED: 'data_management.schema.created',
  SCHEMA_UPDATED: 'data_management.schema.updated',
  SCHEMA_DELETED: 'data_management.schema.deleted',
  SCHEMA_EXPORTED: 'data_management.schema.exported',
  SCHEMA_IMPORTED: 'data_management.schema.imported',
  SCHEMA_DEPLOYED: 'data_management.schema.deployed',
  SCHEMA_DEPLOY_FAILED: 'data_management.schema.deploy_failed',
  SCHEMA_ROLLED_BACK: 'data_management.schema.rolled_back',
  SCHEMA_VALIDATION_FAILED: 'data_management.schema.validation_failed',
  /** Emitted on every successful deploy that includes PII-tagged columns. Feeds the personal data registry. */
  SCHEMA_PII_COLUMNS_REGISTERED: 'data_management.schema.pii_columns_registered',
} as const;

export type SchemaAuditEventType = (typeof SCHEMA_AUDIT_EVENTS)[keyof typeof SCHEMA_AUDIT_EVENTS];

export const GRAPHQL_AUDIT_EVENTS = {
  // Sampled — not emitted on every query
  QUERY_EXECUTED: 'data_management.graphql.query_executed',
  // Always emitted; includes mutation name, table, and correlation id
  MUTATION_EXECUTED: 'data_management.graphql.mutation_executed',
  // Emitted when a query exceeds the configured limit
  QUERY_COMPLEXITY_EXCEEDED: 'data_management.graphql.query_complexity_exceeded',
  QUERY_DEPTH_EXCEEDED: 'data_management.graphql.query_depth_exceeded',
  // Persisted query lifecycle
  PERSISTED_QUERY_REGISTERED: 'data_management.graphql.persisted_query_registered',
  PERSISTED_QUERY_REVOKED: 'data_management.graphql.persisted_query_revoked',
  // Sampled — useful for security review
  INTROSPECTION_QUERY: 'data_management.graphql.introspection_query',
} as const;

export type GraphQLAuditEventType =
  (typeof GRAPHQL_AUDIT_EVENTS)[keyof typeof GRAPHQL_AUDIT_EVENTS];

export const REALTIME_AUDIT_EVENTS = {
  // Connection lifecycle
  CONNECTION_OPENED: 'data_management.realtime.connection_opened',
  CONNECTION_CLOSED: 'data_management.realtime.connection_closed',
  // Subscription lifecycle
  SUBSCRIPTION_STARTED: 'data_management.realtime.subscription_started',
  SUBSCRIPTION_ENDED: 'data_management.realtime.subscription_ended',
  SUBSCRIPTION_RESUMED: 'data_management.realtime.subscription_resumed',
  // Security events — always audited
  CONNECTION_FORCE_CLOSED: 'data_management.realtime.connection_force_closed',
  // Operational events
  EVENTS_DROPPED: 'data_management.realtime.events_dropped',
  RATE_LIMIT_EXCEEDED: 'data_management.realtime.rate_limit_exceeded',
} as const;

export type RealtimeAuditEventType =
  (typeof REALTIME_AUDIT_EVENTS)[keyof typeof REALTIME_AUDIT_EVENTS];

export const QUERY_AUDIT_EVENTS = {
  // Always audited — console queries are higher-stakes than API reads
  EXECUTED: 'data_management.query.executed',
  EXECUTED_WRITE: 'data_management.query.executed_write',
  TIMED_OUT: 'data_management.query.timed_out',
  CANCELLED: 'data_management.query.cancelled',
  FAILED: 'data_management.query.failed',
  // Security events
  DDL_ATTEMPTED: 'data_management.query.ddl_attempted',
  WRITE_DENIED: 'data_management.query.write_denied',
  // Export lifecycle
  EXPORTED: 'data_management.query.exported',
  // Saved query lifecycle
  SAVED: 'data_management.query.saved',
  UPDATED: 'data_management.query.updated',
  SHARED: 'data_management.query.shared',
  DELETED_SAVE: 'data_management.query.deleted_save',
} as const;

export type QueryAuditEventType = (typeof QUERY_AUDIT_EVENTS)[keyof typeof QUERY_AUDIT_EVENTS];

export const BROWSER_AUDIT_EVENTS = {
  // Saved view lifecycle
  VIEW_CREATED: 'data_management.browser.view_created',
  VIEW_UPDATED: 'data_management.browser.view_updated',
  VIEW_DELETED: 'data_management.browser.view_deleted',
  VIEW_SHARED: 'data_management.browser.view_shared',
  // Import lifecycle
  IMPORT_STARTED: 'data_management.browser.import_started',
  IMPORT_COMPLETED: 'data_management.browser.import_completed',
  IMPORT_FAILED: 'data_management.browser.import_failed',
  IMPORT_CANCELLED: 'data_management.browser.import_cancelled',
  // Export lifecycle
  EXPORT_STARTED: 'data_management.browser.export_started',
  EXPORT_COMPLETED: 'data_management.browser.export_completed',
  // Bulk operations — one event per operation, not per row
  BULK_ACTION_INITIATED: 'data_management.browser.bulk_action_initiated',
} as const;

export type BrowserAuditEventType =
  (typeof BROWSER_AUDIT_EVENTS)[keyof typeof BROWSER_AUDIT_EVENTS];
