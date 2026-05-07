/**
 * AI Pipeline Foundation Types — Objective 20
 *
 * Shared across all pipeline stages (21–30). Every AI-generated artifact carries
 * these structures for traceability, cost accounting, and lifecycle management.
 */

import { z } from 'zod';

// ── Artifact lifecycle ─────────────────────────────────────────────────────────

export type ArtifactStatus = 'draft' | 'in_review' | 'approved' | 'rejected' | 'stale' | 'archived';

// ── Reasoning capture ──────────────────────────────────────────────────────────

/**
 * Every AI-generated artifact captures reasoning metadata.
 * Non-optional per Objective 20 contract.
 */
export interface ReasoningRecord {
  /** Human-readable summary of why this artifact was produced as it was. */
  summary: string;
  /** Step-by-step reasoning chain from the model (extended thinking or CoT). */
  steps: string[];
  /** Actual model ID that produced this artifact. */
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** Estimated USD cost at the time of generation. */
  costUsd: number;
  generatedAt: Date;
  /** Provider used (e.g., 'anthropic', 'openai'). */
  provider: string;
}

// ── Quality signals ────────────────────────────────────────────────────────────

export interface QualitySignals {
  generationAttempts: number;
  revisionCount: number;
  approvedOnFirstPass: boolean;
  timeToApprovalMs?: number;
  /** Downstream stage that rejected this artifact, if any. */
  downstreamRejectedBy?: string;
}

// ── Artifact envelope ──────────────────────────────────────────────────────────

/**
 * Generic wrapper for all AI pipeline artifacts.
 * T is the domain-specific content type (e.g., Prd, IntentBrief).
 */
export interface Artifact<T> {
  id: string;
  workspaceId: string;
  /** Pipeline run this artifact belongs to. */
  pipelineId: string;
  /** e.g., 'prd', 'intent_brief', 'design_tokens' */
  artifactType: string;
  /** Monotonically increasing version within this artifact. */
  version: number;
  status: ArtifactStatus;
  content: T;
  reasoning: ReasoningRecord;
  qualitySignals: QualitySignals;
  /** Approval record ID, if in review or resolved. */
  approvalId?: string;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// ── Generation service abstractions ───────────────────────────────────────────

export interface PromptResult<T> {
  output: T;
  reasoning: ReasoningRecord;
  rawContent: string;
}

export interface GenerationOptions {
  /** Override the default model for this call. */
  model?: string;
  /** Max tokens to generate. */
  maxTokens?: number;
  temperature?: number;
  /** Number of retries on parse failure before giving up. */
  maxRetries?: number;
}

// ── Prompt definition ─────────────────────────────────────────────────────────

export interface PromptDefinition<TInput, TOutput> {
  id: string;
  version: string;
  description: string;
  /** Estimated cost range in USD per call. */
  estimatedCostRange: { minUsd: number; maxUsd: number };
  run: (input: TInput, options?: GenerationOptions) => Promise<PromptResult<TOutput>>;
}

// ── Zod schemas ───────────────────────────────────────────────────────────────

export const ArtifactStatusSchema = z.enum([
  'draft',
  'in_review',
  'approved',
  'rejected',
  'stale',
  'archived',
]);

export const ReasoningRecordSchema = z.object({
  summary: z.string(),
  steps: z.array(z.string()),
  model: z.string(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  costUsd: z.number().nonnegative(),
  generatedAt: z.date(),
  provider: z.string(),
});
