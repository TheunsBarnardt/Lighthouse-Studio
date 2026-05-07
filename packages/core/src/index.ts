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

export { WorkspaceAssetService } from './services/workspace-asset.service.js';
export type {
  ListByCategoryInput,
  ReplaceWorkspaceAssetInput,
  UploadWorkspaceAssetInput,
} from './services/workspace-asset.service.js';
export type {
  ConsumedAssetEntry,
  ConsumedAssetSnapshot,
  StaleAssetEntry,
  StalenessCheck,
} from '@platform/ports-workspace-assets';

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
  // Query Console
  QueryConsoleService,
  QueryClassifierImpl,
  QueryConsoleAutocomplete,
  QUERY_PERMISSIONS,
  QUERY_DEFAULTS,
  QUERY_AUDIT_EVENTS,
} from './services/data-management/index.js';
export type {
  // Query Console types
  QueryClassifierPort,
  QueryClassification,
  ClassifyInput,
  CompletionItem,
  QueryPermission,
  QueryAuditEventType,
  QueryHistoryRecord,
  SavedQuery,
  ExecuteQueryInput,
  ExplainQueryInput,
  SaveQueryInput,
  UpdateSavedQueryInput,
  ListHistoryOptions,
  ListSavedQueriesOptions,
  ExportInput,
  ExecuteQueryResult,
  ConfirmationRequired,
  QueryStatus,
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

// ── Storage Module ────────────────────────────────────────────────────────────
export {
  StorageService,
  StorageQuotaExceededError,
  StorageReconciliationJob,
  STORAGE_AUDIT_EVENTS,
} from './services/data-management/storage/index.js';
export type {
  StorageRealtimeEvent,
  StorageAuditEventType,
} from './services/data-management/storage/index.js';
export {
  MULTIPART_THRESHOLD_BYTES,
  MAX_FILE_SIZE_BYTES,
  DEFAULT_QUOTA_BYTES,
  DEFAULT_SIGNED_URL_TTL_SECONDS,
  MAX_SIGNED_URL_TTL_SECONDS,
} from './services/data-management/storage/index.js';

// ── Platform versioning & upgrade (Objective 9.5) ────────────────────────────
export { PLATFORM_VERSION } from './platform/version.js';
export { UpgradeOrchestrator, UpgradeError } from './upgrade/orchestrator.js';
export type {
  DbTarget,
  RollbackResult,
  UpgradeErrorCode,
  UpgradeOptions,
  UpgradeOrchestratorDeps,
  UpgradeResult,
} from './upgrade/orchestrator.js';
export { parseReleaseManifest, ReleaseManifestSchema } from './upgrade/release-manifest.js';
export type { ReleaseManifest } from './upgrade/release-manifest.js';

// ── Auth UI Services (Objective 16) ──────────────────────────────────────────
export { AvatarService } from './services/avatar.service.js';
export type { UploadAvatarInput } from './services/avatar.service.js';
export { InvitationFlowService } from './services/invitation-flow.service.js';
export { UserSearchService } from './services/user-search.service.js';
export type { UserSearchQuery } from './services/user-search.service.js';
export { BrandingService } from './services/branding.service.js';
export type { WorkspaceBranding, WorkspaceBrandingRecord } from './services/branding.service.js';
export { EmailTemplateService, TEMPLATE_KEYS } from './services/email-template.service.js';
export type {
  TemplateKey,
  TemplateContext,
  RenderedEmail,
  TemplateOverride,
  WorkspaceEmailTemplateRecord,
} from './services/email-template.service.js';

// ── AI Pipeline Foundation (Objective 20) ─────────────────────────────────────
export type {
  ArtifactStatus,
  ReasoningRecord,
  QualitySignals,
  Artifact,
  PromptResult,
  GenerationOptions,
  PromptDefinition,
} from './services/ai/types.js';
export { ArtifactStatusSchema, ReasoningRecordSchema } from './services/ai/types.js';

// ── Intent Capture (Objective 21) ─────────────────────────────────────────────
export type {
  IntentGoal,
  IntentPersona,
  IntentConstraint,
  IntentBrief,
  IntentBriefInput,
} from './services/ai/intent-capture/types.js';
export {
  IntentGoalSchema,
  IntentPersonaSchema,
  IntentConstraintSchema,
  IntentBriefSchema,
} from './services/ai/intent-capture/types.js';

// ── PRD Generation (Objective 22) ─────────────────────────────────────────────
export type {
  PrdSectionType,
  TraceabilityRef,
  AcceptanceCriterion,
  MetricAcceptanceCriterion,
  OverviewContent,
  GoalEntry,
  GoalsAndSuccessMetricsContent,
  PersonaEntry,
  TargetUsersContent,
  UserStory,
  UserStoriesContent,
  FunctionalRequirement,
  FunctionalRequirementsContent,
  NfrCategory,
  NonFunctionalRequirement,
  NonFunctionalRequirementsContent,
  ConstraintEntry,
  AssumptionEntry,
  ConstraintsAndAssumptionsContent,
  OutOfScopeItem,
  OutOfScopeContent,
  OpenQuestion,
  OpenQuestionsContent,
  RiskEntry,
  RisksAndMitigationsContent,
  PrdSectionContent,
  PrdSection,
  PrdGenerationMetadata,
  PrdQualitySignals,
  Prd,
  ConsistencyIssue,
  ConsistencyReport,
  TraceabilityGap,
  TraceabilityReport,
  StalenessIndicator,
  PrdTemplate,
  GeneratePrdOptions,
  SectionEdit,
  StalenessReport,
  GeneratePrdInput,
  RegenerateSectionInput,
  EditSectionInput,
  ExportPrdInput,
  PrdArtifact,
} from './services/ai/prd-generation/types.js';
export {
  PRD_SECTION_TYPES,
  PrdSectionTypeSchema,
  GeneratePrdInputSchema,
  RegenerateSectionInputSchema,
  EditSectionInputSchema,
  ExportPrdInputSchema,
} from './services/ai/prd-generation/types.js';
export { PRD_AUDIT_EVENTS } from './services/ai/prd-generation/audit-events.js';
export type { PrdAuditEventType } from './services/ai/prd-generation/audit-events.js';
export {
  PRD_PERMISSIONS,
  PRD_DEFAULT_ROLE_GRANTS,
} from './services/ai/prd-generation/permissions.js';
export type { PrdPermission } from './services/ai/prd-generation/permissions.js';
export {
  SECTION_DEPENDENCIES,
  getGenerationWaves,
  getTopologicalOrder,
  getDependents,
} from './services/ai/prd-generation/section-dependencies.js';
export { PrdGenerationService } from './services/ai/prd-generation/prd-generation.service.js';
export type {
  PrdArtifactRepository,
  PrdSectionRepository,
  IntentBriefRepository,
  PrdTemplateRepository,
} from './services/ai/prd-generation/prd-generation.service.js';
export {
  BUILTIN_TEMPLATES,
  getBuiltinTemplate,
} from './services/ai/prd-generation/templates/index.js';
export { definePrompt } from './services/ai/define-prompt.js';
export type { PromptConfig } from './services/ai/define-prompt.js';
export { GenerationService } from './services/ai/generation.service.js';
