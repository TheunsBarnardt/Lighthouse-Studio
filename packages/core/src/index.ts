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

// ── AI Build Pipeline — Objective 20 ─────────────────────────────────────────
export { definePrompt, registerPrompt, getPrompt, getAllPrompts } from './ai/define-prompt.js';
export type { PromptDefinition, PromptExample, PromptTest } from './ai/define-prompt.js';
export { defineTool, toProviderToolDefinition } from './ai/define-tool.js';
export type { PlatformToolDefinition } from './ai/define-tool.js';
export { ToolRegistry } from './ai/tool-registry.js';

export { PromptService } from './services/ai/prompt.service.js';
export type { RenderedPrompt } from './services/ai/prompt.service.js';
export { CostTrackingService, estimateCostUsd } from './services/ai/cost-tracking.service.js';
export type { RecordUsageInput } from './services/ai/cost-tracking.service.js';
export { ArtifactService } from './services/ai/artifact.service.js';
export type {
  CreateArtifactServiceInput,
  UpdateArtifactServiceInput,
} from './services/ai/artifact.service.js';
export { StagePipelineService } from './services/ai/stage-pipeline.service.js';
export { GenerationService } from './services/ai/generation.service.js';
export type { GenerateInput, GenerationResult } from './services/ai/generation.service.js';

// ── AI Build Pipeline — Objective 21 (Intent Capture) ─────────────────────────
export { IntentCaptureService } from './services/ai/intent-capture/intent-capture.service.js';
export type {
  StartConversationInput,
  SendMessageInput,
  ListConversationsOptions,
  ListTemplatesOptions,
} from './services/ai/intent-capture/intent-capture.service.js';
export type {
  IntentBrief,
  Conversation,
  ConversationMessage,
  ConversationEvent,
  BriefDraft,
  BriefEdit,
  BriefFieldStatus,
  BriefFieldState,
  Goal,
  TargetUser,
  SuccessCriterion,
  Constraint,
  Assumption,
  Risk,
  Reference,
  IntentBriefTemplate,
} from './services/ai/intent-capture/types.js';
export {
  IntentBriefSchema,
  GoalSchema,
  TargetUserSchema,
  SuccessCriterionSchema,
  ConstraintSchema,
  AssumptionSchema,
  RiskSchema,
  ReferenceSchema,
} from './services/ai/intent-capture/types.js';
export { INTENT_CAPTURE_AUDIT_EVENTS } from './services/ai/intent-capture/audit-events.js';
export {
  INTENT_CAPTURE_PERMISSIONS,
  INTENT_CAPTURE_ROLE_GRANTS,
} from './services/ai/intent-capture/permissions.js';
export {
  BUILT_IN_TEMPLATES,
  getBuiltInTemplates,
} from './services/ai/intent-capture/templates/index.js';

// ── AI Build Pipeline — Objective 22 (PRD Generation) ─────────────────────────
export { PrdGenerationService } from './services/ai/prd-generation/index.js';
export type {
  ListPrdsOptions,
  ListPrdTemplatesOptions,
} from './services/ai/prd-generation/index.js';
export type {
  Prd,
  PrdSection,
  PrdSectionType,
  PrdTemplate,
  SectionEdit,
  GeneratePrdOptions,
  GeneratePrdInput,
  ConsistencyReport,
  ConsistencyIssue,
  TraceabilityReport,
  TraceabilityGap,
  StalenessReport,
  StalenessIndicator,
  SectionStatus,
  FunctionalRequirement,
  NonFunctionalRequirement,
  AcceptanceCriterion,
  TraceabilityRef,
  LockedDecision,
  HardPart,
  ComponentSpec,
  ImplementationStep,
  AdrStub,
  VerificationStep,
  DodItem,
  AntiPattern,
  OpenQuestion,
} from './services/ai/prd-generation/index.js';
export { PRD_SECTION_TYPES, SECTION_DEPENDENCIES } from './services/ai/prd-generation/index.js';
export { PRD_AUDIT_EVENTS } from './services/ai/prd-generation/index.js';
export { PRD_GENERATION_PERMISSIONS, PRD_GENERATION_ROLE_GRANTS } from './services/ai/prd-generation/index.js';
export { BUILT_IN_PRD_TEMPLATES, getBuiltInPrdTemplates, getBuiltInPrdTemplate } from './services/ai/prd-generation/index.js';

// ── AI Build Pipeline — Objective 23 (Design Tokens) ──────────────────────────
export { DesignTokensService } from './services/ai/design-tokens/index.js';
export type { DesignTokenArtifact } from './services/ai/design-tokens/index.js';
export { DESIGN_TOKENS_AUDIT_EVENTS } from './services/ai/design-tokens/index.js';
export { DESIGN_TOKENS_PERMISSIONS, DESIGN_TOKENS_DEFAULT_GRANTS } from './services/ai/design-tokens/index.js';
export { validateContrast, validateTokenSetAccessibility, contrastRatio, hexToOklch, oklchToHex, generateColorScale, oklchToCss } from './services/ai/design-tokens/index.js';
export type { OklchColor } from './services/ai/design-tokens/index.js';
export type {
  BrandInputs,
  BrandColor,
  ColorScale,
  ColorTokens,
  TypographyTokens,
  SpacingTokens,
  SizingTokens,
  BorderRadiusTokens,
  ShadowTokens,
  MotionTokens,
  ZIndexTokens,
  BreakpointTokens,
  DesignTokenSet,
  TokenCategory,
  ExportFormat,
  AccessibilityReport,
  ContrastResult,
  DesignConsistencyReport,
  GenerateTokensInput,
} from './services/ai/design-tokens/index.js';
export { TOKEN_CATEGORIES, DesignTokenSetSchema } from './services/ai/design-tokens/index.js';

// ── AI Build Pipeline — Objective 24 (Schema Synthesis) ───────────────────────
export { SchemaSynthesisService } from './services/ai/schema-synthesis/index.js';
export type { SchemaSynthesisArtifact } from './services/ai/schema-synthesis/index.js';
export { SCHEMA_SYNTHESIS_AUDIT_EVENTS, SCHEMA_SYNTHESIS_PERMISSIONS, SCHEMA_SYNTHESIS_DEFAULT_GRANTS, DEFAULT_CAPABILITY_CONTEXTS } from './services/ai/schema-synthesis/index.js';
export { SynthesizeSchemaInputSchema } from './services/ai/schema-synthesis/index.js';
export type {
  CapabilityContext,
  ExtractedEntity,
  ExtractedRelationship,
  EntityExtractionRecord,
  SynthesizedColumn,
  SynthesizedTable,
  SynthesizedIndex,
  CoverageReport,
  PiiDetection,
  PiiConfirmation,
  PiiDetectionRecord,
  IndexRecommendation,
  SchemaDiff,
  SynthesizeSchemaInput,
  SynthesizedSchema,
  SchemaSynthesisQualitySignals,
} from './services/ai/schema-synthesis/index.js';

// ── AI Build Pipeline — Objective 25 (Data Migration) ─────────────────────────
export { DataMigrationService, TransformationEngine, MigrationExecutor } from './services/ai/data-migration/index.js';
export {
  ConnectSourceInputSchema,
  UploadSourceFileInputSchema,
  GenerateMappingInputSchema,
  MappingPlanChangesSchema,
  ExecuteOptionsSchema,
  DATA_MIGRATION_AUDIT_EVENTS,
  DATA_MIGRATION_PERMISSIONS,
  DATA_MIGRATION_DEFAULT_GRANTS,
} from './services/ai/data-migration/index.js';
export type {
  SourceType,
  SourceForeignKey,
  SourceColumn,
  SourceTable,
  SourceDescription,
  SourceConnection,
  TransformationStep as DataMigrationTransformationStep,
  TransformationLibraryEntry,
  ValidationRule as DataMigrationValidationRule,
  ColumnMapping as DataMigrationColumnMapping,
  TableSplitDef,
  FilterExpression,
  TableMapping as DataMigrationTableMapping,
  ToleranceMode,
  PreExecutionCheck,
  PostExecutionCheck,
  IrreversibleOperation,
  MigrationPlan,
  MigrationPlanStatus,
  MigrationPlanArtifact,
  BatchResult,
  RowError,
  MigrationExecutionStatus,
  MigrationExecution,
  PreviewRow,
  MigrationPreview,
  ValidationFailure as DataMigrationValidationFailure,
  MigrationValidationReport,
  MigrationRollbackResult,
  DataMigrationQualitySignals,
  ConnectSourceInput,
  UploadSourceFileInput,
  GenerateMappingInput,
  MappingPlanChanges,
  ExecuteOptions,
  DataMigrationAuditEventType,
  ExecutorDeps,
  TransformationContext,
  TransformationResult,
} from './services/ai/data-migration/index.js';

// ─── Objective 26: UI Generation ─────────────────────────────────────────────
export { UiGenerationService, AccessibilityValidator, TypeChecker } from './services/ai/ui-generation/index.js';
export type {
  InformationArchitecture,
  PageDefinition,
  PageType,
  NavigationDefinition,
  NavigationItem,
  AuthPageDefinition,
  LayoutDefinition,
  ComponentSpec,
  ComponentType,
  ProjectFile,
  FileType,
  AxeViolation,
  AccessibilityReport,
  TypeCheckReport,
  ConsistencyReport,
  ComponentQualitySignals,
  UiComponent,
  BuildConfig,
  UiProject,
  UiProjectStatus,
  UiProjectArtifact,
  UiGenerationQualitySignals,
  GenerateProjectInput,
  GenerateIaInput,
  RegenerateComponentInput,
  UiGenerationAuditEventType,
  TraceabilityRef,
  PermissionRequirement,
  ComponentRef,
  PropDefinition,
} from './services/ai/ui-generation/index.js';
export {
  GenerateProjectInputSchema,
  GenerateIaInputSchema,
  RegenerateComponentInputSchema,
  UI_GENERATION_AUDIT_EVENTS,
  UI_GENERATION_PERMISSIONS,
  UI_GENERATION_DEFAULT_GRANTS,
} from './services/ai/ui-generation/index.js';

// ─── Objective 26.5: App Chrome ───────────────────────────────────────────────
export { AppChromeService, STARTER_CHROME_BLOCKS, getChromeBlocksForRegion, getChromeBlockById } from './services/ai/app-chrome/index.js';
export type {
  ChromeRegion,
  ChromeLayout,
  ChromeBlockParam,
  ChromeBlock,
  ChromeRegionConfig,
  PageChromeOverride,
  AppChromeConfig,
  ChromeProposalRegion,
  ChromeProposal,
  UpdateChromeConfigInput,
  ProposeChromeInput,
  ApplyChromeProposalInput,
  AppChromeAuditEventType,
} from './services/ai/app-chrome/index.js';
export {
  UpdateChromeConfigInputSchema,
  ProposeChromInputSchema,
  ApplyChromeProposalInputSchema,
  APP_CHROME_AUDIT_EVENTS,
  APP_CHROME_PERMISSIONS,
  APP_CHROME_DEFAULT_GRANTS,
} from './services/ai/app-chrome/index.js';

// ─── Objective 27: Code Generation ───────────────────────────────────────────
export { CodeGenerationService, StaticAnalyzer, IntegrationCatalog } from './services/ai/code-generation/index.js';
export type {
  FunctionTriggerType,
  HttpTriggerConfig,
  ScheduleTriggerConfig,
  EventTriggerConfig,
  ManualTriggerConfig,
  TriggerConfig,
  FieldDefinition,
  FunctionSpec,
  FunctionInventory,
  RateLimitConfig,
  FunctionManifestEntry,
  ServerManifest,
  StaticViolationType,
  StaticViolation,
  StaticAnalysisReport,
  FunctionValidationReport,
  ServerCodeQualitySignals,
  ServerFunctionFile,
  ReasoningRecord,
  ServerFunctionStatus,
  ServerFunction,
  ServerCodeProjectStatus,
  ServerBuildConfig,
  ServerCodeProject,
  CodeGenerationQualitySignals,
  IntegrationCategory,
  CodeExample,
  IntegrationDescriptor,
  GenerateInventoryInput,
  GenerateFunctionInput,
  RegenerateFunctionInput,
  RollbackFunctionInput,
  CodeGenerationAuditEventType,
} from './services/ai/code-generation/index.js';
export {
  GenerateInventoryInputSchema,
  GenerateFunctionInputSchema,
  RegenerateFunctionInputSchema,
  RollbackFunctionInputSchema,
  CODE_GENERATION_AUDIT_EVENTS,
  CODE_GENERATION_PERMISSIONS,
  CODE_GENERATION_DEFAULT_GRANTS,
} from './services/ai/code-generation/index.js';

// ── Objective 28: Test Generation ─────────────────────────────────────────────
export { TestGenerationService } from './services/ai/test-generation/index.js';
export type {
  TestType,
  TestCase,
  TestPlan,
  TestSuite,
  TestFile,
  TestFileStatus,
  TestSuiteStatus,
  TestRunStatus,
  TestRun,
  TestRunResults,
  TestFailure,
  CoverageReport,
  FileCoverage,
  AcCoverageReport,
  TestBuildConfig,
  TestGenerationQualitySignals,
  GenerateTestPlanInput,
  GenerateTestSuiteInput,
  RunTestsInput,
  RegenerateTestInput,
} from './services/ai/test-generation/index.js';
export {
  GenerateTestPlanInputSchema,
  GenerateTestSuiteInputSchema,
  RunTestsInputSchema,
  RegenerateTestInputSchema,
  TEST_GENERATION_AUDIT_EVENTS,
  TEST_GENERATION_PERMISSIONS,
  TEST_GENERATION_DEFAULT_GRANTS,
} from './services/ai/test-generation/index.js';

// ── Objective 29: Deployment ───────────────────────────────────────────────────
export { DeploymentService } from './services/ai/deployment/index.js';
export type {
  DeployMode,
  DeploymentStepType,
  StepStatus,
  DeploymentStatus,
  DeploymentEventType,
  HealthCheckConfig,
  EnvironmentDeploymentConfig,
  SchemaMigrationStep,
  IrreversibleOperation,
  DeploymentPlan,
  DeploymentStep,
  HealthCheckResults,
  Deployment,
  DeploymentSummary,
  DeploymentEvent,
  DeploymentQualitySignals,
  GeneratePlanInput,
  UpdatePlanInput,
  DeployToEnvironmentInput,
  RollbackInput,
  DeploymentAuditEventType,
} from './services/ai/deployment/index.js';
export {
  GeneratePlanInputSchema,
  UpdatePlanInputSchema,
  DeployToEnvironmentInputSchema,
  RollbackInputSchema,
  DEPLOYMENT_AUDIT_EVENTS,
  DEPLOYMENT_PERMISSIONS,
  DEPLOYMENT_DEFAULT_GRANTS,
} from './services/ai/deployment/index.js';

// ── Objective 30: Maintenance & Evolution ─────────────────────────────────────
export { MaintenanceService } from './services/ai/maintenance/index.js';
export type {
  SignalSource,
  SignalSeverity,
  SignalStatus,
  ErrorSignalDetails,
  PerfSignalDetails,
  UserReportDetails,
  DependencyAdvisoryDetails,
  StageClassificationEntry,
  SignalClassification,
  Signal,
  ChangeRequestStatus,
  ChangeRequestPriority,
  OutcomeMetrics,
  ChangeRequest,
  DependencyAdvisory,
  CascadeStatus,
  AffectedArtifact,
  AffectedDownstreamReport,
  OutcomeReport,
  MaintenanceQualitySignals,
  IngestSignalInput,
  CreateChangeRequestInput,
  ResolveChangeRequestInput,
  MaintenanceAuditEventType,
} from './services/ai/maintenance/index.js';
export {
  IngestSignalInputSchema,
  CreateChangeRequestInputSchema,
  ResolveChangeRequestInputSchema,
  MAINTENANCE_AUDIT_EVENTS,
  MAINTENANCE_PERMISSIONS,
  MAINTENANCE_DEFAULT_GRANTS,
} from './services/ai/maintenance/index.js';

// ── Objective 31: Auto-Generated Documentation ────────────────────────────────
export { DocsService } from './services/ai/docs/index.js';
export type {
  DocSourceType,
  DocPageStatus,
  DocExportStatus,
  DocSection,
  DocPage,
  DocSiteConfig,
  DocSite,
  DocExport,
  DocTelemetryEvent,
  DocSyncTrigger,
  DocsAuditEventType,
  GenerateDocPageInput,
  UpdateDocPageInput,
  ExportDocSiteInput,
  SyncFromSourceInput,
  IngestTelemetryInput,
} from './services/ai/docs/index.js';
export {
  GenerateDocPageInputSchema,
  UpdateDocPageInputSchema,
  ExportDocSiteInputSchema,
  SyncFromSourceInputSchema,
  IngestTelemetryInputSchema,
  DOCS_AUDIT_EVENTS,
  DOCS_PERMISSIONS,
  DOCS_DEFAULT_GRANTS,
} from './services/ai/docs/index.js';
