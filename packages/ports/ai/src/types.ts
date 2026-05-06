import { z } from 'zod';

// ── Primitive types ────────────────────────────────────────────────────────────

export type AiRole = 'user' | 'assistant' | 'system';

export interface AiMessage {
  role: AiRole;
  content: string;
}

// ── Provider capabilities ──────────────────────────────────────────────────────

export interface AIProviderCapabilities {
  streaming: boolean;
  toolUse: boolean;
  structuredOutput: boolean;
  imageInput: boolean;
  maxContextTokens: number;
}

// ── Model info ─────────────────────────────────────────────────────────────────

export interface ModelInfo {
  id: string;
  displayName: string;
  contextWindow: number;
  supportsTools: boolean;
  supportsStreaming: boolean;
}

// ── Tool definitions ───────────────────────────────────────────────────────────

export interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: unknown[];
  description?: string;
  [key: string]: unknown;
}

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  parameters: JsonSchema;
}

export interface ToolCall {
  id: string;
  toolId: string;
  name: string;
  parameters: Record<string, unknown>;
}

// ── Generation request / response ──────────────────────────────────────────────

export interface GenerationMetadata {
  workspaceId?: string;
  userId?: string;
  promptId?: string;
  promptVersion?: string;
  correlationId: string;
}

export interface GenerationRequest {
  model: string;
  systemPrompt?: string;
  messages: AiMessage[];
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  /** JSON Schema for structured output mode. */
  outputSchema?: JsonSchema;
  metadata: GenerationMetadata;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  toolUseTokens?: number;
}

export interface GenerationResponse {
  content: string;
  model: string;
  usage: TokenUsage;
  finishReason: 'stop' | 'max_tokens' | 'tool_use' | 'content_filter' | 'unknown';
  toolCalls?: ToolCall[];
  reasoning?: string;
}

// ── Streaming events ───────────────────────────────────────────────────────────

export type GenerationEvent =
  | { type: 'text_delta'; delta: string }
  | { type: 'tool_call_start'; toolId: string; callId: string; name: string }
  | { type: 'tool_call_complete'; callId: string; result: unknown }
  | { type: 'done'; usage: TokenUsage; finishReason: string }
  | { type: 'error'; code: string; message: string };

// ── Health ─────────────────────────────────────────────────────────────────────

export interface HealthStatus {
  healthy: boolean;
  latencyMs?: number;
  message?: string;
}

// ── Legacy types (kept for backward compatibility with EchoAiAdapter) ──────────

export interface AiGenerationOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stopSequences?: string[];
  systemPrompt?: string;
}

export interface AiGenerationResult {
  content: string;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  finishReason: 'stop' | 'max_tokens' | 'content_filter' | 'unknown';
  reasoning?: string;
}

export interface AiStreamChunk {
  delta: string;
  done: boolean;
}

export const AiGenerationOptionsSchema = z.object({
  model: z.string().optional(),
  maxTokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
  topP: z.number().min(0).max(1).optional(),
  stopSequences: z.array(z.string()).optional(),
  systemPrompt: z.string().optional(),
});

// ── AI artifact types ──────────────────────────────────────────────────────────

export const STAGE_NAMES = [
  'intent',
  'prd',
  'design_tokens',
  'schema',
  'components',
  'server_functions',
  'tests',
  'deployment',
  'documentation',
  'maintenance',
] as const;

export type StageName = (typeof STAGE_NAMES)[number];

export type ArtifactStatus = 'draft' | 'awaiting_approval' | 'approved' | 'rejected' | 'archived';

export interface ReasoningRecord {
  rationale: string;
  alternatives_considered: string[];
  assumptions: string[];
  uncertainties: string[];
  source_artifacts: string[];
}

export interface QualitySignals {
  revisionCount: number;
  editDistance?: number;
  timeToApprovalSeconds?: number;
  outcome?: 'accepted_first_pass' | 'accepted_after_revisions' | 'rejected' | 'abandoned';
  rejectedWithFeedback?: string;
  causedDownstreamIssue: boolean;
}

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
}

export interface Artifact {
  id: string;
  version: number;
  workspaceId: string;
  stage: StageName;
  type: string;
  parentArtifactIds: string[];
  childArtifactIds: string[];
  status: ArtifactStatus;
  currentVersion: number;
  content: Record<string, unknown>;
  reasoning: ReasoningRecord;
  qualitySignals: QualitySignals;
  generatedBy: GenerationRecord;
  approvalId?: string;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  approvedAt?: Date;
  approvedByUserId?: string;
  archivedAt: Date | null;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface ArtifactVersion {
  id: string;
  artifactId: string;
  version: number;
  content: Record<string, unknown>;
  reasoning: ReasoningRecord;
  changeSummary: string;
  editedByUserId: string | null;
  createdAt: Date;
}

// ── AI usage / cost ────────────────────────────────────────────────────────────

export type AiUsageStatus = 'succeeded' | 'failed' | 'timeout' | 'budget_exceeded';

export interface AiUsageRecord {
  id: string;
  workspaceId: string;
  userId?: string;
  stage: StageName;
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
  status: AiUsageStatus;
  createdAt: Date;
}

export type ArtifactOutcome =
  | 'accepted_first_pass'
  | 'accepted_after_revisions'
  | 'rejected'
  | 'abandoned';

export interface ArtifactQualityRecord {
  id: string;
  artifactId: string;
  workspaceId: string;
  stage: StageName;
  promptId: string;
  promptVersion: string;
  provider: string;
  model: string;
  outcome: ArtifactOutcome;
  revisionCount: number;
  editDistance?: number;
  timeToApprovalSeconds?: number;
  rejectedWithFeedback?: string;
  causedDownstreamIssue: boolean;
  createdAt: Date;
}

// ── Workspace AI config ────────────────────────────────────────────────────────

export interface WorkspaceAiConfig {
  workspaceId: string;
  primaryProvider: string;
  fallbackProvider?: string;
  monthlyBudgetUsd: number;
  perStageBudgetPct: Record<StageName, number>;
  piiRedactionEnabled: boolean;
  piiRedactionOverrideConsent: boolean;
}

export type BudgetStatus =
  | { withinBudget: true; usedPct: number }
  | { withinBudget: false; reason: 'soft_warning' | 'hard_limit'; usedPct: number };
