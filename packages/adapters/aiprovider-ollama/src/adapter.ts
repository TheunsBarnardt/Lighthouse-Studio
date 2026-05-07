import type {
  AIProviderError,
  AIProviderPort,
  GenerationEvent,
  GenerationRequest,
  GenerationResponse,
  HealthStatus,
  ModelInfo,
} from '@platform/ports-ai-provider';

import { err, ok, type Result } from 'neverthrow';
import OpenAI from 'openai';

import type { OllamaProviderConfig } from './config.js';

const DEFAULT_BASE_URL = 'http://localhost:11434/v1';
const DEFAULT_TIMEOUT_MS = 120_000;

// The Ollama native API base (one level up from the OpenAI-compat /v1)
function tagsUrl(baseUrl: string): string {
  // baseUrl is like http://localhost:11434/v1 — strip trailing /v1 to get host
  const base = baseUrl.replace(/\/v1\/?$/, '');
  return `${base}/api/tags`;
}

export class OllamaProvider implements AIProviderPort {
  readonly providerId = 'ollama';

  private readonly client: OpenAI;
  private readonly config: Required<OllamaProviderConfig>;

  constructor(config: OllamaProviderConfig) {
    this.config = {
      baseUrl: config.baseUrl ?? DEFAULT_BASE_URL,
      defaultModel: config.defaultModel ?? 'llama3',
      timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    };
    this.client = new OpenAI({
      baseURL: this.config.baseUrl,
      apiKey: 'ollama',
      timeout: this.config.timeoutMs,
    });
  }

  async listModels(): Promise<Result<ModelInfo[], AIProviderError>> {
    try {
      const response = await fetch(tagsUrl(this.config.baseUrl));
      if (!response.ok) {
        return ok([]);
      }
      const data = (await response.json()) as {
        models?: Array<{ name: string; details?: { parameter_size?: string } }>;
      };
      const models: ModelInfo[] = (data.models ?? []).map((m) => ({
        id: m.name,
        displayName: m.name,
        contextWindow: 8192,
        supportsToolUse: false,
        supportsStructuredOutput: false,
      }));
      return ok(models);
    } catch {
      // Ollama may not be running; fail gracefully
      return ok([]);
    }
  }

  async generate(request: GenerationRequest): Promise<Result<GenerationResponse, AIProviderError>> {
    try {
      const startMs = Date.now();
      const messages = this.toOpenAIMessages(request);

      const response = await this.client.chat.completions.create({
        model: request.model,
        messages,
        temperature: request.temperature ?? 0.2,
        max_tokens: request.maxTokens ?? 8192,
        ...(request.stopSequences !== undefined && { stop: request.stopSequences }),
      });

      const durationMs = Date.now() - startMs;
      const choice = response.choices[0];
      const content = choice?.message?.content ?? '';
      const stopReason = this.mapFinishReason(choice?.finish_reason ?? null);

      return ok({
        content,
        usage: {
          inputTokens: response.usage?.prompt_tokens ?? 0,
          outputTokens: response.usage?.completion_tokens ?? 0,
        },
        model: response.model,
        stopReason,
        durationMs,
      });
    } catch (e) {
      return err(this.mapError(e));
    }
  }

  async *generateStream(request: GenerationRequest): AsyncIterable<GenerationEvent> {
    const startMs = Date.now();
    try {
      const messages = this.toOpenAIMessages(request);

      const stream = await this.client.chat.completions.create({
        model: request.model,
        messages,
        temperature: request.temperature ?? 0.2,
        max_tokens: request.maxTokens ?? 8192,
        ...(request.stopSequences !== undefined && { stop: request.stopSequences }),
        stream: true,
        stream_options: { include_usage: true },
      });

      let inputTokens = 0;
      let outputTokens = 0;
      let finishReason: string | null = null;

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          yield { type: 'text_delta', delta };
        }
        if (chunk.choices[0]?.finish_reason) {
          finishReason = chunk.choices[0].finish_reason;
        }
        if (chunk.usage) {
          inputTokens = chunk.usage.prompt_tokens ?? 0;
          outputTokens = chunk.usage.completion_tokens ?? 0;
        }
      }

      yield {
        type: 'done',
        usage: { inputTokens, outputTokens },
        durationMs: Date.now() - startMs,
        stopReason: this.mapFinishReason(finishReason),
      };
    } catch (e) {
      yield {
        type: 'error',
        code: 'provider_error',
        message: e instanceof Error ? e.message : String(e),
        retryable: this.isRetryable(e),
      };
    }
  }

  async countTokens(text: string, _model: string): Promise<Result<number, AIProviderError>> {
    // Ollama doesn't expose a token-counting endpoint; estimate via character ratio
    return Promise.resolve(ok(Math.ceil(text.length / 4)));
  }

  async healthCheck(): Promise<Result<HealthStatus, AIProviderError>> {
    const start = Date.now();
    try {
      const response = await fetch(tagsUrl(this.config.baseUrl));
      if (!response.ok) {
        return ok({ healthy: false, message: `Ollama tags endpoint returned ${String(response.status)}` });
      }
      return ok({ healthy: true, latencyMs: Date.now() - start });
    } catch (e) {
      return ok({ healthy: false, message: e instanceof Error ? e.message : String(e) });
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private toOpenAIMessages(
    request: GenerationRequest,
  ): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    const result: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    if (request.systemPrompt !== undefined) {
      result.push({ role: 'system', content: request.systemPrompt });
    }

    for (const m of request.messages) {
      if (typeof m.content === 'string') {
        result.push({
          role: m.role === 'tool' ? 'user' : m.role,
          content: m.content,
        } as OpenAI.Chat.Completions.ChatCompletionMessageParam);
      } else {
        const textParts = m.content
          .filter((c) => c.type === 'text')
          .map((c) => (c.type === 'text' ? c.text : ''))
          .join('');
        result.push({
          role: m.role === 'tool' ? 'user' : m.role,
          content: textParts,
        } as OpenAI.Chat.Completions.ChatCompletionMessageParam);
      }
    }

    return result;
  }

  private mapFinishReason(reason: string | null): GenerationResponse['stopReason'] {
    switch (reason) {
      case 'stop':
        return 'end_turn';
      case 'tool_calls':
        return 'tool_use';
      case 'length':
        return 'max_tokens';
      case 'content_filter':
        return 'stop_sequence';
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

  private isRetryable(e: unknown): boolean {
    if (e instanceof OpenAI.RateLimitError) return true;
    if (e instanceof OpenAI.APIConnectionTimeoutError) return true;
    if (e instanceof OpenAI.APIError) return e.status >= 500;
    return false;
  }
}
