import type {
  AiUsageRecord,
  BudgetStatus,
  CostTrackingPort,
  StageName,
  UsageQueryOptions,
  UsageSummary,
  WorkspaceAiConfig,
} from '@platform/ports-ai';
import type { AiError } from '@platform/ports-ai';
import type { Result } from 'neverthrow';

import { ok } from 'neverthrow';
import { uuidv7 } from 'uuidv7';

export class InMemoryCostTracking implements CostTrackingPort {
  readonly usageRecords: AiUsageRecord[] = [];
  private readonly configs = new Map<string, WorkspaceAiConfig>();

  checkBudget(
    workspaceId: string,
    _stage: StageName,
    _estimatedTokens: number,
  ): Promise<Result<BudgetStatus, AiError>> {
    const config = this.configs.get(workspaceId);
    const budget = config?.monthlyBudgetUsd ?? 50;
    const used = this.usageRecords
      .filter((r) => r.workspaceId === workspaceId)
      .reduce((sum, r) => sum + r.costUsd, 0);
    const usedPct = (used / budget) * 100;
    if (usedPct >= 100)
      return Promise.resolve(ok({ withinBudget: false, reason: 'hard_limit', usedPct }));
    if (usedPct >= 80)
      return Promise.resolve(ok({ withinBudget: false, reason: 'soft_warning', usedPct }));
    return Promise.resolve(ok({ withinBudget: true, usedPct }));
  }

  recordUsage(
    record: Omit<AiUsageRecord, 'id' | 'createdAt'>,
  ): Promise<Result<AiUsageRecord, AiError>> {
    const full: AiUsageRecord = { ...record, id: uuidv7(), createdAt: new Date() };
    this.usageRecords.push(full);
    return Promise.resolve(ok(full));
  }

  getWorkspaceUsage(
    workspaceId: string,
    opts?: UsageQueryOptions,
  ): Promise<Result<UsageSummary, AiError>> {
    const records = this.usageRecords.filter((r) => r.workspaceId === workspaceId);
    const summary: UsageSummary = {
      totalInputTokens: records.reduce((s, r) => s + r.inputTokens, 0),
      totalOutputTokens: records.reduce((s, r) => s + r.outputTokens, 0),
      totalToolUseTokens: records.reduce((s, r) => s + r.toolUseTokens, 0),
      totalCostUsd: records.reduce((s, r) => s + r.costUsd, 0),
    };
    if (opts?.groupBy === 'stage') {
      summary.byStage = {};
      for (const r of records) {
        const s = (summary.byStage[r.stage] ??= { inputTokens: 0, outputTokens: 0, costUsd: 0 });
        s.inputTokens += r.inputTokens;
        s.outputTokens += r.outputTokens;
        s.costUsd += r.costUsd;
      }
    }
    return Promise.resolve(ok(summary));
  }

  getConfig(workspaceId: string): Promise<Result<WorkspaceAiConfig | null, AiError>> {
    return Promise.resolve(ok(this.configs.get(workspaceId) ?? null));
  }

  saveConfig(config: WorkspaceAiConfig): Promise<Result<WorkspaceAiConfig, AiError>> {
    this.configs.set(config.workspaceId, config);
    return Promise.resolve(ok(config));
  }
}
