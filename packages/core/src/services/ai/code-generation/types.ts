import { z } from 'zod';

// ─── Trigger types ─────────────────────────────────────────────────────────────

export type FunctionTriggerType = 'http' | 'schedule' | 'event' | 'manual';

export interface HttpTriggerConfig {
  type: 'http';
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  authRequired: boolean;
}

export interface ScheduleTriggerConfig {
  type: 'schedule';
  cron: string;
  timezone?: string;
}

export interface EventTriggerConfig {
  type: 'event';
  eventType: string;
  filter?: Record<string, unknown>;
}

export interface ManualTriggerConfig {
  type: 'manual';
}

export type TriggerConfig = HttpTriggerConfig | ScheduleTriggerConfig | EventTriggerConfig | ManualTriggerConfig;

// ─── Function specs and inventory ─────────────────────────────────────────────

export interface FieldDefinition {
  name: string;
  type: string;
  required: boolean;
  description?: string;
}

export interface FunctionSpec {
  name: string;
  triggerType: FunctionTriggerType;
  triggerConfig: TriggerConfig;
  description: string;
  inputs: FieldDefinition[];
  outputs: FieldDefinition[];
  requiredPermissions: string[];
  requiredSecrets: string[];
  requiredIntegrations: string[];
  estimatedComplexity: 'low' | 'medium' | 'high';
  inferredFrom: 'ui_call' | 'prd_requirement' | 'integration' | 'manual';
  rationale: string;
}

export interface FunctionInventory {
  projectId: string;
  functions: FunctionSpec[];
  rationale: string;
  inferredFromUi: string[];
  inferredFromPrd: string[];
  inferredFromIntegrations: string[];
  totalEstimatedCost: number;
}

// ─── Function manifest ─────────────────────────────────────────────────────────

export interface RateLimitConfig {
  requestsPerMinute: number;
  burstLimit?: number;
}

export interface FunctionManifestEntry {
  name: string;
  triggerType: FunctionTriggerType;
  triggerConfig: TriggerConfig;
  permissions: string[];
  secrets: string[];
  integrations: string[];
  rateLimit: RateLimitConfig;
  timeoutMs: number;
  memoryMb: number;
  artifactId: string;
  version: number;
}

export interface ServerManifest {
  workspaceId: string;
  projectId: string;
  functions: FunctionManifestEntry[];
  integrationsUsed: string[];
  estimatedMonthlyCostUsd: number;
}

// ─── Static analysis ─────────────────────────────────────────────────────────

export type StaticViolationType =
  | 'forbidden_import'
  | 'forbidden_call'
  | 'missing_permission_declaration'
  | 'unsafe_pattern'
  | 'sandbox_escape_attempt';

export interface StaticViolation {
  type: StaticViolationType;
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning';
}

export interface StaticAnalysisReport {
  passed: boolean;
  violations: StaticViolation[];
  warnings: string[];
  analyzedAt: Date;
}

// ─── Function validation ──────────────────────────────────────────────────────

export interface FunctionValidationReport {
  staticAnalysis: StaticAnalysisReport;
  typeCheckPassed: boolean;
  typeCheckErrors: string[];
  permissionDeclarationAccurate: boolean;
  derivedPermissionsAdded: string[];
  passed: boolean;
}

// ─── Quality signals ──────────────────────────────────────────────────────────

export interface ServerCodeQualitySignals {
  functionArtifactId: string;
  initialStaticAnalysisPass: boolean;
  finalStaticAnalysisPass: boolean;
  initialTypeCheckPass: boolean;
  finalTypeCheckPass: boolean;
  declaredPermissionsAccurate: boolean;
  derivedPermissionsAdded: number;
  acceptedFirstPass: boolean;
  totalRegenerations: number;
  charsEditedAfterApproval: number;
  invocationsTotal: number;
  invocationsFailed: number;
  invocationsTimedOut: number;
  rolledBack: boolean;
}

// ─── Server function (main artifact) ─────────────────────────────────────────

export interface ServerFunctionFile {
  path: string;
  content: string;
  language: 'typescript' | 'json' | 'yaml';
}

export interface ReasoningRecord {
  whyThisFunctionExists: string;
  whyThisImplementation: string;
  designDecisions: string[];
}

export type ServerFunctionStatus = 'generating' | 'draft' | 'validated' | 'approved' | 'rejected' | 'deployed' | 'rolled_back';

export interface ServerFunction {
  id: string;
  projectId: string;
  version: number;
  spec: FunctionSpec;
  files: ServerFunctionFile[];
  manifestEntry: FunctionManifestEntry;
  validationReport: FunctionValidationReport;
  qualitySignals: ServerCodeQualitySignals;
  reasoning: ReasoningRecord;
  status: ServerFunctionStatus;
  createdAt: Date;
  approvedAt?: Date;
  approvedBy?: string;
}

// ─── Server code project ──────────────────────────────────────────────────────

export type ServerCodeProjectStatus = 'inventory_pending' | 'generating' | 'review' | 'approved' | 'exported';

export interface ServerBuildConfig {
  nodeVersion: string;
  entrypoint: string;
  runtime: 'node' | 'deno' | 'bun';
  bundler: 'esbuild' | 'tsc';
}

export interface ServerCodeProject {
  id: string;
  workspaceId: string;
  prdArtifactId: string;
  schemaArtifactId: string;
  uiProjectArtifactId?: string;
  inventoryArtifactId?: string;
  functionIds: string[];
  manifest: ServerManifest;
  buildConfig: ServerBuildConfig;
  status: ServerCodeProjectStatus;
  qualitySignals: CodeGenerationQualitySignals;
  createdAt: Date;
  updatedAt: Date;
}

export interface CodeGenerationQualitySignals {
  totalFunctions: number;
  approvedFunctions: number;
  staticAnalysisPassRate: number;
  typeCheckPassRate: number;
  permissionAccuracyRate: number;
  totalRegenerations: number;
  generationCostUsd: number;
}

// ─── Integration catalog ──────────────────────────────────────────────────────

export type IntegrationCategory = 'payment' | 'communication' | 'identity' | 'storage' | 'analytics' | 'notifications' | 'other';

export interface CodeExample {
  title: string;
  code: string;
}

export interface IntegrationDescriptor {
  id: string;
  name: string;
  description: string;
  module: string;
  configSchema: Record<string, { type: string; required: boolean; description: string; secret: boolean }>;
  methods: string[];
  examples: CodeExample[];
  documentation: string;
  category: IntegrationCategory;
}

// ─── Input schemas ────────────────────────────────────────────────────────────

export const GenerateInventoryInputSchema = z.object({
  projectId: z.string().min(1),
  prdContent: z.string().min(1),
  schemaContent: z.string().min(1),
  uiProjectSummary: z.string().optional(),
});
export type GenerateInventoryInput = z.infer<typeof GenerateInventoryInputSchema>;

export const GenerateFunctionInputSchema = z.object({
  projectId: z.string().min(1),
  spec: z.object({
    name: z.string().min(1),
    triggerType: z.enum(['http', 'schedule', 'event', 'manual']),
    description: z.string().min(1),
  }).passthrough(),
});
export type GenerateFunctionInput = z.infer<typeof GenerateFunctionInputSchema>;

export const RegenerateFunctionInputSchema = z.object({
  functionId: z.string().min(1),
  feedback: z.string().optional(),
});
export type RegenerateFunctionInput = z.infer<typeof RegenerateFunctionInputSchema>;

export const RollbackFunctionInputSchema = z.object({
  functionId: z.string().min(1),
  targetVersion: z.number().int().positive(),
});
export type RollbackFunctionInput = z.infer<typeof RollbackFunctionInputSchema>;

// ─── Audit events ─────────────────────────────────────────────────────────────

export const CODE_GENERATION_AUDIT_EVENTS = {
  INVENTORY_GENERATED: 'ai.code_generation.inventory_generated',
  FUNCTION_GENERATED: 'ai.code_generation.function_generated',
  FUNCTION_REGENERATED: 'ai.code_generation.function_regenerated',
  STATIC_ANALYSIS_VIOLATION: 'ai.code_generation.static_analysis_violation',
  TYPECHECK_FAILURE: 'ai.code_generation.typecheck_failure',
  FUNCTION_APPROVED: 'ai.code_generation.function_approved',
  FUNCTION_REJECTED: 'ai.code_generation.function_rejected',
  FUNCTION_ROLLED_BACK: 'ai.code_generation.function_rolled_back',
  PROJECT_APPROVED: 'ai.code_generation.project_approved',
  EXPORTED: 'ai.code_generation.exported',
} as const;

export type CodeGenerationAuditEventType = typeof CODE_GENERATION_AUDIT_EVENTS[keyof typeof CODE_GENERATION_AUDIT_EVENTS];

// ─── Permissions ──────────────────────────────────────────────────────────────

export const CODE_GENERATION_PERMISSIONS = {
  CREATE: 'ai.code_generation.create',
  READ: 'ai.code_generation.read',
  REGENERATE: 'ai.code_generation.regenerate',
  APPROVE: 'ai.code_generation.approve',
  ROLLBACK: 'ai.code_generation.rollback',
  EXPORT: 'ai.code_generation.export',
} as const;

export const CODE_GENERATION_DEFAULT_GRANTS = {
  workspace_owner: ['ai.code_generation.create', 'ai.code_generation.read', 'ai.code_generation.regenerate', 'ai.code_generation.approve', 'ai.code_generation.rollback', 'ai.code_generation.export'],
  architect: ['ai.code_generation.create', 'ai.code_generation.read', 'ai.code_generation.regenerate', 'ai.code_generation.approve', 'ai.code_generation.rollback', 'ai.code_generation.export'],
  developer: ['ai.code_generation.create', 'ai.code_generation.read', 'ai.code_generation.regenerate', 'ai.code_generation.export'],
  business_analyst: ['ai.code_generation.read'],
  viewer: ['ai.code_generation.read'],
} as const;
