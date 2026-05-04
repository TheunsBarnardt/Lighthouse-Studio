// Domain entities and service layer — business logic lives here.

// ── Errors ────────────────────────────────────────────────────────────────────
export {
  AppError,
  ApprovalAlreadyResolvedError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  ExternalServiceError,
  ForbiddenError,
  InternalError,
  InvitationAlreadyAcceptedError,
  InvitationExpiredError,
  NotFoundError,
  NotSupportedError,
  OwnerSelfOrphanError,
  RateLimitError,
  TimeoutError,
  ValidationError,
  WorkspaceContextRequiredError,
} from './errors.js';
export type { AppErrorCode, AppErrorKind } from './errors.js';

// ── Context ───────────────────────────────────────────────────────────────────
export {
  auditMeta,
  isInstallationAdmin,
  isInstallationAuditor,
  isInstallationOwner,
  makeSystemContext,
  requireWorkspaceId,
} from './context.js';

// ── Repository helpers ────────────────────────────────────────────────────────
export { bindToContext } from './repositories/context-bound-repo.js';

// ── Observability helpers ──────────────────────────────────────────────────────
export { observable } from './observability/observable.js';
export type { ObservabilityDeps } from './observability/observable.js';

// ── Idempotency ────────────────────────────────────────────────────────────────
export {
  hashIdempotencyKey,
  withIdempotency,
  DEFAULT_IDEMPOTENCY_WINDOW_MS,
} from './idempotency/index.js';
export type { IdempotencyRecord } from './idempotency/index.js';

// ── Services ──────────────────────────────────────────────────────────────────
export { WorkspaceService } from './services/workspace.service.js';
export type {
  ArchiveWorkspaceInput,
  CreateWorkspaceInput,
  TransferOwnershipInput,
  UpdateWorkspaceInput,
} from './services/workspace.service.js';

export { MemberService } from './services/member.service.js';
export type {
  AddMemberInput,
  ChangeRoleInput,
  RemoveMemberInput,
} from './services/member.service.js';

export { InvitationService } from './services/invitation.service.js';
export type { CreateInvitationInput } from './services/invitation.service.js';

export { AuthService } from './services/auth.service.js';
export type {
  BeginSignInInput,
  CompleteSignInInput,
  SessionResult,
  SignInResult,
} from './services/auth.service.js';

export { DataSubjectService } from './services/data-subject.service.js';
export type {
  DataSubjectAccessRequest,
  ErasureRequest,
  ErasureRequestOptions,
} from './services/data-subject.service.js';

export { AuditRetentionService } from './services/audit-retention.service.js';
export type {
  RetentionEnforcementResult,
  WorkspaceRetentionSettings,
} from './services/audit-retention.service.js';

// ── Approval routing ──────────────────────────────────────────────────────────
export { ApprovalRoutingEngine } from './approvals/approval-routing.engine.js';
export type { BlockReason, EvaluationInput, RoutingDecision } from './approvals/types.js';

// ── Data Management Module ────────────────────────────────────────────────────
export {
  SchemaService,
  SchemaValidator,
  MigrationPlanner,
  SCHEMA_AUDIT_EVENTS,
  API_AUDIT_EVENTS,
  customerNamespace,
  customerCollectionName,
  customerAppRole,
  customerMigrateRole,
  createWorkspacePostgresSchema,
  createWorkspaceMssqlSchema,
  dropWorkspacePostgresSchema,
  isReservedSlug,
  RESERVED_SLUG_PREFIXES,
  PII_HEURISTIC_NAMES,
  listTemplates,
  getTemplate,
  PerWorkspaceRepositoryFactory,
  ApiRequestHandler,
  FilterParserImpl,
  ApiKeyService,
  OpenApiGenerator,
  CAPABILITIES,
  getCapability,
  // GraphQL
  GraphQLRequestHandler,
  GraphQLSchemaBuilder,
  DataLoaderFactory,
  makeConnection,
  encodeCursor,
  decodeCursor,
  GRAPHQL_AUDIT_EVENTS,
} from './services/data-management/index.js';
export type {
  CustomerSchema,
  CustomerTableDefinition,
  ColumnDefinition as CustomerColumnDefinition,
  IndexDefinition as CustomerIndexDefinition,
  ForeignKeyDefinition as CustomerForeignKeyDefinition,
  SchemaVersion,
  DatabaseDriver,
  NormalizedType,
  PiiCategory,
  SchemaChanges,
  CreateSchemaInput,
  UpdateSchemaInput,
  DeleteSchemaOptions,
  ImportSchemaInput,
  ValidationReport,
  ValidationIssue,
  MigrationPlan,
  MigrationStep,
  MigrationPreview,
  MigrationResult,
  SchemaAuditEventType,
  ApiAuditEventType,
  SchemaTemplate,
  // API types
  ApiRequest,
  ApiResponse,
  HttpMethod,
  FilterParser,
  FilterParseError,
  ApiKey,
  ApiKeyPrincipal,
  OpenApiDocument,
  WorkspaceInfo,
  // Capability matrix
  CapabilityMatrix,
  CapabilityStatus,
  // GraphQL types
  GraphQLApiRequest,
  GraphQLApiResponse,
  GraphQLContext,
  ConnectionArgs,
  RequestLoaders,
  Connection,
  GraphQLAuditEventType,
} from './services/data-management/index.js';
