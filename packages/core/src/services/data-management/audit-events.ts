// ── Data Management audit event types ─────────────────────────────────────────
// Extends the global AUDIT_EVENTS catalog in packages/core/src/compliance/audit-events.ts.
// All event types follow the pattern: data_management.<entity>.<action>

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
} as const;

export type SchemaAuditEventType = (typeof SCHEMA_AUDIT_EVENTS)[keyof typeof SCHEMA_AUDIT_EVENTS];
