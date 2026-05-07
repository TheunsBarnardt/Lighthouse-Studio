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

import OpenAI from 'openai';
import { err, ok, type Result } from 'neverthrow';

import type { OpenAIProviderConfig } from './config.js';

const DEFAULT_TIMEOUT_MS = 120_000;

export class OpenAIProvider implements AIProviderPort {
  readonly providerId = 'openai';

  private readonly client: OpenAI;
  private readonly config: OpenAIProviderConfig;

  constructor(config: OpenAIProviderConfig) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      organization: config.organization,
      maxRetries: config.maxRetries ?? 1,
      timeout: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    });
  }

  async listModels(): Promise<Result<ModelInfo[], AIProviderError>> {
    try {
      const page = await this.client.models.list();
      const models: ModelInfo[] = page.data
        .filter((m) => m.id.includes('gpt'))
        .map((m) => ({
          id: m.id,
          displayName: m.id,
          contextWindow: 128_000,
          supportsToolUse: true,
          supportsStructuredOutput: true,
        }));
      return ok(models);
    } catch (e) {
      return err(this.mapError(e));
    }
  }

  async generate(request: GenerationRequest): Promise<Result<GenerationResponse, AIProviderError>> {
    try {
      const startMs = Date.now();
      const baseMessages = this.toOpenAIMessages(request.messages);
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] =
        request.systemPrompt !== undefined
          ? [{ role: 'system', content: request.systemPrompt }, ...baseMessages]
          : baseMessages;
      const tools = request.tools ? this.toOpenAITools(request.tools) : undefined;

      const body: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
        model: request.model,
        max_tokens: request.maxTokens ?? 8192,
        temperature: request.temperature ?? 0.2,
        messages,
        stream: false,
        ...(tools !== undefined && tools.length > 0 && { tools }),
        ...(request.stopSequences !== undefined && { stop: request.stopSequences }),
        ...(request.outputSchema !== undefined && {
          response_format: {
            type: 'json_schema' as const,
            json_schema: {
              name: 'output',
              schema: request.outputSchema as Record<string, unknown>,
              strict: true,
            },
          },
        }),
      };

      const response = await this.client.chat.completions.create(body);
      const durationMs = Date.now() - startMs;
      const choice = response.choices[0];

      let content = '';
      let structuredOutput: unknown;
      const toolCalls: GenerationResponse['toolCalls'] = [];

      if (choice?.message.content) {
        content = choice.message.content;
        // If outputSchema was provided, content is JSON
        if (request.outputSchema !== undefined) {
          try {
            structuredOutput = JSON.parse(content) as unknown;
            content = '';
          } catch {
            // leave as plain text
          }
        }
      }

      if (choice?.message.tool_calls) {
        for (const tc of choice.message.tool_calls) {
          let input: unknown = {};
          try {
            input = JSON.parse(tc.function.arguments) as unknown;
          } catch {
            input = tc.function.arguments;
          }
          toolCalls.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.function.name,
            input,
          });
        }
      }

      const usage: TokenUsage = {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
      };

      return ok({
        content,
        ...(structuredOutput !== undefined && { structuredOutput }),
        ...(toolCalls.length > 0 && { toolCalls }),
        usage,
        model: response.model,
        stopReason: this.mapStopReason(choice?.finish_reason ?? null),
        durationMs,
      });
    } catch (e) {
      return err(this.mapError(e));
    }
  }

  async *generateStream(request: GenerationRequest): AsyncIterable<GenerationEvent> {
    const startMs = Date.now();

    // Prepend system message if provided
    const baseMessages = this.toOpenAIMessages(request.messages);
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] =
      request.systemPrompt !== undefined
        ? [{ role: 'system', content: request.systemPrompt }, ...baseMessages]
        : baseMessages;
    const tools = request.tools ? this.toOpenAITools(request.tools) : undefined;

    try {
      const stream = await this.client.chat.completions.create({
        model: request.model,
        max_tokens: request.maxTokens ?? 8192,
        temperature: request.temperature ?? 0.2,
        messages,
        stream: true,
        ...(tools !== undefined && tools.length > 0 && { tools }),
        ...(request.stopSequences !== undefined && { stop: request.stopSequences }),
      });

      // Track in-progress tool calls indexed by their index
      const toolCallAccumulators: Map<
        number,
        { id: string; name: string; argumentsBuffer: string }
      > = new Map();

      let lastUsage: TokenUsage = { inputTokens: 0, outputTokens: 0 };
      let lastFinishReason: string | null = null;

      for await (const chunk of stream) {
        const choice = chunk.choices[0];

        if (chunk.usage) {
          lastUsage = {
            inputTokens: chunk.usage.prompt_tokens,
            outputTokens: chunk.usage.completion_tokens,
          };
        }

        if (!choice) continue;

        if (choice.finish_reason) {
          lastFinishReason = choice.finish_reason;
        }

        const delta = choice.delta;

        if (delta.content) {
          yield { type: 'text_delta', delta: delta.content };
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index;
            if (!toolCallAccumulators.has(idx)) {
              // First chunk for this tool call
              toolCallAccumulators.set(idx, {
                id: tc.id ?? '',
                name: tc.function?.name ?? '',
                argumentsBuffer: tc.function?.arguments ?? '',
              });
              if (tc.id && tc.function?.name) {
                yield {
                  type: 'tool_call_start',
                  toolUseId: tc.id,
                  toolName: tc.function.name,
                };
              }
            } else {
              const acc = toolCallAccumulators.get(idx)!;
              if (tc.function?.arguments) {
                acc.argumentsBuffer += tc.function.arguments;
                yield {
                  type: 'tool_call_input_delta',
                  toolUseId: acc.id,
                  delta: tc.function.arguments,
                };
              }
            }
          }
        }
      }

      yield {
        type: 'done',
        usage: lastUsage,
        durationMs: Date.now() - startMs,
        stopReason: this.mapStopReason(lastFinishReason),
      };
    } catch (e) {
      const mapped = this.mapError(e);
      yield {
        type: 'error',
        code: mapped.code,
        message: mapped.message,
        retryable: mapped.retryable,
      };
    }
  }

  async countTokens(text: string, _model: string): Promise<Result<number, AIProviderError>> {
    // OpenAI has no public token-count endpoint; use a simple character-based estimate
    const estimate = Math.ceil(text.length / 4);
    return Promise.resolve(ok(estimate));
  }

  async healthCheck(): Promise<Result<HealthStatus, AIProviderError>> {
    try {
      const start = Date.now();
      await this.client.models.list();
      return ok({ healthy: true, latencyMs: Date.now() - start });
    } catch (e) {
      return ok({ healthy: false, message: e instanceof Error ? e.message : String(e) });
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private toOpenAIMessages(
    messages: ChatMessage[],
  ): OpenAI.Chat.ChatCompletionMessageParam[] {
    const result: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    for (const m of messages) {
      if (m.role === 'tool') {
        // tool role messages need to be split into tool result messages
        if (typeof m.content === 'string') {
          // Shouldn't happen for tool role but handle gracefully
          result.push({ role: 'user', content: m.content });
        } else {
          for (const c of m.content) {
            if (c.type === 'tool_result') {
              result.push({
                role: 'tool',
                tool_call_id: c.toolUseId,
                content: c.content,
              });
            }
          }
        }
        continue;
      }

      if (typeof m.content === 'string') {
        result.push({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        });
        continue;
      }

      // Array content
      if (m.role === 'assistant') {
        const textParts: string[] = [];
        const toolCalls: OpenAI.Chat.ChatCompletionMessageToolCall[] = [];

        for (const c of m.content) {
          if (c.type === 'text') {
            textParts.push(c.text);
          } else if (c.type === 'tool_use') {
            toolCalls.push({
              id: c.id,
              type: 'function',
              function: {
                name: c.name,
                arguments: JSON.stringify(c.input),
              },
            });
          }
        }

        result.push({
          role: 'assistant',
          content: textParts.join('') || null,
          ...(toolCalls.length > 0 && { tool_calls: toolCalls }),
        });
      } else {
        // user
        const parts: OpenAI.Chat.ChatCompletionContentPart[] = [];
        for (const c of m.content) {
          if (c.type === 'text') {
            parts.push({ type: 'text', text: c.text });
          }
        }
        result.push({ role: 'user', content: parts });
      }
    }

    return result;
  }

  private toOpenAITools(tools: ToolDefinition[]): OpenAI.Chat.ChatCompletionTool[] {
    return tools.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema as Record<string, unknown>,
      },
    }));
  }

  private mapStopReason(
    reason: string | null,
  ): GenerationResponse['stopReason'] {
    switch (reason) {
      case 'stop':
        return 'end_turn';
      case 'tool_calls':
        return 'tool_use';
      case 'length':
        return 'max_tokens';
      case 'content_filter':
        return 'end_turn';
      default:
        return 'end_turn';
    }
  }

  private mapError(e: unknown): AIProviderError {
    if (e instanceof OpenAI.RateLimitError) {
      return { code: 'rate_limit', message: e.message, retryable: true };
    }
    if (e instanceof OpenAI.APIConnectionTimeoutError) {
      return { code: 'timeout', message: e.message, retryable: true };
    }
    if (e instanceof OpenAI.BadRequestError) {
      return { code: 'invalid_request', message: e.message, retryable: false };
    }
    if (e instanceof OpenAI.APIError) {
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
}
