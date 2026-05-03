// ── Data Management Module ─────────────────────────────────────────────────────

export { SchemaService } from './schema.service.js';
export { SchemaValidator } from './schema-validator.js';
export { MigrationPlanner } from './migration-planner.js';
export { SCHEMA_AUDIT_EVENTS } from './audit-events.js';
export type { SchemaAuditEventType } from './audit-events.js';

export {
  customerNamespace,
  customerCollectionName,
  customerAppRole,
  customerMigrateRole,
  createWorkspacePostgresSchema,
  createWorkspaceMssqlSchema,
  dropWorkspacePostgresSchema,
  isReservedSlug,
  RESERVED_SLUG_PREFIXES,
} from './namespace.js';

export { PII_HEURISTIC_NAMES } from './schema-model.js';

export type {
  // Core domain types
  CustomerSchema,
  CustomerTableDefinition,
  ColumnDefinition,
  IndexDefinition,
  ForeignKeyDefinition,
  ConstraintDefinition,
  SchemaVersion,
  SchemaMigrationRecord,
  DatabaseDriver,
  NormalizedType,
  PiiCategory,
  PrimaryKeyDefinition,
  DefaultValueExpression,
  GeneratedExpression,
  FullTextSearchConfig,
  RlsConfig,
  RlsPolicy,
  PartialIndexCondition,
  MigrationStatus,
  // Change types
  SchemaChanges,
  // Input types
  CreateSchemaInput,
  UpdateSchemaInput,
  DeleteSchemaOptions,
  ImportSchemaInput,
  // Validation types
  ValidationReport,
  ValidationIssue,
  IssueSeverity,
  // Migration plan types
  MigrationPlan,
  MigrationStep,
  MigrationPreview,
  MigrationResult,
  MigrationOutcome,
  DestructiveChange,
  BlockingChange,
  // Pagination
  ListOptions,
  PaginatedResult,
} from './schema-model.js';

export {
  CreateSchemaInputSchema,
  UpdateSchemaInputSchema,
  DeleteSchemaOptionsSchema,
  ImportSchemaInputSchema,
} from './schema-model.js';

export { listTemplates, getTemplate } from './templates/index.js';
export type { SchemaTemplate } from './templates/index.js';
