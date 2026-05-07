import { z } from 'zod';

// ── Source Description ────────────────────────────────────────────────────────

export type SourceType = 'postgres' | 'mssql' | 'mysql' | 'mongo' | 'csv' | 'json' | 'excel';

export interface SourceForeignKey {
  columns: string[];
  referencedTable: string;
  referencedColumns: string[];
}

export interface SourceColumn {
  id: string;
  name: string;
  type: string;
  inferredType?: string;
  nullable: boolean;
  hasDefault: boolean;
  uniqueValues?: number;
  sampleValues: unknown[];
}

export interface SourceTable {
  id: string;
  name: string;
  columns: SourceColumn[];
  rowCount: number;
  sampleRows: Record<string, unknown>[];
  primaryKey?: string[];
  foreignKeys?: SourceForeignKey[];
}

export interface SourceDescription {
  type: SourceType;
  identifier: string;
  tables: SourceTable[];
  totalRowCount: number;
  totalSizeBytes?: number;
  introspectedAt: Date;
}

// ── Source Connection ─────────────────────────────────────────────────────────

export interface SourceConnection {
  id: string;
  workspaceId: string;
  type: SourceType;
  identifier: string;
  status: 'connected' | 'introspecting' | 'ready' | 'error' | 'disconnected';
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ── Transformations ───────────────────────────────────────────────────────────

export interface TransformationStep {
  type: string;
  parameters: Record<string, unknown>;
  customExpression?: string;
}

export interface TransformationLibraryEntry {
  type: string;
  displayName: string;
  description: string;
  parameterSchema: Record<string, unknown>;
  example: { input: unknown; output: unknown };
}

// ── Migration Plan ────────────────────────────────────────────────────────────

export interface ValidationRule {
  type: 'not_null' | 'max_length' | 'regex' | 'range' | 'custom';
  parameters: Record<string, unknown>;
  errorMessage?: string;
}

export interface ColumnMapping {
  sourceColumnId: string | null;
  targetColumnId: string;
  literalValue?: unknown;
  transformations: TransformationStep[];
  validationRules?: ValidationRule[];
  reasoning?: string;
}

export interface TableSplitDef {
  targetTableId: string;
  columnMappings: ColumnMapping[];
  rowFilter?: FilterExpression;
}

export interface FilterExpression {
  type: 'eq' | 'neq' | 'gt' | 'lt' | 'contains' | 'not_null' | 'is_null' | 'and' | 'or';
  column?: string;
  value?: unknown;
  children?: FilterExpression[];
}

export interface TableMapping {
  sourceTableId: string;
  targetTableId: string;
  rowFilter?: FilterExpression;
  columnMappings: ColumnMapping[];
  splitInto?: TableSplitDef[];
}

export type ToleranceMode = 'fail_on_first_error' | 'fail_on_batch_error' | 'continue_with_error_log';

export interface PreExecutionCheck {
  type: 'snapshot_target' | 'validate_source_accessible' | 'estimate_size';
  status: 'pending' | 'passed' | 'failed';
  details?: Record<string, unknown>;
}

export interface PostExecutionCheck {
  type: 'row_count_match' | 'fk_integrity' | 'no_truncation' | 'required_columns_populated' | 'sample_comparison';
  expectedValue?: unknown;
  actualValue?: unknown;
  status: 'pending' | 'passed' | 'failed' | 'skipped';
  details?: string;
}

export interface IrreversibleOperation {
  description: string;
  affectedTables: string[];
  reasoning: string;
  acknowledged: boolean;
  acknowledgedByUserId?: string;
  acknowledgedAt?: Date;
}

export interface MigrationPlan {
  prdArtifactId: string;
  schemaArtifactId: string;
  sourceConnectionId: string;
  sourceDescription: SourceDescription;
  tableMappings: TableMapping[];
  preExecutionChecks: PreExecutionCheck[];
  postExecutionChecks: PostExecutionCheck[];
  toleranceMode: ToleranceMode;
  batchSize: number;
  irreversibleOperations: IrreversibleOperation[];
  mappingNotes?: string;
  coverageWarnings?: string[];
  reasoning?: string;
}

export type MigrationPlanStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'rolled_back'
  | 'cancelled';

export interface MigrationPlanArtifact {
  id: string;
  workspaceId: string;
  plan: MigrationPlan;
  status: MigrationPlanStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

// ── Execution ─────────────────────────────────────────────────────────────────

export interface BatchResult {
  batchIndex: number;
  rowsAttempted: number;
  rowsSucceeded: number;
  rowsFailed: number;
  errors: RowError[];
  completedAt: Date;
}

export interface RowError {
  sourceTableId: string;
  rowIndex: number;
  sourceValues: Record<string, unknown>;
  error: string;
}

export type MigrationExecutionStatus =
  | 'pending'
  | 'snapshotting'
  | 'running'
  | 'validating'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'rolled_back';

export interface MigrationExecution {
  id: string;
  workspaceId: string;
  planId: string;
  status: MigrationExecutionStatus;
  snapshotId?: string;
  totalRows: number;
  migratedRows: number;
  failedRows: number;
  currentTableId?: string;
  currentBatchIndex: number;
  batchResults: BatchResult[];
  startedAt: Date;
  completedAt?: Date;
  errorMessage?: string;
  estimatedSecondsRemaining?: number;
}

// ── Preview ───────────────────────────────────────────────────────────────────

export interface PreviewRow {
  sourceRow: Record<string, unknown>;
  targetRow: Record<string, unknown>;
  transformationSteps: Array<{ columnId: string; steps: Array<{ type: string; input: unknown; output: unknown }> }>;
  errors: Array<{ columnId: string; error: string }>;
  warnings: Array<{ columnId: string; warning: string }>;
}

export interface MigrationPreview {
  planId: string;
  sampleSize: number;
  rows: PreviewRow[];
  totalErrors: number;
  totalWarnings: number;
  previewedAt: Date;
}

// ── Validation ────────────────────────────────────────────────────────────────

export interface ValidationFailure {
  checkType: string;
  tableId?: string;
  columnId?: string;
  expected?: unknown;
  actual?: unknown;
  details: string;
}

export interface MigrationValidationReport {
  executionId: string;
  checksRun: number;
  checksPassed: number;
  checksFailed: number;
  failures: ValidationFailure[];
  passedAt?: Date;
  failedAt?: Date;
}

// ── Rollback ──────────────────────────────────────────────────────────────────

export interface MigrationRollbackResult {
  executionId: string;
  snapshotId: string;
  tablesRestored: string[];
  completedAt: Date;
}

// ── Quality Signals ───────────────────────────────────────────────────────────

export interface DataMigrationQualitySignals {
  planArtifactId: string;
  sourceType: string;
  totalSourceColumns: number;
  aiMappingsAccepted: number;
  aiMappingsModified: number;
  aiMappingsRejected: number;
  manualMappingsAdded: number;
  totalTransformationsUsed: number;
  customJsExpressionsUsed: number;
  totalSourceRows: number;
  successfulMigratedRows: number;
  failedRows: number;
  executionDurationSeconds: number;
  validationChecksRun: number;
  validationChecksPassed: number;
  validationCheckFailures: ValidationFailure[];
  outcome: 'completed' | 'rolled_back' | 'cancelled' | 'failed';
  rollbackReason?: string;
}

// ── Service Inputs ────────────────────────────────────────────────────────────

export const ConnectSourceInputSchema = z.object({
  workspaceId: z.string().uuid(),
  type: z.enum(['postgres', 'mssql', 'mysql', 'mongo']),
  connectionString: z.string().min(1),
  name: z.string().optional(),
});
export type ConnectSourceInput = z.infer<typeof ConnectSourceInputSchema>;

export const UploadSourceFileInputSchema = z.object({
  workspaceId: z.string().uuid(),
  type: z.enum(['csv', 'json', 'excel']),
  fileKey: z.string().min(1),
  fileName: z.string().min(1),
  encoding: z.string().optional(),
  delimiter: z.string().optional(),
});
export type UploadSourceFileInput = z.infer<typeof UploadSourceFileInputSchema>;

export const GenerateMappingInputSchema = z.object({
  workspaceId: z.string().uuid(),
  sourceConnectionId: z.string().min(1),
  prdArtifactId: z.string().min(1),
  schemaArtifactId: z.string().min(1),
  userNotes: z.string().optional(),
});
export type GenerateMappingInput = z.infer<typeof GenerateMappingInputSchema>;

export const MappingPlanChangesSchema = z.object({
  tableMappings: z.array(z.any()).optional(),
  toleranceMode: z.enum(['fail_on_first_error', 'fail_on_batch_error', 'continue_with_error_log']).optional(),
  batchSize: z.number().int().min(1).max(10000).optional(),
  acknowledgements: z.record(z.boolean()).optional(),
});
export type MappingPlanChanges = z.infer<typeof MappingPlanChangesSchema>;

export const ExecuteOptionsSchema = z.object({
  toleranceMode: z.enum(['fail_on_first_error', 'fail_on_batch_error', 'continue_with_error_log']).optional(),
  batchSize: z.number().int().min(1).max(10000).optional(),
  batchErrorThresholdPercent: z.number().min(0).max(100).optional(),
});
export type ExecuteOptions = z.infer<typeof ExecuteOptionsSchema>;

// ── Audit Events ──────────────────────────────────────────────────────────────

export const DATA_MIGRATION_AUDIT_EVENTS = {
  SOURCE_CONNECTED: 'ai.data_migration.source_connected',
  SOURCE_INTROSPECTED: 'ai.data_migration.source_introspected',
  MAPPING_GENERATED: 'ai.data_migration.mapping_generated',
  MAPPING_EDITED: 'ai.data_migration.mapping_edited',
  PREVIEW_RUN: 'ai.data_migration.preview_run',
  SUBMITTED_FOR_APPROVAL: 'ai.data_migration.submitted_for_approval',
  APPROVED: 'ai.data_migration.approved',
  SNAPSHOT_TAKEN: 'ai.data_migration.snapshot_taken',
  EXECUTION_STARTED: 'ai.data_migration.execution_started',
  EXECUTION_PROGRESS: 'ai.data_migration.execution_progress',
  BATCH_FAILED: 'ai.data_migration.batch_failed',
  EXECUTION_COMPLETED: 'ai.data_migration.execution_completed',
  EXECUTION_FAILED: 'ai.data_migration.execution_failed',
  EXECUTION_CANCELLED: 'ai.data_migration.execution_cancelled',
  VALIDATION_RUN: 'ai.data_migration.validation_run',
  ROLLBACK_INITIATED: 'ai.data_migration.rollback_initiated',
  ROLLBACK_COMPLETED: 'ai.data_migration.rollback_completed',
} as const;

export type DataMigrationAuditEventType = (typeof DATA_MIGRATION_AUDIT_EVENTS)[keyof typeof DATA_MIGRATION_AUDIT_EVENTS];

// ── Permissions ───────────────────────────────────────────────────────────────

export const DATA_MIGRATION_PERMISSIONS = {
  CREATE: 'ai.data_migration.create',
  READ: 'ai.data_migration.read',
  EXECUTE: 'ai.data_migration.execute',
  APPROVE: 'ai.data_migration.approve',
  ROLLBACK: 'ai.data_migration.rollback',
} as const;

export const DATA_MIGRATION_DEFAULT_GRANTS: Record<string, string[]> = {
  workspace_owner: Object.values(DATA_MIGRATION_PERMISSIONS),
  workspace_admin: Object.values(DATA_MIGRATION_PERMISSIONS),
  architect: Object.values(DATA_MIGRATION_PERMISSIONS),
  developer: [DATA_MIGRATION_PERMISSIONS.CREATE, DATA_MIGRATION_PERMISSIONS.READ, DATA_MIGRATION_PERMISSIONS.EXECUTE],
  qa: [DATA_MIGRATION_PERMISSIONS.READ],
  reviewer: [DATA_MIGRATION_PERMISSIONS.READ],
  viewer: [DATA_MIGRATION_PERMISSIONS.READ],
};
