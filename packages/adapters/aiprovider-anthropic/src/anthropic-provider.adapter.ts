import type {
  AIProviderError,
  AIProviderPort,
  ChatMessage,
  GenerationEvent,
  GenerationRequest,
  GenerationResponse,
  HealthStatus,
  ModelInfo,
  TokenUsage,
  ToolDefinition,
} from '@platform/ports-ai-provider';

import Anthropic from '@anthropic-ai/sdk';
import { err, ok, type Result } from 'neverthrow';

export interface AnthropicProviderConfig {
  apiKey: string;
  baseUrl?: string;
  defaultModel?: string;
  maxRetries?: number;
  timeoutMs?: number;
}

const DEFAULT_MODEL = 'claude-opus-4-7';
const DEFAULT_TIMEOUT_MS = 120_000;

export class AnthropicProvider implements AIProviderPort {
  readonly providerId = 'anthropic';

  private readonly client: Anthropic;
  private readonly config: AnthropicProviderConfig;

  constructor(config: AnthropicProviderConfig) {
    this.config = config;
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      maxRetries: config.maxRetries ?? 1,
      timeout: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    });
  }

  listModels(): Promise<Result<ModelInfo[], AIProviderError>> {
    // Anthropic doesn't have a list-models endpoint; return well-known models
    return Promise.resolve(
      ok([
        {
          id: 'claude-opus-4-7',
          displayName: 'Claude Opus 4.7',
          contextWindow: 200_000,
          supportsToolUse: true,
          supportsStructuredOutput: true,
        },
        {
          id: 'claude-sonnet-4-6',
          displayName: 'Claude Sonnet 4.6',
          contextWindow: 200_000,
          supportsToolUse: true,
          supportsStructuredOutput: true,
        },
        {
          id: 'claude-haiku-4-5-20251001',
          displayName: 'Claude Haiku 4.5',
          contextWindow: 200_000,
          supportsToolUse: true,
          supportsStructuredOutput: true,
        },
      ]),
    );
  }

  async generate(request: GenerationRequest): Promise<Result<GenerationResponse, AIProviderError>> {
    try {
      const startMs = Date.now();
      const anthropicMessages = this.toAnthropicMessages(request.messages);
      const tools = request.tools ? this.toAnthropicTools(request.tools) : undefined;

      // If outputSchema provided, inject a wrapping tool for structured output
      const effectiveTools = request.outputSchema
        ? [
            ...(tools ?? []),
            {
              name: 'structured_output',
              description: 'Return the structured output for this request',
              input_schema: request.outputSchema as Anthropic.Tool['input_schema'],
            },
          ]
        : tools;

      const response = await this.client.messages.create({
        model: request.model,
        max_tokens: request.maxTokens ?? 8192,
        temperature: request.temperature ?? 0.2,
        ...(request.systemPrompt !== undefined && { system: request.systemPrompt }),
        messages: anthropicMessages,
        ...(effectiveTools !== undefined && { tools: effectiveTools }),
        ...(request.outputSchema !== undefined && {
          tool_choice: { type: 'tool' as const, name: 'structured_output' },
        }),
        ...(request.stopSequences !== undefined && { stop_sequences: request.stopSequences }),
      });

      const durationMs = Date.now() - startMs;
      let content = '';
      let structuredOutput: unknown;
      const toolCalls: GenerationResponse['toolCalls'] = [];

      for (const block of response.content) {
        if (block.type === 'text') {
          content += block.text;
        } else if (block.type === 'tool_use') {
          if (block.name === 'structured_output') {
            structuredOutput = block.input;
          } else {
            toolCalls.push({
              type: 'tool_use',
              id: block.id,
              name: block.name,
              input: block.input,
            });
          }
        }
      }

      const cacheRead = response.usage.cache_read_input_tokens;
      const cacheWrite = response.usage.cache_creation_input_tokens;
      const usage: TokenUsage = {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        ...(cacheRead != null && { cacheReadTokens: cacheRead }),
        ...(cacheWrite != null && { cacheWriteTokens: cacheWrite }),
      };
      return ok({
        content,
        ...(structuredOutput !== undefined && { structuredOutput }),
        ...(toolCalls.length > 0 && { toolCalls }),
        usage,
        model: String(response.model),
        stopReason: this.mapStopReason(response.stop_reason),
        durationMs,
      });
    } catch (e) {
      return err(this.mapError(e));
    }
  }

  async *generateStream(request: GenerationRequest): AsyncIterable<GenerationEvent> {
    const startMs = Date.now();
    const anthropicMessages = this.toAnthropicMessages(request.messages);
    const tools = request.tools ? this.toAnthropicTools(request.tools) : undefined;

    try {
      const stream = this.client.messages.stream({
        model: request.model,
        max_tokens: request.maxTokens ?? 8192,
        temperature: request.temperature ?? 0.2,
        ...(request.systemPrompt !== undefined && { system: request.systemPrompt }),
        messages: anthropicMessages,
        ...(tools !== undefined && { tools }),
        ...(request.stopSequences !== undefined && { stop_sequences: request.stopSequences }),
      });

      let currentToolUseId: string | undefined;

      for await (const event of stream) {
        if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            yield { type: 'text_delta', delta: event.delta.text };
          } else if (event.delta.type === 'input_json_delta') {
            if (currentToolUseId) {
              yield {
                type: 'tool_call_input_delta',
                toolUseId: currentToolUseId,
                delta: event.delta.partial_json,
              };
            }
          }
        } else if (event.type === 'content_block_start') {
          if (event.content_block.type === 'tool_use') {
            currentToolUseId = event.content_block.id;
            yield {
              type: 'tool_call_start',
              toolUseId: event.content_block.id,
              toolName: event.content_block.name,
            };
          }
        } else if (event.type === 'content_block_stop') {
          currentToolUseId = undefined;
        } else if (event.type === 'message_delta') {
          // Final usage event
        } else if (event.type === 'message_stop') {
          const finalMessage = await stream.finalMessage();
          yield {
            type: 'done',
            usage: {
              inputTokens: finalMessage.usage.input_tokens,
              outputTokens: finalMessage.usage.output_tokens,
            },
            durationMs: Date.now() - startMs,
            stopReason: this.mapStopReason(finalMessage.stop_reason),
          };
        }
      }
    } catch (e) {
      yield {
        type: 'error',
        code: 'provider_error',
        message: e instanceof Error ? e.message : String(e),
        retryable: this.isRetryable(e),
      };
    }
  }

  async countTokens(text: string, model: string): Promise<Result<number, AIProviderError>> {
    try {
      const response = await this.client.messages.countTokens({
        model: model,
        messages: [{ role: 'user', content: text }],
      });
      return ok(response.input_tokens);
    } catch (e) {
      return err(this.mapError(e));
    }
  }

  async healthCheck(): Promise<Result<HealthStatus, AIProviderError>> {
    try {
      const start = Date.now();
      await this.client.messages.countTokens({
        model: this.config.defaultModel ?? DEFAULT_MODEL,
        messages: [{ role: 'user', content: 'ping' }],
      });
      return ok({ healthy: true, latencyMs: Date.now() - start });
    } catch (e) {
      return ok({ healthy: false, message: e instanceof Error ? e.message : String(e) });
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private toAnthropicMessages(messages: ChatMessage[]): Anthropic.MessageParam[] {
    return messages.map((m) => {
      const role = m.role === 'tool' ? ('user' as const) : m.role;
      if (typeof m.content === 'string') {
        return { role, content: m.content };
      }
      const content = m.content.map((c): Anthropic.ContentBlockParam => {
        if (c.type === 'text') {
          return { type: 'text', text: c.text };
        }
        if (c.type === 'tool_use') {
          return {
            type: 'tool_use',
            id: c.id,
            name: c.name,
            input: c.input as Record<string, unknown>,
          };
        }
        // tool_result
        const block: Anthropic.ToolResultBlockParam = {
          type: 'tool_result',
          tool_use_id: c.toolUseId,
          content: c.content,
        };
        if (c.isError !== undefined) {
          block.is_error = c.isError;
        }
        return block;
      });
      return { role, content };
    });
  }

  private toAnthropicTools(tools: ToolDefinition[]): Anthropic.Tool[] {
    return tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema as Anthropic.Tool['input_schema'],
    }));
  }

  private mapStopReason(reason: string | null): GenerationResponse['stopReason'] {
    switch (reason) {
      case 'end_turn':
        return 'end_turn';
      case 'tool_use':
        return 'tool_use';
      case 'max_tokens':
        return 'max_tokens';
      case 'stop_sequence':
        return 'stop_sequence';
      default:
        return 'end_turn';
    }
  }

  private mapError(e: unknown): AIProviderError {
    if (e instanceof Anthropic.RateLimitError) {
      return { code: 'rate_limit', message: e.message, retryable: true };
    }
    if (e instanceof Anthropic.APIConnectionTimeoutError) {
      return { code: 'timeout', message: e.message, retryable: true };
    }
    if (e instanceof Anthropic.BadRequestError) {
      return { code: 'invalid_request', message: e.message, retryable: false };
    }
    if (e instanceof Anthropic.APIError) {
      return {
        code: 'provider_error',
        message: e.message,
        retryable: e.status >= 500,
        providerCode: String(e.status),
      };
    }
    return {
      code: 'provider_error',
      message: e instanceof Error ? e.message : String(e),
      retryable: false,
    };
  }

  private isRetryable(e: unknown): boolean {
    if (e instanceof Anthropic.RateLimitError) return true;
    if (e instanceof Anthropic.APIConnectionTimeoutError) return true;
    if (e instanceof Anthropic.APIError) return e.status >= 500;
    return false;
  }
}
