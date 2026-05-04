// ── Data Management Module ─────────────────────────────────────────────────────

export { SchemaService } from './schema.service.js';
export { SchemaValidator } from './schema-validator.js';
export { MigrationPlanner } from './migration-planner.js';
export { SCHEMA_AUDIT_EVENTS, API_AUDIT_EVENTS } from './audit-events.js';
export type { SchemaAuditEventType, ApiAuditEventType } from './audit-events.js';

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

export { PerWorkspaceRepositoryFactory } from './per-workspace-repository-factory.js';
export { ApiRequestHandler } from './api-request-handler.js';
export type { ApiRequest, ApiResponse, HttpMethod } from './api-request-handler.js';
export { FilterParserImpl } from './filter-parser.js';
export type { FilterParser, FilterParseError } from './filter-parser.js';
export { ApiKeyService } from './api-key.service.js';
export type { ApiKey, ApiKeyPrincipal } from './api-key.service.js';
export { OpenApiGenerator } from './openapi-generator.js';
export type { OpenApiDocument, WorkspaceInfo } from './openapi-generator.js';

export { listTemplates, getTemplate } from './templates/index.js';
export type { SchemaTemplate } from './templates/index.js';

export { CAPABILITIES, getCapability } from './capabilities.js';
export type { CapabilityMatrix, CapabilityStatus } from './capabilities.js';
// DatabaseDriver is re-exported from capabilities but the canonical source is schema-model (already exported above)

// ── GraphQL API ────────────────────────────────────────────────────────────────
export { GraphQLRequestHandler } from './graphql/request-handler.js';
export type {
  GraphQLApiRequest,
  GraphQLApiResponse,
  GraphQLContext,
  ConnectionArgs,
} from './graphql/request-handler.js';
export { GraphQLSchemaBuilder } from './graphql/schema-builder.js';
export { DataLoaderFactory } from './graphql/dataloader-factory.js';
export type { RequestLoaders } from './graphql/dataloader-factory.js';
export { makeConnection, encodeCursor, decodeCursor } from './graphql/connection.js';
export type { Connection } from './graphql/connection.js';
export { GRAPHQL_AUDIT_EVENTS } from './audit-events.js';
export type { GraphQLAuditEventType } from './audit-events.js';
