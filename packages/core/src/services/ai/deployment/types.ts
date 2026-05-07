import { z } from 'zod';

// ─── Deployment plan ──────────────────────────────────────────────────────────

export type DeployMode = 'rolling' | 'blue_green';
export type DeploymentStepType = 'pre_flight' | 'tests' | 'schema' | 'server' | 'ui' | 'health_check' | 'cleanup';
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
export type DeploymentStatus = 'pending' | 'running' | 'deployed' | 'failed' | 'rolled_back' | 'cancelled';
export type DeploymentEventType =
  | 'step_started' | 'step_completed' | 'step_failed'
  | 'log_line' | 'health_check_result'
  | 'rollback_started' | 'completed';

export interface HealthCheckConfig {
  timeoutSeconds: number;
  endpoints: string[];
  expectedStatus?: number;
}

export interface EnvironmentDeploymentConfig {
  name: string;
  autoDeploy: boolean;
  testsRequired: boolean;
  approvers: string[];
  approvalMode: 'any_of' | 'all_of';
  deployMode: DeployMode;
  healthCheck: HealthCheckConfig;
  notificationChannels: string[];
}

export interface SchemaMigrationStep {
  sequence: number;
  direction: 'forward' | 'reverse';
  reversible: boolean;
  reasoning: string;
  sql?: string;
}

export interface IrreversibleOperation {
  description: string;
  migrationSequence: number;
  warning: string;
}

export interface DeploymentPlan {
  appVersion: string;
  workspaceId: string;
  projectId: string;
  sourceArtifacts: {
    uiProjectId: string;
    serverCodeProjectId: string;
    schemaId: string;
    testSuiteId: string;
  };
  environments: EnvironmentDeploymentConfig[];
  schemaMigrations: SchemaMigrationStep[];
  irreversibleOperations: IrreversibleOperation[];
  globalConfig: {
    rollbackRetentionDays: number;
    healthCheckTimeoutSeconds: number;
    notificationChannels: string[];
  };
  reasoning: {
    overallApproach: string;
    environmentProgressionRationale: string;
    schemaStrategyRationale: string;
    riskAssessment: string;
  };
  status: 'draft' | 'approved';
  createdAt: Date;
}

// ─── Deployment ───────────────────────────────────────────────────────────────

export interface DeploymentStep {
  stepType: DeploymentStepType;
  status: StepStatus;
  startedAt?: Date;
  completedAt?: Date;
  details?: Record<string, unknown>;
  errorMessage?: string;
}

export interface HealthCheckResults {
  passed: boolean;
  checkedAt: Date;
  results: Array<{ endpoint: string; status: number; latencyMs: number; passed: boolean }>;
}

export interface Deployment {
  id: string;
  planId: string;
  workspaceId: string;
  environment: string;
  status: DeploymentStatus;
  appVersion: string;
  sourceUiProjectId: string;
  sourceServerCodeProjectId: string;
  sourceSchemaId: string;
  sourceTestSuiteId: string;
  startedAt: Date;
  completedAt?: Date;
  startedByUserId: string;
  approvalId?: string;
  rollbackTargetDeploymentId?: string;
  steps: DeploymentStep[];
  healthCheckResults?: HealthCheckResults;
}

export interface DeploymentSummary {
  id: string;
  planId: string;
  workspaceId: string;
  environment: string;
  status: DeploymentStatus;
  appVersion: string;
  startedAt: Date;
  completedAt?: Date;
  startedByUserId: string;
}

export interface DeploymentEvent {
  type: DeploymentEventType;
  timestamp: Date;
  data: Record<string, unknown>;
}

export interface DeploymentQualitySignals {
  deploymentId: string;
  planAcceptedFirstSubmission: boolean;
  planEditsBeforeApproval: number;
  testsPassedFirstAttempt: boolean;
  schemaMigrationFailures: number;
  outcome: 'completed' | 'failed' | 'rolled_back' | 'cancelled';
  totalDurationMinutes: number;
  healthCheckPassed: boolean;
  healthCheckTime: number;
  rolledBack: boolean;
  rollbackReason?: string;
  rollbackInitiatedHoursAfterDeploy?: number;
}

// ─── Input schemas ────────────────────────────────────────────────────────────

export const GeneratePlanInputSchema = z.object({
  projectId: z.string().min(1),
  uiProjectId: z.string().min(1),
  serverCodeProjectId: z.string().min(1),
  schemaId: z.string().min(1),
  testSuiteId: z.string().min(1),
  appVersion: z.string().min(1),
});
export type GeneratePlanInput = z.infer<typeof GeneratePlanInputSchema>;

export const UpdatePlanInputSchema = z.object({
  planId: z.string().min(1),
  changes: z.object({
    environments: z.array(z.any()).optional(),
    globalConfig: z.record(z.unknown()).optional(),
  }),
});
export type UpdatePlanInput = z.infer<typeof UpdatePlanInputSchema>;

export const DeployToEnvironmentInputSchema = z.object({
  planId: z.string().min(1),
  environmentName: z.string().min(1),
});
export type DeployToEnvironmentInput = z.infer<typeof DeployToEnvironmentInputSchema>;

export const RollbackInputSchema = z.object({
  deploymentId: z.string().min(1),
  reason: z.string().optional(),
});
export type RollbackInput = z.infer<typeof RollbackInputSchema>;

// ─── Audit events ─────────────────────────────────────────────────────────────

export const DEPLOYMENT_AUDIT_EVENTS = {
  PLAN_GENERATED: 'ai.deployment.plan_generated',
  PLAN_EDITED: 'ai.deployment.plan_edited',
  PLAN_APPROVED: 'ai.deployment.plan_approved',
  DEPLOYMENT_INITIATED: 'ai.deployment.deployment_initiated',
  TESTS_RUN: 'ai.deployment.tests_run',
  TESTS_PASSED: 'ai.deployment.tests_passed',
  TESTS_FAILED: 'ai.deployment.tests_failed',
  SCHEMA_MIGRATION_STARTED: 'ai.deployment.schema_migration_started',
  SCHEMA_MIGRATION_COMPLETED: 'ai.deployment.schema_migration_completed',
  SCHEMA_MIGRATION_FAILED: 'ai.deployment.schema_migration_failed',
  SERVER_DEPLOY_STARTED: 'ai.deployment.server_deploy_started',
  SERVER_DEPLOY_COMPLETED: 'ai.deployment.server_deploy_completed',
  UI_DEPLOY_STARTED: 'ai.deployment.ui_deploy_started',
  UI_DEPLOY_COMPLETED: 'ai.deployment.ui_deploy_completed',
  HEALTH_CHECK_STARTED: 'ai.deployment.health_check_started',
  HEALTH_CHECK_PASSED: 'ai.deployment.health_check_passed',
  HEALTH_CHECK_FAILED: 'ai.deployment.health_check_failed',
  ENVIRONMENT_PROMOTED: 'ai.deployment.environment_promoted',
  DEPLOYMENT_COMPLETED: 'ai.deployment.deployment_completed',
  DEPLOYMENT_FAILED: 'ai.deployment.deployment_failed',
  DEPLOYMENT_CANCELLED: 'ai.deployment.deployment_cancelled',
  ROLLBACK_INITIATED: 'ai.deployment.rollback_initiated',
  ROLLBACK_COMPLETED: 'ai.deployment.rollback_completed',
  ROLLBACK_FAILED: 'ai.deployment.rollback_failed',
} as const;

export type DeploymentAuditEventType = typeof DEPLOYMENT_AUDIT_EVENTS[keyof typeof DEPLOYMENT_AUDIT_EVENTS];

// ─── Permissions ──────────────────────────────────────────────────────────────

export const DEPLOYMENT_PERMISSIONS = {
  CREATE: 'ai.deployment.create',
  READ: 'ai.deployment.read',
  DEPLOY_DEV: 'ai.deployment.deploy_dev',
  DEPLOY_STAGING: 'ai.deployment.deploy_staging',
  DEPLOY_PROD: 'ai.deployment.deploy_prod',
  APPROVE: 'ai.deployment.approve',
  ROLLBACK: 'ai.deployment.rollback',
  CANCEL: 'ai.deployment.cancel',
} as const;

export const DEPLOYMENT_DEFAULT_GRANTS = {
  workspace_owner: ['ai.deployment.create', 'ai.deployment.read', 'ai.deployment.deploy_dev', 'ai.deployment.deploy_staging', 'ai.deployment.deploy_prod', 'ai.deployment.approve', 'ai.deployment.rollback', 'ai.deployment.cancel'],
  workspace_admin: ['ai.deployment.create', 'ai.deployment.read', 'ai.deployment.deploy_dev', 'ai.deployment.deploy_staging', 'ai.deployment.deploy_prod', 'ai.deployment.approve', 'ai.deployment.rollback', 'ai.deployment.cancel'],
  architect: ['ai.deployment.create', 'ai.deployment.read', 'ai.deployment.deploy_dev', 'ai.deployment.deploy_staging', 'ai.deployment.deploy_prod', 'ai.deployment.approve', 'ai.deployment.rollback', 'ai.deployment.cancel'],
  developer: ['ai.deployment.create', 'ai.deployment.read', 'ai.deployment.deploy_dev'],
  qa: ['ai.deployment.read', 'ai.deployment.deploy_dev'],
  business_analyst: ['ai.deployment.read'],
  viewer: ['ai.deployment.read'],
} as const;
