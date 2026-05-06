import type { Result } from 'neverthrow';

import type { AiError } from './errors.js';
import type { AiUsageRecord, BudgetStatus, StageName, WorkspaceAiConfig } from './types.js';

export interface UsageQueryOptions {
  stage?: StageName;
  startDate?: Date;
  endDate?: Date;
  groupBy?: 'day' | 'month' | 'stage' | 'provider';
}

export interface UsageSummary {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalToolUseTokens: number;
  totalCostUsd: number;
  byStage?: Record<string, { inputTokens: number; outputTokens: number; costUsd: number }>;
  byProvider?: Record<string, { inputTokens: number; outputTokens: number; costUsd: number }>;
}

export interface CostTrackingPort {
  /** Check if a workspace is within budget for a stage before generating. */
  checkBudget(
    workspaceId: string,
    stage: StageName,
    estimatedTokens: number,
  ): Promise<Result<BudgetStatus, AiError>>;

  /** Record actual usage after a generation completes. */
  recordUsage(
    record: Omit<AiUsageRecord, 'id' | 'createdAt'>,
  ): Promise<Result<AiUsageRecord, AiError>>;

  /** Aggregate usage for reporting. */
  getWorkspaceUsage(
    workspaceId: string,
    opts?: UsageQueryOptions,
  ): Promise<Result<UsageSummary, AiError>>;

  /** Read the current workspace AI config (budget, providers, PII settings). */
  getConfig(workspaceId: string): Promise<Result<WorkspaceAiConfig | null, AiError>>;

  /** Upsert workspace AI config. */
  saveConfig(config: WorkspaceAiConfig): Promise<Result<WorkspaceAiConfig, AiError>>;
}
