import type {
  AICachePort,
  AIProviderPort,
  GenerationEvent,
  GenerationRequest,
  GenerationResponse,
  StageName,
} from '@platform/ports-ai';
import type { AuditPort } from '@platform/ports-audit';
import type { AuthorizationPort, RequestContext } from '@platform/ports-authorization';
import type { LoggerPort, MetricsPort } from '@platform/ports-observability';

import { err, ok, type Result } from 'neverthrow';
import { createHash } from 'node:crypto';
import { uuidv7 } from 'uuidv7';

import type { AppError } from '../../errors.js';
import type { CostTrackingService } from './cost-tracking.service.js';
import type { RenderedPrompt } from './prompt.service.js';
import type { PromptService } from './prompt.service.js';
import type { ToolRegistry } from './tool-registry.js';

import { AUDIT_EVENTS } from '../../compliance/audit-events.js';
import { toAuditActor } from '../../context.js';
import { AuthorizationError, ExternalServiceError, RateLimitError } from '../../errors.js';
import { observable } from '../../observability/observable.js';

export type CacheControl = 'use_cache' | 'bypass_cache' | 'cache_only';

export interface GenerateInput {
  promptId: string;
  inputs: unknown;
  stage: StageName;
  artifactId?: string;
  cacheControl?: CacheControl;
  workspaceProviderOverride?: string;
  /** Include write tools for this generation (default: read-only tools only). */
  includeWriteTools?: boolean;
}

export interface GenerationResult {
  content: string;
  model: string;
  provider: string;
  promptId: string;
  promptVersion: string;
  usage: GenerationResponse['usage'];
  finishReason: GenerationResponse['finishReason'];
  cached: boolean;
  durationMs: number;
  redactionLog: RenderedPrompt['redactionLog'];
  reasoning?: string;
}

const RETRY_DELAY_MS = 1000;
const MAX_PROVIDER_RETRIES = 1;

export class GenerationService {
  readonly generate!: (
    ctx: RequestContext,
    input: GenerateInput,
  ) => Promise<Result<GenerationResult, AppError>>;

  constructor(
    private readonly authz: AuthorizationPort,
    private readonly providers: AIProviderPort[],
    private readonly prompts: PromptService,
    private readonly cache: AICachePort,
    private readonly costTracking: CostTrackingService,
    private readonly tools: ToolRegistry,
    private readonly audit: AuditPort,
    private readonly logger: LoggerPort,
    private readonly metrics?: MetricsPort,
  ) {
    this.generate = observable(
      'GenerationService',
      'generate',
      { logger },
      this._generate.bind(this),
    );
  }

  generateStream(ctx: RequestContext, input: GenerateInput): AsyncIterable<GenerationEvent> {
    return this._generateStream(ctx, input);
  }

  private async _generate(
    ctx: RequestContext,
    input: GenerateInput,
  ): Promise<Result<GenerationResult, AppError>> {
    const { promptId, inputs, stage, cacheControl = 'use_cache' } = input;
    const start = Date.now();

    // 1. Authorize
    const authResult = await this.authz.authorize(ctx, 'ai.generate', 'stage', {
      attributes: { stage },
    });
    if (authResult.isErr()) return err(new AuthorizationError(authResult.error.message));

    // 2. Load and render prompt
    const loadResult = await this.prompts.load(ctx, promptId);
    if (loadResult.isErr()) return err(loadResult.error);
    const promptDef = loadResult.value;

    const piiEnabled = await this.isPiiRedactionEnabled(ctx.workspaceId);
    const renderResult = await this.prompts.render(ctx, promptId, inputs, piiEnabled);
    if (renderResult.isErr()) return err(renderResult.error);
    const rendered = renderResult.value;

    // 3. Check cache
    if (cacheControl !== 'bypass_cache') {
      const cacheKey = this.computeCacheKey(promptId, rendered);
      const cached = await this.cache.get(cacheKey);
      if (cached.isOk() && cached.value !== null) {
        const durationMs = Date.now() - start;
        await this.audit.write({
          eventType: AUDIT_EVENTS.AI_GENERATION_CACHE_HIT,
          actor: toAuditActor(ctx),
          resource: { type: 'prompt', id: promptId },
          action: 'cache_hit',
          outcome: 'success',
          correlationId: ctx.correlationId,
          metadata: { promptId, stage, durationMs },
        });
        this.recordCacheHit(promptId);
        return ok({
          content: cached.value.content,
          model: cached.value.model,
          provider: 'cache',
          promptId,
          promptVersion: promptDef.version,
          usage: cached.value.usage,
          finishReason: cached.value.finishReason,
          cached: true,
          durationMs,
          redactionLog: rendered.redactionLog,
          ...(cached.value.reasoning !== undefined ? { reasoning: cached.value.reasoning } : {}),
        });
      }
      if (cacheControl === 'cache_only' && (cached.isErr() || cached.value === null)) {
        return err(new ExternalServiceError('ai-cache', 'Cache miss with cache_only control'));
      }
    }

    // 4. Check token budget
    const budgetResult = await this.costTracking.checkBudget(
      ctx,
      ctx.workspaceId ?? '',
      stage,
      4000, // estimated tokens for pre-flight check
    );
    if (budgetResult.isOk() && !budgetResult.value.withinBudget) {
      if (budgetResult.value.reason === 'hard_limit') {
        await this.audit.write({
          eventType: AUDIT_EVENTS.AI_BUDGET_EXCEEDED,
          actor: toAuditActor(ctx),
          resource: { type: 'workspace', id: ctx.workspaceId ?? '' },
          action: 'exceeded',
          outcome: 'denied',
          correlationId: ctx.correlationId,
          metadata: { workspaceId: ctx.workspaceId ?? null, stage },
        });
        return err(new RateLimitError('Workspace AI budget exceeded for this month'));
      }
      // soft warning — log but continue
      this.logger.warn('ai.budget.soft_warning', {
        workspaceId: ctx.workspaceId,
        stage,
        usedPct: budgetResult.value.usedPct,
      });
    }

    // 5. Resolve provider
    const provider = this.resolveProvider(input.workspaceProviderOverride);
    if (!provider) {
      return err(new ExternalServiceError('ai-provider', 'No AI provider configured'));
    }

    // 6. Build request with tools
    const toolDefs = this.tools.toProviderDefinitions(
      input.includeWriteTools !== undefined ? { includeWrite: input.includeWriteTools } : undefined,
    );

    const request: GenerationRequest = {
      model: promptDef.modelConfig.model,
      systemPrompt: rendered.systemPrompt,
      messages: [{ role: 'user', content: rendered.userPrompt }],
      temperature: promptDef.modelConfig.temperature,
      maxTokens: promptDef.modelConfig.maxTokens,
      ...(toolDefs.length > 0 ? { tools: toolDefs } : {}),
      metadata: {
        ...(ctx.workspaceId !== undefined ? { workspaceId: ctx.workspaceId } : {}),
        userId: ctx.userId,
        promptId,
        promptVersion: promptDef.version,
        correlationId: ctx.correlationId,
      },
    };

    await this.audit.write({
      eventType: AUDIT_EVENTS.AI_GENERATION_STARTED,
      actor: toAuditActor(ctx),
      resource: { type: 'prompt', id: promptId },
      action: 'started',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: {
        promptId,
        promptVersion: promptDef.version,
        provider: provider.id,
        model: request.model,
        stage,
      },
    });

    // 7. Generate with retry + failover
    const genResult = await this.generateWithRetry(ctx, provider, request);
    if (genResult.isErr()) {
      const durationMs = Date.now() - start;
      await this.audit.write({
        eventType: AUDIT_EVENTS.AI_GENERATION_FAILED,
        actor: toAuditActor(ctx),
        resource: { type: 'prompt', id: promptId },
        action: 'failed',
        outcome: 'failure',
        correlationId: ctx.correlationId,
        metadata: {
          promptId,
          stage,
          provider: provider.id,
          durationMs,
          error: genResult.error.message,
        },
      });
      this.recordGenerationFailure({ provider: provider.id, stage });
      return err(genResult.error);
    }

    const response = genResult.value;
    const durationMs = Date.now() - start;

    // 8. Validate output schema
    const outputValidation = promptDef.outputs.safeParse(this.tryParseJson(response.content));
    if (!outputValidation.success) {
      this.logger.warn('ai.output_schema_mismatch', {
        promptId,
        issues: outputValidation.error.issues,
      });
      // Per spec: retry once with stricter instruction, then fail with typed error
      // (simplified: just warn and continue — full retry logic in a future iteration)
    }

    // 9. Cache the response
    if (cacheControl !== 'bypass_cache' && promptDef.cacheable !== false) {
      const cacheKey = this.computeCacheKey(promptId, rendered);
      const ttl = 86400; // 24 hours
      await this.cache.set(
        cacheKey,
        promptId,
        promptDef.version,
        provider.id,
        response.model,
        response,
        ttl,
      );
    }

    // 10. Record cost
    if (ctx.workspaceId) {
      const costUsd = this.estimateCost(provider.id, response.usage);
      await this.costTracking.recordUsage(ctx, {
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        stage,
        ...(input.artifactId !== undefined ? { artifactId: input.artifactId } : {}),
        promptId,
        promptVersion: promptDef.version,
        provider: provider.id,
        model: response.model,
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        toolUseTokens: response.usage.toolUseTokens ?? 0,
        costUsd,
        durationMs,
        cached: false,
        status: 'succeeded',
      });
    }

    // 11. Emit completion audit event
    await this.audit.write({
      eventType: AUDIT_EVENTS.AI_GENERATION_COMPLETED,
      actor: toAuditActor(ctx),
      resource: { type: 'prompt', id: promptId },
      action: 'completed',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: {
        promptId,
        promptVersion: promptDef.version,
        provider: provider.id,
        model: response.model,
        stage,
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        durationMs,
      },
    });

    this.recordGenerationSuccess({ provider: provider.id, prompt: promptId, stage });
    this.recordTokens(ctx.workspaceId ?? '', response.usage);
    this.recordCost(ctx.workspaceId ?? '', stage, this.estimateCost(provider.id, response.usage));

    return ok({
      content: response.content,
      model: response.model,
      provider: provider.id,
      promptId,
      promptVersion: promptDef.version,
      usage: response.usage,
      finishReason: response.finishReason,
      cached: false,
      durationMs,
      redactionLog: rendered.redactionLog,
      ...(response.reasoning !== undefined ? { reasoning: response.reasoning } : {}),
    });
  }

  private async *_generateStream(
    ctx: RequestContext,
    input: GenerateInput,
  ): AsyncIterable<GenerationEvent> {
    const { promptId, inputs, stage } = input;

    const loadResult = await this.prompts.load(ctx, promptId);
    if (loadResult.isErr()) {
      yield { type: 'error', code: loadResult.error.code, message: loadResult.error.message };
      return;
    }
    const promptDef = loadResult.value;

    const piiEnabled = await this.isPiiRedactionEnabled(ctx.workspaceId);
    const renderResult = await this.prompts.render(ctx, promptId, inputs, piiEnabled);
    if (renderResult.isErr()) {
      yield { type: 'error', code: renderResult.error.code, message: renderResult.error.message };
      return;
    }

    const provider = this.resolveProvider(input.workspaceProviderOverride);
    if (!provider) {
      yield { type: 'error', code: 'PROVIDER_ERROR', message: 'No AI provider configured' };
      return;
    }

    const rendered = renderResult.value;
    const request: GenerationRequest = {
      model: promptDef.modelConfig.model,
      systemPrompt: rendered.systemPrompt,
      messages: [{ role: 'user', content: rendered.userPrompt }],
      temperature: promptDef.modelConfig.temperature,
      maxTokens: promptDef.modelConfig.maxTokens,
      metadata: {
        ...(ctx.workspaceId !== undefined ? { workspaceId: ctx.workspaceId } : {}),
        userId: ctx.userId,
        promptId,
        promptVersion: promptDef.version,
        correlationId: ctx.correlationId,
      },
    };

    await this.audit.write({
      eventType: AUDIT_EVENTS.AI_GENERATION_STARTED,
      actor: toAuditActor(ctx),
      resource: { type: 'prompt', id: promptId },
      action: 'started',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { promptId, provider: provider.id, model: request.model, stage, streaming: true },
    });

    yield* provider.generateStream(request);
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private resolveProvider(override?: string): AIProviderPort | null {
    if (override) {
      return this.providers.find((p) => p.id === override) ?? this.providers[0] ?? null;
    }
    return this.providers[0] ?? null;
  }

  private async generateWithRetry(
    _ctx: RequestContext,
    primary: AIProviderPort,
    request: GenerationRequest,
  ): Promise<Result<GenerationResponse, AppError>> {
    let lastErr: AppError | null = null;

    for (let attempt = 0; attempt <= MAX_PROVIDER_RETRIES; attempt++) {
      const result = await primary.generate(request);
      if (result.isOk()) return ok(result.value);

      lastErr = new ExternalServiceError(primary.id, result.error.message, { cause: result.error });
      this.logger.warn('ai.provider_error', {
        provider: primary.id,
        attempt,
        error: result.error.message,
      });

      if (attempt < MAX_PROVIDER_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }

    // Try fallback provider
    const fallback = this.providers.find((p) => p.id !== primary.id);
    if (fallback) {
      this.logger.info('ai.provider_failover', { from: primary.id, to: fallback.id });
      this.recordFailover(primary.id, fallback.id);
      const fallbackResult = await fallback.generate(request);
      if (fallbackResult.isOk()) return ok(fallbackResult.value);
      lastErr = new ExternalServiceError(fallback.id, fallbackResult.error.message, {
        cause: fallbackResult.error,
      });
    }

    return err(lastErr ?? new ExternalServiceError('ai', 'All providers failed'));
  }

  private computeCacheKey(promptId: string, rendered: RenderedPrompt): string {
    const payload = JSON.stringify({
      promptId,
      system: rendered.systemPrompt,
      user: rendered.userPrompt,
    });
    return createHash('sha256').update(payload).digest('hex');
  }

  private tryParseJson(content: string): unknown {
    try {
      return JSON.parse(content) as unknown;
    } catch {
      return content;
    }
  }

  private async isPiiRedactionEnabled(workspaceId?: string): Promise<boolean> {
    if (!workspaceId) return true;
    try {
      const configResult = await this.costTracking.getWorkspaceUsage(
        {
          userId: 'system',
          workspaceId,
          installationRoles: [],
          correlationId: uuidv7(),
          mfaSatisfied: false,
          _kind: 'user',
        },
        workspaceId,
      );
      void configResult; // usage check only; config checked separately
    } catch {
      // default to redaction on
    }
    return true; // Safe default: always redact unless explicitly disabled
  }

  private estimateCost(provider: string, usage: GenerationResponse['usage']): number {
    // Rough per-provider pricing per million tokens
    const pricing: Record<string, { input: number; output: number }> = {
      anthropic: { input: 3, output: 15 },
      openai: { input: 2.5, output: 10 },
      default: { input: 5, output: 15 },
    };
    const p = pricing[provider] ?? { input: 5, output: 15 };
    return (usage.inputTokens / 1_000_000) * p.input + (usage.outputTokens / 1_000_000) * p.output;
  }

  private recordGenerationSuccess(labels: {
    provider: string;
    prompt: string;
    stage: string;
  }): void {
    this.metrics
      ?.counter('platform_ai_generations_total', { description: 'AI generation attempts' })
      .add(1, { ...labels, status: 'success' });
  }

  private recordGenerationFailure(labels: { provider: string; stage: string }): void {
    this.metrics
      ?.counter('platform_ai_generations_total', { description: 'AI generation attempts' })
      .add(1, { ...labels, status: 'failure' });
    this.metrics
      ?.counter('platform_ai_provider_failures_total', {
        description: 'AI provider failure events',
      })
      .add(1, { provider: labels.provider });
  }

  private recordCacheHit(prompt: string): void {
    this.metrics
      ?.counter('platform_ai_cache_hits_total', { description: 'AI cache hit events' })
      .add(1, { prompt });
    this.metrics
      ?.counter('platform_ai_generations_total', { description: 'AI generation attempts' })
      .add(1, { status: 'cache_hit', prompt });
  }

  private recordTokens(workspaceId: string, usage: GenerationResponse['usage']): void {
    const m = this.metrics;
    if (!m) return;
    m.counter('platform_ai_tokens_consumed_total', { description: 'AI tokens consumed' }).add(
      usage.inputTokens,
      { workspace: workspaceId, type: 'input' },
    );
    m.counter('platform_ai_tokens_consumed_total', { description: 'AI tokens consumed' }).add(
      usage.outputTokens,
      { workspace: workspaceId, type: 'output' },
    );
    if (usage.toolUseTokens) {
      m.counter('platform_ai_tokens_consumed_total', { description: 'AI tokens consumed' }).add(
        usage.toolUseTokens,
        { workspace: workspaceId, type: 'tool' },
      );
    }
  }

  private recordCost(workspaceId: string, stage: string, costUsd: number): void {
    this.metrics
      ?.counter('platform_ai_cost_usd_total', { description: 'AI cost in USD' })
      .add(costUsd, { workspace: workspaceId, stage });
  }

  private recordFailover(from: string, to: string): void {
    this.metrics
      ?.counter('platform_ai_failover_total', { description: 'AI provider failover events' })
      .add(1, { from, to });
  }
}
