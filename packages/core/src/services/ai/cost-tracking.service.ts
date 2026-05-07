import type {
  AiUsageRecord,
  ArtifactRepositoryPort,
  BudgetStatus,
  UsageSummary,
} from '@platform/ports-ai-artifacts';
import type { LoggerPort } from '@platform/ports-observability';
import type { Result } from 'neverthrow';

import { err, ok } from 'neverthrow';
import { uuidv7 } from 'uuidv7';

import type { AppError } from '../../errors.js';

import { InternalError } from '../../errors.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RecordUsageInput {
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
  status: AiUsageRecord['status'];
}

export interface UsageQueryOptions {
  startDate?: Date;
  endDate?: Date;
  stage?: string;
}

// ── Provider pricing (USD per 1M tokens) ─────────────────────────────────────

const PROVIDER_PRICING: Record<string, { input: number; output: number }> = {
  'anthropic/claude-opus-4-7': { input: 15, output: 75 },
  'anthropic/claude-sonnet-4-6': { input: 3, output: 15 },
  'anthropic/claude-haiku-4-5-20251001': { input: 0.8, output: 4 },
};

export function estimateCostUsd(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const key = `${provider}/${model}`;
  const pricing = PROVIDER_PRICING[key] ?? { input: 10, output: 30 };
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}

// ── Service ───────────────────────────────────────────────────────────────────

export class CostTrackingService {
  constructor(
    private readonly artifactRepo: ArtifactRepositoryPort,
    private readonly logger: LoggerPort,
  ) {}

  async checkBudget(
    workspaceId: string,
    stage: string,
    estimatedTokens: number,
  ): Promise<Result<BudgetStatus, AppError>> {
    const result = await this.artifactRepo.checkBudget(workspaceId, stage, estimatedTokens);
    if (result.isErr()) {
      return err(new InternalError(`Budget check failed: ${result.error.message}`));
    }
    return ok(result.value);
  }

  async recordUsage(input: RecordUsageInput): Promise<Result<void, AppError>> {
    const record: AiUsageRecord = {
      id: uuidv7(),
      workspaceId: input.workspaceId,
      ...(input.userId !== undefined && { userId: input.userId }),
      stage: input.stage,
      ...(input.artifactId !== undefined && { artifactId: input.artifactId }),
      promptId: input.promptId,
      promptVersion: input.promptVersion,
      provider: input.provider,
      model: input.model,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      toolUseTokens: input.toolUseTokens,
      costUsd: input.costUsd,
      durationMs: input.durationMs,
      cached: input.cached,
      status: input.status,
      createdAt: new Date(),
    };

    const result = await this.artifactRepo.recordUsage(record);
    if (result.isErr()) {
      this.logger.error('cost-tracking.record_usage.failed', { error: result.error });
      return err(new InternalError(`Failed to record usage: ${result.error.message}`));
    }
    return ok(undefined);
  }

  async getWorkspaceUsage(
    workspaceId: string,
    opts: UsageQueryOptions,
  ): Promise<Result<UsageSummary, AppError>> {
    const result = await this.artifactRepo.getUsageSummary(workspaceId, opts);
    if (result.isErr()) {
      return err(new InternalError(`Failed to get usage summary: ${result.error.message}`));
    }
    return ok(result.value);
  }
}
