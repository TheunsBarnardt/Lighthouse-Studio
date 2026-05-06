import type Anthropic from '@anthropic-ai/sdk';
import type {
  AIProviderCapabilities,
  AIProviderPort,
  AiError,
  GenerationEvent,
  GenerationRequest,
  GenerationResponse,
  HealthStatus,
  ModelInfo,
  ToolCall,
} from '@platform/ports-ai';
import type { Result } from 'neverthrow';

import { err, ok } from 'neverthrow';

import { toAiError } from './errors.js';

export interface AnthropicAdapterConfig {
  apiKey: string;
  baseURL?: string;
  defaultModel?: string;
}

const DEFAULT_MODEL = 'claude-sonnet-4-6';

const KNOWN_MODELS: ModelInfo[] = [
  {
    id: 'claude-opus-4-7',
    displayName: 'Claude Opus 4.7',
    contextWindow: 200000,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'claude-sonnet-4-6',
    displayName: 'Claude Sonnet 4.6',
    contextWindow: 200000,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'claude-haiku-4-5-20251001',
    displayName: 'Claude Haiku 4.5',
    contextWindow: 200000,
    supportsTools: true,
    supportsStreaming: true,
  },
];

export class AnthropicAdapter implements AIProviderPort {
  readonly id = 'anthropic';

  readonly capabilities: AIProviderCapabilities = {
    streaming: true,
    toolUse: true,
    structuredOutput: true,
    imageInput: true,
    maxContextTokens: 200000,
  };

  private readonly client: Anthropic;
  private readonly defaultModel: string;

  constructor(config: AnthropicAdapterConfig) {
    // Dynamic import used so the package can typecheck without the SDK installed
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/consistent-type-imports
    const AnthropicSDK = require('@anthropic-ai/sdk') as typeof import('@anthropic-ai/sdk');
    this.client = new AnthropicSDK.Anthropic({
      apiKey: config.apiKey,
      ...(config.baseURL ? { baseURL: config.baseURL } : {}),
    });
    this.defaultModel = config.defaultModel ?? DEFAULT_MODEL;
  }

  listModels(): Promise<Result<ModelInfo[], AiError>> {
    return Promise.resolve(ok(KNOWN_MODELS));
  }

  async generate(request: GenerationRequest): Promise<Result<GenerationResponse, AiError>> {
    try {
      const messages = this.toAnthropicMessages(request);
      const tools = this.toAnthropicTools(request.tools);

      const response = await this.client.messages.create({
        model: request.model || this.defaultModel,
        max_tokens: request.maxTokens ?? 4096,
        ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
        ...(request.systemPrompt !== undefined ? { system: request.systemPrompt } : {}),
        messages,
        ...(tools.length > 0 ? { tools } : {}),
        ...(request.stopSequences?.length ? { stop_sequences: request.stopSequences } : {}),
      });

      const textContent = response.content
        .filter((c): c is Anthropic.TextBlock => c.type === 'text')
        .map((c) => c.text)
        .join('');

      const toolCalls: ToolCall[] = response.content
        .filter((c): c is Anthropic.ToolUseBlock => c.type === 'tool_use')
        .map((c) => ({
          id: c.id,
          toolId: c.name,
          name: c.name,
          parameters: c.input as Record<string, unknown>,
        }));

      return ok({
        content: textContent,
        model: response.model,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        },
        finishReason: this.mapStopReason(response.stop_reason),
        ...(toolCalls.length > 0 ? { toolCalls } : {}),
      });
    } catch (error: unknown) {
      return err(toAiError(error));
    }
  }

  async *generateStream(request: GenerationRequest): AsyncIterable<GenerationEvent> {
    try {
      const messages = this.toAnthropicMessages(request);
      const tools = this.toAnthropicTools(request.tools);

      // eslint-disable-next-line @typescript-eslint/await-thenable
      const stream = await this.client.messages.stream({
        model: request.model || this.defaultModel,
        max_tokens: request.maxTokens ?? 4096,
        ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
        ...(request.systemPrompt !== undefined ? { system: request.systemPrompt } : {}),
        messages,
        ...(tools.length > 0 ? { tools } : {}),
        ...(request.stopSequences?.length ? { stop_sequences: request.stopSequences } : {}),
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            yield { type: 'text_delta', delta: event.delta.text };
          }
        } else if (event.type === 'content_block_start') {
          if (event.content_block.type === 'tool_use') {
            yield {
              type: 'tool_call_start',
              toolId: event.content_block.name,
              callId: event.content_block.id,
              name: event.content_block.name,
            };
          }
        } else if (event.type === 'message_stop') {
          const final = await stream.finalMessage();
          yield {
            type: 'done',
            usage: {
              inputTokens: final.usage.input_tokens,
              outputTokens: final.usage.output_tokens,
              totalTokens: final.usage.input_tokens + final.usage.output_tokens,
            },
            finishReason: this.mapStopReason(final.stop_reason),
          };
        }
      }
    } catch (error: unknown) {
      const aiErr = toAiError(error);
      yield { type: 'error', code: aiErr.code, message: aiErr.message };
    }
  }

  async countTokens(text: string, model: string): Promise<Result<number, AiError>> {
    try {
      const response = await this.client.messages.countTokens({
        model: model || this.defaultModel,
        messages: [{ role: 'user', content: text }],
      });
      return ok(response.input_tokens);
    } catch (_error: unknown) {
      // Fallback to character-based estimate if API fails
      return ok(Math.ceil(text.length / 4));
    }
  }

  async healthCheck(): Promise<Result<HealthStatus, AiError>> {
    const start = Date.now();
    try {
      await this.client.messages.create({
        model: this.defaultModel,
        max_tokens: 5,
        messages: [{ role: 'user', content: 'ping' }],
      });
      return ok({ healthy: true, latencyMs: Date.now() - start });
    } catch (error: unknown) {
      return ok({ healthy: false, latencyMs: Date.now() - start, message: String(error) });
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private toAnthropicMessages(
    request: GenerationRequest,
  ): Array<{ role: 'user' | 'assistant'; content: string }> {
    return request.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
  }

  private toAnthropicTools(tools?: GenerationRequest['tools']): Anthropic.Tool[] {
    if (!tools || tools.length === 0) return [];
    return tools.map((t) => ({
      name: t.id,
      description: t.description,
      input_schema: {
        type: 'object' as const,
        ...(t.parameters as Record<string, unknown>),
      },
    }));
  }

  private mapStopReason(reason: string | null | undefined): GenerationResponse['finishReason'] {
    switch (reason) {
      case 'end_turn':
        return 'stop';
      case 'max_tokens':
        return 'max_tokens';
      case 'tool_use':
        return 'tool_use';
      case 'stop_sequence':
        return 'stop';
      default:
        return 'unknown';
    }
  }
}
