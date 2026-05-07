import { z } from 'zod';

// ── Stage names ───────────────────────────────────────────────────────────────

export type StageName =
  | 'intent'
  | 'intent_capture'
  | 'prd'
  | 'design_tokens'
  | 'schema'
  | 'migration'
  | 'ui'
  | 'code'
  | 'tests'
  | 'deployment'
  | 'maintenance';

// ── Artifact status ───────────────────────────────────────────────────────────

export type ArtifactStatus = 'draft' | 'awaiting_approval' | 'approved' | 'rejected' | 'archived';

// ── Reasoning ─────────────────────────────────────────────────────────────────

export interface ReasoningRecord {
  rationale: string;
  alternativesConsidered: string[];
  assumptions: string[];
  uncertainties: string[];
  sourceArtifactIds: string[];
}

// ── Quality signals ───────────────────────────────────────────────────────────

export interface QualitySignals {
  submissionCount: number;
  rejectionCount: number;
  approvedFirstSubmit: boolean;
  revisionCount: number;
  editsAfterGeneration: number;
  totalEditCharCount: number;
  timeToApproveMs?: number;
  rejectionReasons?: string[];
}

// ── Generation record ─────────────────────────────────────────────────────────

export interface GenerationRecord {
  provider: string;
  model: string;
  promptId: string;
  promptVersion: string;
  inputTokens: number;
  outputTokens: number;
  toolUseTokens: number;
  costUsd: number;
  durationMs: number;
  cached: boolean;
  generatedAt: Date;
}

// ── Artifact ──────────────────────────────────────────────────────────────────

export interface Artifact<TContent = unknown> {
  id: string;
  workspaceId: string;
  stage: StageName;
  type: string;
  parentArtifactIds: string[];
  childArtifactIds: string[];

  status: ArtifactStatus;
  currentVersion: number;

  content: TContent;
  reasoning: ReasoningRecord;
  qualitySignals: QualitySignals;
  generatedBy?: GenerationRecord;

  approvalId?: string;
  createdByUserId: string | null;
  approvedAt?: Date;
  approvedByUserId?: string;

  createdAt: Date;
  updatedAt: Date;
}

// ── AI usage record ───────────────────────────────────────────────────────────

export interface AiUsageRecord {
  id: string;
  workspaceId: string;
  userId?: string;
  stage: string;
  artifactId?: string;
  promptId: string;
  promptVersion: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  toolUseTokens: number;
  costUsd: number;
  durationMs: number;
  cached: boolean;
  status: 'succeeded' | 'failed' | 'timeout' | 'budget_exceeded';
  createdAt: Date;
}

export interface UsageSummary {
  workspaceId: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalToolUseTokens: number;
  totalCostUsd: number;
  byStage: Record<string, { inputTokens: number; outputTokens: number; costUsd: number }>;
  byDay: Array<{ date: string; costUsd: number; totalTokens: number }>;
}

export interface BudgetStatus {
  withinBudget: boolean;
  monthlyLimitUsd: number;
  usedThisMonthUsd: number;
  remainingUsd: number;
  percentUsed: number;
  warning: boolean;
}

// ── Quality signal update ─────────────────────────────────────────────────────

export interface QualitySignal {
  type: 'edit' | 'rejection' | 'approval' | 'revision' | 'submission';
  metadata?: Record<string, unknown>;
}

// ── Zod schemas ───────────────────────────────────────────────────────────────

export const StageNameSchema = z.enum([
  'intent',
  'intent_capture',
  'prd',
  'design_tokens',
  'schema',
  'migration',
  'ui',
  'code',
  'tests',
  'deployment',
  'maintenance',
]);

export const ArtifactStatusSchema = z.enum([
  'draft',
  'awaiting_approval',
  'approved',
  'rejected',
  'archived',
]);

export const ReasoningRecordSchema = z.object({
  rationale: z.string(),
  alternativesConsidered: z.array(z.string()),
  assumptions: z.array(z.string()),
  uncertainties: z.array(z.string()),
  sourceArtifactIds: z.array(z.string()),
});
