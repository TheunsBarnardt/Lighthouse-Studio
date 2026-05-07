import { z } from 'zod';

// ─── Signals ──────────────────────────────────────────────────────────────────

export type SignalSource = 'error' | 'perf' | 'user_report' | 'dependency_advisory' | 'feature_request' | 'manual';
export type SignalSeverity = 'critical' | 'high' | 'medium' | 'low';
export type SignalStatus = 'new' | 'classified' | 'in_change_request' | 'resolved' | 'wont_fix';

export interface ErrorSignalDetails {
  message: string;
  stackTrace?: string;
  affectedRequest?: { method: string; path: string };
  affectedFunctionId?: string;
  affectedComponentId?: string;
  occurrenceCount: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

export interface PerfSignalDetails {
  metric: 'latency' | 'throughput' | 'error_rate' | 'memory';
  observed: number;
  baseline: number;
  unit: string;
  endpoint?: string;
}

export interface UserReportDetails {
  description: string;
  reportedUrl: string;
  userAgent?: string;
  screenshot?: string;
  consoleErrors?: string[];
}

export interface DependencyAdvisoryDetails {
  packageName: string;
  affectedVersions: string;
  fixedVersion?: string;
  cveId?: string;
  advisoryUrl?: string;
}

export interface StageClassificationEntry {
  stageName: string;
  confidence: number;
  reasoning: string;
}

export interface SignalClassification {
  suggestedStages: StageClassificationEntry[];
  affectedArtifactIds: string[];
  classifiedAt: Date;
  classifiedBy: 'ai' | 'user';
}

export interface Signal {
  id: string;
  workspaceId: string;
  source: SignalSource;
  errorDetails?: ErrorSignalDetails;
  perfDetails?: PerfSignalDetails;
  userReportDetails?: UserReportDetails;
  advisoryDetails?: DependencyAdvisoryDetails;
  severity: SignalSeverity;
  cluster?: string;
  duplicateOfSignalId?: string;
  classification?: SignalClassification;
  status: SignalStatus;
  observedAt: Date;
  ingestedAt: Date;
}

// ─── Change requests ──────────────────────────────────────────────────────────

export type ChangeRequestStatus =
  | 'open' | 'classified' | 'in_progress' | 'pending_approval'
  | 'approved' | 'in_deployment' | 'resolved' | 'wont_fix' | 'duplicate';

export type ChangeRequestPriority = 'p0' | 'p1' | 'p2' | 'p3';

export interface OutcomeMetrics {
  errorRateBefore?: number;
  errorRateAfter?: number;
  latencyBefore?: number;
  latencyAfter?: number;
  userReportCountBefore?: number;
  userReportCountAfter?: number;
  fixedAt: Date;
}

export interface ChangeRequest {
  id: string;
  workspaceId: string;
  triggeringSignals: string[];
  description: string;
  classification: SignalClassification;
  severity: SignalSeverity;
  priority: ChangeRequestPriority;
  affectedArtifactIds: string[];
  status: ChangeRequestStatus;
  rootSignalIds: string[];
  duplicateOfRequestId?: string;
  resolvedByDeploymentId?: string;
  resolution?: {
    resolvedAt: Date;
    resolvedByUserId: string;
    notes: string;
    outcomeMetrics?: OutcomeMetrics;
  };
  createdAt: Date;
  updatedAt: Date;
}

// ─── Dependency advisories ────────────────────────────────────────────────────

export interface DependencyAdvisory {
  id: string;
  workspaceId?: string;
  source: 'platform_sdk' | 'integration' | 'transitive';
  packageName: string;
  affectedVersions: string;
  fixedVersion?: string;
  severity: SignalSeverity;
  description: string;
  cveId?: string;
  url?: string;
  createdAt: Date;
}

// ─── Cascade detection ────────────────────────────────────────────────────────

export type CascadeStatus = 'stale' | 'affected' | 'unaffected';

export interface AffectedArtifact {
  artifactId: string;
  artifactType: string;
  cascadeStatus: CascadeStatus;
  reasoning: string;
}

export interface AffectedDownstreamReport {
  sourceArtifactId: string;
  affectedArtifacts: AffectedArtifact[];
  totalAffected: number;
  totalStale: number;
}

// ─── Outcome tracking ─────────────────────────────────────────────────────────

export interface OutcomeReport {
  changeRequestId: string;
  deploymentId: string;
  resolved: boolean;
  confidence: number;
  metrics: OutcomeMetrics;
  assessment: string;
}

// ─── Quality signals ──────────────────────────────────────────────────────────

export interface MaintenanceQualitySignals {
  workspaceId: string;
  meanTimeToClassificationMinutes: number;
  meanTimeToResolutionMinutes: number;
  classificationAccuracyRate: number;
  cascadeAccuracyRate: number;
  regressionRate: number;
  duplicateDetectionRate: number;
  signalsIngestedPerWeek: number;
  changeRequestsCreatedPerWeek: number;
  changeRequestsResolvedPerWeek: number;
  outcomeFixRate: number;
}

// ─── Input schemas ────────────────────────────────────────────────────────────

export const IngestSignalInputSchema = z.object({
  workspaceId: z.string().min(1),
  source: z.enum(['error', 'perf', 'user_report', 'dependency_advisory', 'feature_request', 'manual']),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  sourceData: z.record(z.unknown()),
  observedAt: z.coerce.date().optional(),
});
export type IngestSignalInput = z.infer<typeof IngestSignalInputSchema>;

export const CreateChangeRequestInputSchema = z.object({
  workspaceId: z.string().min(1),
  signalIds: z.array(z.string()).min(1),
  description: z.string().min(1),
  priority: z.enum(['p0', 'p1', 'p2', 'p3']).optional(),
});
export type CreateChangeRequestInput = z.infer<typeof CreateChangeRequestInputSchema>;

export const ResolveChangeRequestInputSchema = z.object({
  requestId: z.string().min(1),
  notes: z.string().min(1),
  wontFix: z.boolean().optional(),
});
export type ResolveChangeRequestInput = z.infer<typeof ResolveChangeRequestInputSchema>;

// ─── Audit events ─────────────────────────────────────────────────────────────

export const MAINTENANCE_AUDIT_EVENTS = {
  SIGNAL_INGESTED: 'ai.maintenance.signal_ingested',
  SIGNAL_CLASSIFIED: 'ai.maintenance.signal_classified',
  SIGNAL_DEDUPLICATED: 'ai.maintenance.signal_deduplicated',
  CHANGE_REQUEST_CREATED: 'ai.maintenance.change_request_created',
  CHANGE_REQUEST_UPDATED: 'ai.maintenance.change_request_updated',
  CHANGE_REQUEST_ENGAGED_STAGE: 'ai.maintenance.change_request_engaged_stage',
  CHANGE_REQUEST_RESOLVED: 'ai.maintenance.change_request_resolved',
  CHANGE_REQUEST_WONT_FIX: 'ai.maintenance.change_request_wont_fix',
  DEPENDENCY_ADVISORY_RECEIVED: 'ai.maintenance.dependency_advisory_received',
  OUTCOME_ASSESSED: 'ai.maintenance.outcome_assessed',
  REGRESSION_DETECTED: 'ai.maintenance.regression_detected',
} as const;

export type MaintenanceAuditEventType = typeof MAINTENANCE_AUDIT_EVENTS[keyof typeof MAINTENANCE_AUDIT_EVENTS];

// ─── Permissions ──────────────────────────────────────────────────────────────

export const MAINTENANCE_PERMISSIONS = {
  READ: 'ai.maintenance.read',
  CREATE_REQUEST: 'ai.maintenance.create_request',
  ENGAGE_STAGE: 'ai.maintenance.engage_stage',
  RESOLVE: 'ai.maintenance.resolve',
  CONFIG: 'ai.maintenance.config',
} as const;

export const MAINTENANCE_DEFAULT_GRANTS = {
  workspace_owner: ['ai.maintenance.read', 'ai.maintenance.create_request', 'ai.maintenance.engage_stage', 'ai.maintenance.resolve', 'ai.maintenance.config'],
  workspace_admin: ['ai.maintenance.read', 'ai.maintenance.create_request', 'ai.maintenance.engage_stage', 'ai.maintenance.resolve', 'ai.maintenance.config'],
  architect: ['ai.maintenance.read', 'ai.maintenance.create_request', 'ai.maintenance.engage_stage', 'ai.maintenance.resolve', 'ai.maintenance.config'],
  developer: ['ai.maintenance.read', 'ai.maintenance.create_request', 'ai.maintenance.engage_stage', 'ai.maintenance.resolve'],
  qa: ['ai.maintenance.read', 'ai.maintenance.create_request', 'ai.maintenance.resolve'],
  business_analyst: ['ai.maintenance.read', 'ai.maintenance.create_request'],
  viewer: ['ai.maintenance.read'],
} as const;
