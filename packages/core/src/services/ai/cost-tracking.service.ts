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
import type { AuditPort } from '@platform/ports-audit';
import type { AuthorizationPort, RequestContext } from '@platform/ports-authorization';
import type { LoggerPort } from '@platform/ports-observability';

import { err, ok, type Result } from 'neverthrow';
import { z } from 'zod';

import type { AppError } from '../../errors.js';

import { AUDIT_EVENTS } from '../../compliance/audit-events.js';
import { toAuditActor } from '../../context.js';
import { AuthorizationError, ExternalServiceError, ValidationError } from '../../errors.js';
import { observable } from '../../observability/observable.js';

const DEFAULT_MONTHLY_BUDGET_USD = 50;
const SOFT_WARNING_PCT = 80;
const HARD_LIMIT_PCT = 100;

const DEFAULT_PER_STAGE_BUDGET_PCT: WorkspaceAiConfig['perStageBudgetPct'] = {
  intent: 5,
  prd: 10,
  design_tokens: 5,
  schema: 15,
  components: 20,
  server_functions: 20,
  tests: 10,
  deployment: 5,
  documentation: 5,
  maintenance: 5,
};

const SetBudgetInputSchema = z.object({
  workspaceId: z.string().uuid(),
  monthlyBudgetUsd: z.number().positive(),
  primaryProvider: z.string().min(1),
  fallbackProvider: z.string().optional(),
  piiRedactionEnabled: z.boolean(),
  piiRedactionOverrideConsent: z.boolean(),
});

export type SetBudgetInput = z.infer<typeof SetBudgetInputSchema>;

function wrapAiError(aiErr: AiError): AppError {
  return new ExternalServiceError('ai-tracking', aiErr.message, { cause: aiErr });
}

export class CostTrackingService {
  readonly checkBudget!: (
    ctx: RequestContext,
    workspaceId: string,
    stage: StageName,
    estimatedTokens: number,
  ) => Promise<Result<BudgetStatus, AppError>>;

  readonly recordUsage!: (
    ctx: RequestContext,
    record: Omit<AiUsageRecord, 'id' | 'createdAt'>,
  ) => Promise<Result<AiUsageRecord, AppError>>;

  readonly getWorkspaceUsage!: (
    ctx: RequestContext,
    workspaceId: string,
    opts?: UsageQueryOptions,
  ) => Promise<Result<UsageSummary, AppError>>;

  readonly setBudget!: (
    ctx: RequestContext,
    input: SetBudgetInput,
  ) => Promise<Result<WorkspaceAiConfig, AppError>>;

  constructor(
    private readonly authz: AuthorizationPort,
    private readonly tracking: CostTrackingPort,
    private readonly audit: AuditPort,
    private readonly logger: LoggerPort,
  ) {
    const obs = { logger };
    const s = 'CostTrackingService';
    this.checkBudget = observable(s, 'checkBudget', obs, this._checkBudget.bind(this));
    this.recordUsage = observable(s, 'recordUsage', obs, this._recordUsage.bind(this));
    this.getWorkspaceUsage = observable(
      s,
      'getWorkspaceUsage',
      obs,
      this._getWorkspaceUsage.bind(this),
    );
    this.setBudget = observable(s, 'setBudget', obs, this._setBudget.bind(this));
  }

  private async _checkBudget(
    _ctx: RequestContext,
    workspaceId: string,
    stage: StageName,
    estimatedTokens: number,
  ): Promise<Result<BudgetStatus, AppError>> {
    const configResult = await this.tracking.getConfig(workspaceId);
    if (configResult.isErr()) return err(wrapAiError(configResult.error));

    const budgetUsd = configResult.value?.monthlyBudgetUsd ?? DEFAULT_MONTHLY_BUDGET_USD;

    const usageResult = await this.tracking.getWorkspaceUsage(workspaceId, { groupBy: 'month' });
    if (usageResult.isErr()) return err(wrapAiError(usageResult.error));

    const usedUsd = usageResult.value.totalCostUsd;
    // ~$15 per million tokens (rough mid-range estimate)
    const estimatedAdditionalUsd = (estimatedTokens / 1_000_000) * 15;
    const projectedUsd = usedUsd + estimatedAdditionalUsd;
    const projectedPct = (projectedUsd / budgetUsd) * 100;
    const usedPct = (usedUsd / budgetUsd) * 100;

    this.logger.debug('cost.budget_check', {
      workspaceId,
      stage,
      estimatedTokens,
      usedPct,
      projectedPct,
    });

    if (projectedPct >= HARD_LIMIT_PCT) {
      return ok({ withinBudget: false, reason: 'hard_limit', usedPct });
    }
    if (usedPct >= SOFT_WARNING_PCT) {
      return ok({ withinBudget: false, reason: 'soft_warning', usedPct });
    }
    return ok({ withinBudget: true, usedPct });
  }

  private async _recordUsage(
    ctx: RequestContext,
    record: Omit<AiUsageRecord, 'id' | 'createdAt'>,
  ): Promise<Result<AiUsageRecord, AppError>> {
    const result = await this.tracking.recordUsage(record);
    if (result.isErr()) return err(wrapAiError(result.error));

    await this._fireBudgetWarningIfNeeded(ctx, record['workspaceId']);

    return ok(result.value);
  }

  private async _getWorkspaceUsage(
    ctx: RequestContext,
    workspaceId: string,
    opts?: UsageQueryOptions,
  ): Promise<Result<UsageSummary, AppError>> {
    const authResult = await this.authz.authorize(ctx, 'ai.usage.read', 'workspace', {
      resourceId: workspaceId,
    });
    if (authResult.isErr()) return err(new AuthorizationError(authResult.error.message));

    const result = await this.tracking.getWorkspaceUsage(workspaceId, opts);
    if (result.isErr()) return err(wrapAiError(result.error));
    return ok(result.value);
  }

  private async _setBudget(
    ctx: RequestContext,
    input: SetBudgetInput,
  ): Promise<Result<WorkspaceAiConfig, AppError>> {
    const parsed = SetBudgetInputSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        new ValidationError(
          'Invalid budget input',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
    }

    const authResult = await this.authz.authorize(ctx, 'ai.budget.write', 'workspace', {
      resourceId: input.workspaceId,
    });
    if (authResult.isErr()) return err(new AuthorizationError(authResult.error.message));

    const existing = await this.tracking.getConfig(input.workspaceId);
    const perStageBudgetPct =
      existing.isOk() && existing.value
        ? existing.value.perStageBudgetPct
        : DEFAULT_PER_STAGE_BUDGET_PCT;

    const config: WorkspaceAiConfig = {
      workspaceId: input.workspaceId,
      primaryProvider: input.primaryProvider,
      ...(input.fallbackProvider !== undefined ? { fallbackProvider: input.fallbackProvider } : {}),
      monthlyBudgetUsd: input.monthlyBudgetUsd,
      perStageBudgetPct,
      piiRedactionEnabled: input.piiRedactionEnabled,
      piiRedactionOverrideConsent: input.piiRedactionOverrideConsent,
    };

    const result = await this.tracking.saveConfig(config);
    if (result.isErr()) return err(wrapAiError(result.error));

    await this.audit.write({
      eventType: AUDIT_EVENTS.AI_BUDGET_UPDATED,
      actor: toAuditActor(ctx),
      resource: { type: 'workspace', id: input.workspaceId },
      action: 'updated',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { workspaceId: input.workspaceId, monthlyBudgetUsd: input.monthlyBudgetUsd },
    });

    return ok(result.value);
  }

  private async _fireBudgetWarningIfNeeded(
    ctx: RequestContext,
    workspaceId: string,
  ): Promise<void> {
    const [configResult, usageResult] = await Promise.all([
      this.tracking.getConfig(workspaceId),
      this.tracking.getWorkspaceUsage(workspaceId, { groupBy: 'month' }),
    ]);
    if (configResult.isErr() || usageResult.isErr()) return;

    const budgetUsd = configResult.value?.monthlyBudgetUsd ?? DEFAULT_MONTHLY_BUDGET_USD;
    const usedPct = (usageResult.value.totalCostUsd / budgetUsd) * 100;

    let eventType: string | null = null;
    if (usedPct >= HARD_LIMIT_PCT) {
      eventType = AUDIT_EVENTS.AI_BUDGET_EXCEEDED;
    } else if (usedPct >= 95) {
      eventType = AUDIT_EVENTS.AI_BUDGET_WARNING_95;
    } else if (usedPct >= SOFT_WARNING_PCT) {
      eventType = AUDIT_EVENTS.AI_BUDGET_WARNING_80;
    }

    if (eventType) {
      await this.audit.write({
        eventType,
        actor: toAuditActor(ctx),
        resource: { type: 'workspace', id: workspaceId },
        action: eventType.split('.').at(-1) ?? 'warning',
        outcome: 'success',
        correlationId: ctx.correlationId,
        metadata: { workspaceId, usedPct },
      });
    }
  }
}
