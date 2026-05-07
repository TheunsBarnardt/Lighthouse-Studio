import type { ArtifactRepositoryPort } from '@platform/ports-ai-artifacts';
import type {
  AIProviderPort,
  ChatMessage,
  GenerationEvent,
  GenerationRequest,
  GenerationResponse,
  ToolCallCompleteEvent,
} from '@platform/ports-ai-provider';
import type { AuditPort } from '@platform/ports-audit';
import type { AuthorizationPort, RequestContext } from '@platform/ports-authorization';
import type { LoggerPort } from '@platform/ports-observability';
import type { Result } from 'neverthrow';

import { err, ok } from 'neverthrow';
import { createHash } from 'node:crypto';

import type { ToolRegistry } from '../../ai/tool-registry.js';
import type { AppError } from '../../errors.js';
import type { CostTrackingService } from './cost-tracking.service.js';
import type { PromptService } from './prompt.service.js';

import { ForbiddenError, InternalError, ValidationError } from '../../errors.js';
import { estimateCostUsd } from './cost-tracking.service.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GenerateInput {
  ctx: RequestContext;
  promptId: string;
  inputs: unknown;
  stage: string;
  artifactId?: string;
  toolIds?: string[];
  cacheControl?: 'use_cache' | 'bypass_cache';
  providerOverride?: string;
}

export interface GenerationResult {
  content: string;
  structuredOutput?: unknown;
  reasoning?: string;
  usage: GenerationResponse['usage'];
  model: string;
  provider: string;
  durationMs: number;
  cached: boolean;
  costUsd: number;
}

// ── Service ───────────────────────────────────────────────────────────────────

export class GenerationService {
  constructor(
    private readonly authz: AuthorizationPort,
    private readonly providers: AIProviderPort[],
    private readonly prompts: PromptService,
    private readonly artifactRepo: ArtifactRepositoryPort,
    private readonly costTracking: CostTrackingService,
    private readonly tools: ToolRegistry,
    _audit: AuditPort,
    private readonly logger: LoggerPort,
  ) {}

  async generate(input: GenerateInput): Promise<Result<GenerationResult, AppError>> {
    const { ctx } = input;
    if (!ctx.workspaceId) return err(new ValidationError('Workspace context required'));

    // 1. Authorize
    const authzResult = await this.authz.authorize(ctx, `ai.${input.stage}.generate`, input.stage);
    if (authzResult.isErr())
      return err(new ForbiddenError('Not authorized to generate AI content'));

    // 2. Render prompt
    const renderResult = await this.prompts.render(ctx, input.promptId, input.inputs);
    if (renderResult.isErr()) return err(renderResult.error);
    const rendered = renderResult.value;

    // 3. Check cache
    if (input.cacheControl !== 'bypass_cache') {
      const cacheKey = this.computeCacheKey(
        rendered.systemPrompt,
        rendered.userPrompt,
        input.promptId,
      );
      const cached = await this.artifactRepo.getCached(cacheKey);
      if (cached.isOk() && cached.value) {
        const cachedResult = cached.value as GenerationResult;
        await this.costTracking.recordUsage({
          workspaceId: ctx.workspaceId,
          userId: ctx.userId,
          stage: input.stage,
          ...(input.artifactId !== undefined && { artifactId: input.artifactId }),
          promptId: input.promptId,
          promptVersion: rendered.promptVersion,
          provider: cachedResult.provider,
          model: cachedResult.model,
          inputTokens: 0,
          outputTokens: 0,
          toolUseTokens: 0,
          costUsd: 0,
          durationMs: 0,
          cached: true,
          status: 'succeeded' as const,
        });
        return ok({ ...cachedResult, cached: true });
      }
    }

    // 4. Check budget
    const loadedPrompt = await this.prompts.load(ctx, input.promptId);
    if (loadedPrompt.isErr()) return err(loadedPrompt.error);
    const estimatedTokens = (rendered.systemPrompt.length + rendered.userPrompt.length) / 4; // rough estimate
    const budgetResult = await this.costTracking.checkBudget(
      ctx.workspaceId,
      input.stage,
      estimatedTokens,
    );
    if (budgetResult.isOk() && !budgetResult.value.withinBudget) {
      return err(new ValidationError('Workspace AI budget exceeded for this month'));
    }

    // 5. Select provider
    const provider = this.selectProvider(input.providerOverride);
    if (!provider) return err(new InternalError('No AI provider available'));

    // 6. Build request
    const modelConfig = loadedPrompt.value.modelConfig;
    const resolvedTools =
      input.toolIds && input.toolIds.length > 0
        ? this.tools.getProviderDefinitions(input.toolIds)
        : undefined;
    const request: GenerationRequest = {
      model: modelConfig.model,
      systemPrompt: rendered.systemPrompt,
      messages: [{ role: 'user', content: rendered.userPrompt }],
      ...(resolvedTools !== undefined && { tools: resolvedTools }),
      ...(modelConfig.temperature !== undefined && { temperature: modelConfig.temperature }),
      ...(modelConfig.maxTokens !== undefined && { maxTokens: modelConfig.maxTokens }),
      ...(modelConfig.stopSequences !== undefined && { stopSequences: modelConfig.stopSequences }),
      metadata: {
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        promptId: input.promptId,
        promptVersion: rendered.promptVersion,
        stage: input.stage,
        correlationId: ctx.correlationId,
      },
    };

    // 7. Call provider (with retry + failover)
    const startMs = Date.now();
    let providerResult = await provider.generate(request);

    if (providerResult.isErr() && providerResult.error.retryable) {
      // Retry once
      providerResult = await provider.generate(request);
    }

    if (providerResult.isErr()) {
      // Try fallback provider
      const fallback = this.providers[1];
      if (fallback) {
        providerResult = await fallback.generate(request);
      }
    }

    if (providerResult.isErr()) {
      const error = providerResult.error;
      await this.costTracking.recordUsage({
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        stage: input.stage,
        ...(input.artifactId !== undefined && { artifactId: input.artifactId }),
        promptId: input.promptId,
        promptVersion: rendered.promptVersion,
        provider: provider.providerId,
        model: modelConfig.model,
        inputTokens: 0,
        outputTokens: 0,
        toolUseTokens: 0,
        costUsd: 0,
        durationMs: Date.now() - startMs,
        cached: false,
        status: 'failed' as const,
      });
      return err(new InternalError(`AI provider error: ${error.message}`));
    }

    const response = providerResult.value;

    // 8. Handle tool calls (if any)
    let finalContent = response.content;
    let toolUseTokens = 0;

    if (response.toolCalls && response.toolCalls.length > 0) {
      const messages: ChatMessage[] = [
        { role: 'user', content: rendered.userPrompt },
        { role: 'assistant', content: response.toolCalls },
      ];

      for (const toolCall of response.toolCalls) {
        const result = await this.tools.execute(ctx, toolCall.name, toolCall.input);
        messages.push({
          role: 'tool',
          content: [
            {
              type: 'tool_result',
              toolUseId: toolCall.id,
              content: result.isOk()
                ? JSON.stringify(result.value)
                : `Error: ${result.isErr() ? result.error.message : 'Unknown error'}`,
              isError: result.isErr(),
            },
          ],
        });
      }

      // Re-call with tool results
      const followupResult = await provider.generate({ ...request, messages });
      if (followupResult.isOk()) {
        finalContent = followupResult.value.content;
        toolUseTokens = followupResult.value.usage.inputTokens;
      }
    }

    // 9. Validate output schema
    const outputSchema = loadedPrompt.value.outputs;
    let structuredOutput: unknown;
    if (response.structuredOutput !== undefined) {
      const parsed = outputSchema.safeParse(response.structuredOutput);
      if (!parsed.success) {
        this.logger.warn('generation.output_schema_mismatch', {
          promptId: input.promptId,
          error: parsed.error.message,
        });
      } else {
        structuredOutput = parsed.data;
      }
    }

    const durationMs = Date.now() - startMs;
    const costUsd = estimateCostUsd(
      provider.providerId,
      response.model,
      response.usage.inputTokens,
      response.usage.outputTokens + toolUseTokens,
    );

    // 10. Cache the response
    if (input.cacheControl !== 'bypass_cache') {
      const cacheKey = this.computeCacheKey(
        rendered.systemPrompt,
        rendered.userPrompt,
        input.promptId,
      );
      const resultToCache: GenerationResult = {
        content: finalContent,
        structuredOutput,
        usage: response.usage,
        model: response.model,
        provider: provider.providerId,
        durationMs,
        cached: false,
        costUsd,
      };
      await this.artifactRepo.setCached(cacheKey, ctx.workspaceId, input.promptId, resultToCache);
    }

    // 11. Record cost
    await this.costTracking.recordUsage({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      stage: input.stage,
      ...(input.artifactId !== undefined && { artifactId: input.artifactId }),
      promptId: input.promptId,
      promptVersion: rendered.promptVersion,
      provider: provider.providerId,
      model: response.model,
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      toolUseTokens,
      costUsd,
      durationMs,
      cached: false,
      status: 'succeeded' as const,
    });

    return ok({
      content: finalContent,
      structuredOutput,
      usage: response.usage,
      model: response.model,
      provider: provider.providerId,
      durationMs,
      cached: false,
      costUsd,
    });
  }

  async *generateStream(input: GenerateInput): AsyncIterable<GenerationEvent> {
    const { ctx } = input;
    if (!ctx.workspaceId) {
      yield {
        type: 'error',
        code: 'invalid_request',
        message: 'Workspace context required',
        retryable: false,
      };
      return;
    }

    const authzResult = await this.authz.authorize(ctx, `ai.${input.stage}.generate`, input.stage);
    if (authzResult.isErr()) {
      yield { type: 'error', code: 'invalid_request', message: 'Not authorized', retryable: false };
      return;
    }

    const renderResult = await this.prompts.render(ctx, input.promptId, input.inputs);
    if (renderResult.isErr()) {
      yield {
        type: 'error',
        code: 'invalid_request',
        message: renderResult.error.message,
        retryable: false,
      };
      return;
    }
    const rendered = renderResult.value;

    const loadedPrompt = await this.prompts.load(ctx, input.promptId);
    if (loadedPrompt.isErr()) {
      yield {
        type: 'error',
        code: 'invalid_request',
        message: loadedPrompt.error.message,
        retryable: false,
      };
      return;
    }

    const provider = this.selectProvider(input.providerOverride);
    if (!provider) {
      yield {
        type: 'error',
        code: 'provider_error',
        message: 'No AI provider available',
        retryable: false,
      };
      return;
    }

    const modelConfig = loadedPrompt.value.modelConfig;
    const streamTools =
      input.toolIds && input.toolIds.length > 0
        ? this.tools.getProviderDefinitions(input.toolIds)
        : undefined;
    const request: GenerationRequest = {
      model: modelConfig.model,
      systemPrompt: rendered.systemPrompt,
      messages: [{ role: 'user', content: rendered.userPrompt }],
      ...(streamTools !== undefined && { tools: streamTools }),
      ...(modelConfig.temperature !== undefined && { temperature: modelConfig.temperature }),
      ...(modelConfig.maxTokens !== undefined && { maxTokens: modelConfig.maxTokens }),
      metadata: {
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        promptId: input.promptId,
        promptVersion: rendered.promptVersion,
        stage: input.stage,
        correlationId: ctx.correlationId,
      },
    };

    const startMs = Date.now();
    const pendingToolCalls = new Map<string, { name: string; inputParts: string[] }>();
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    try {
      for await (const event of provider.generateStream(request)) {
        if (event.type === 'tool_call_start') {
          pendingToolCalls.set(event.toolUseId, { name: event.toolName, inputParts: [] });
          yield event;
        } else if (event.type === 'tool_call_input_delta') {
          const tc = pendingToolCalls.get(event.toolUseId);
          if (tc) tc.inputParts.push(event.delta);
          // Don't yield input deltas to the client; they're internal
        } else if (event.type === 'done') {
          totalInputTokens = event.usage.inputTokens;
          totalOutputTokens = event.usage.outputTokens;

          // Execute pending tool calls
          if (pendingToolCalls.size > 0) {
            for (const [toolUseId, tc] of pendingToolCalls) {
              let toolInput: unknown;
              try {
                toolInput = JSON.parse(tc.inputParts.join(''));
              } catch {
                toolInput = {};
              }

              const toolResult = await this.tools.execute(ctx, tc.name, toolInput);
              const completeEvent: ToolCallCompleteEvent = {
                type: 'tool_call_complete',
                toolUseId,
                toolName: tc.name,
                input: toolInput,
                ...(toolResult.isOk() && { result: toolResult.value }),
                ...(toolResult.isErr() && { error: toolResult.error.message }),
              };
              yield completeEvent;
            }
          }

          // Record cost
          const costUsd = estimateCostUsd(
            provider.providerId,
            modelConfig.model,
            totalInputTokens,
            totalOutputTokens,
          );
          await this.costTracking.recordUsage({
            workspaceId: ctx.workspaceId,
            userId: ctx.userId,
            stage: input.stage,
            ...(input.artifactId !== undefined && { artifactId: input.artifactId }),
            promptId: input.promptId,
            promptVersion: rendered.promptVersion,
            provider: provider.providerId,
            model: modelConfig.model,
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
            toolUseTokens: 0,
            costUsd,
            durationMs: Date.now() - startMs,
            cached: false,
            status: 'succeeded' as const,
          });

          yield event;
        } else {
          yield event;
        }
      }
    } catch (e) {
      yield {
        type: 'error',
        code: 'provider_error',
        message: e instanceof Error ? e.message : String(e),
        retryable: false,
      };
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private selectProvider(override?: string): AIProviderPort | undefined {
    if (override) {
      return this.providers.find((p) => p.providerId === override);
    }
    return this.providers[0];
  }

  private computeCacheKey(systemPrompt: string, userPrompt: string, promptId: string): string {
    return createHash('sha256')
      .update(`${promptId}|${systemPrompt}|${userPrompt}`)
      .digest('hex')
      .substring(0, 64);
  }
}
