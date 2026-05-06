import type {
  AIProviderCapabilities,
  AIProviderPort,
  GenerationEvent,
  GenerationRequest,
  GenerationResponse,
  HealthStatus,
  ModelInfo,
  ToolCall,
} from '@platform/ports-ai';
import type { Result } from 'neverthrow';

import { AiError } from '@platform/ports-ai';
import { err, ok } from 'neverthrow';

import { toAiError } from './errors.js';

// Minimal typed shapes for the OpenAI SDK responses (loaded via require at runtime).
// These replace `any` propagation from the dynamic require() call.

interface OpenAIToolCall {
  id: string;
  function: { name: string; arguments: string };
}

interface OpenAIChatChoice {
  message: { content: string | null; tool_calls?: OpenAIToolCall[] };
  finish_reason: string | null;
}

interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface OpenAIChatCompletion {
  model: string;
  choices: OpenAIChatChoice[];
  usage?: OpenAIUsage;
}

interface OpenAIStreamChunk {
  choices?: Array<{ delta?: { content?: string } }>;
}

interface OpenAIStream extends AsyncIterable<OpenAIStreamChunk> {
  finalChatCompletion(): Promise<OpenAIChatCompletion>;
}

interface OpenAIClient {
  chat: {
    completions: {
      create(params: Record<string, unknown>): Promise<OpenAIChatCompletion>;
      stream(params: Record<string, unknown>): Promise<OpenAIStream>;
    };
  };
}

export interface OpenAIAdapterConfig {
  apiKey: string;
  baseURL?: string;
  defaultModel?: string;
  organization?: string;
}

const DEFAULT_MODEL = 'gpt-4o';

const KNOWN_MODELS: ModelInfo[] = [
  {
    id: 'gpt-4o',
    displayName: 'GPT-4o',
    contextWindow: 128000,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'gpt-4o-mini',
    displayName: 'GPT-4o Mini',
    contextWindow: 128000,
    supportsTools: true,
    supportsStreaming: true,
  },
  {
    id: 'o3',
    displayName: 'o3',
    contextWindow: 200000,
    supportsTools: true,
    supportsStreaming: true,
  },
];

export class OpenAIAdapter implements AIProviderPort {
  readonly id = 'openai';

  readonly capabilities: AIProviderCapabilities = {
    streaming: true,
    toolUse: true,
    structuredOutput: true,
    imageInput: true,
    maxContextTokens: 128000,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly client: any;
  private readonly defaultModel: string;

  constructor(config: OpenAIAdapterConfig) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/consistent-type-imports
    const OpenAISDK = require('openai') as typeof import('openai');
    this.client = new OpenAISDK.OpenAI({
      apiKey: config.apiKey,
      ...(config.baseURL ? { baseURL: config.baseURL } : {}),
      ...(config.organization ? { organization: config.organization } : {}),
    });
    this.defaultModel = config.defaultModel ?? DEFAULT_MODEL;
  }

  listModels(): Promise<Result<ModelInfo[], AiError>> {
    return Promise.resolve(ok(KNOWN_MODELS));
  }

  async generate(request: GenerationRequest): Promise<Result<GenerationResponse, AiError>> {
    try {
      const messages = this.toOpenAIMessages(request);
      const tools = this.toOpenAITools(request.tools);

      const response = await (this.client as OpenAIClient).chat.completions.create({
        model: request.model || this.defaultModel,
        max_tokens: request.maxTokens,
        temperature: request.temperature,
        messages,
        ...(tools.length > 0 ? { tools, tool_choice: 'auto' } : {}),
        ...(request.stopSequences?.length ? { stop: request.stopSequences } : {}),
      });

      const choice = response.choices[0];
      if (!choice) return err(new AiError('UNKNOWN', 'No choices returned'));

      const content = choice.message.content ?? '';
      const toolCalls: ToolCall[] = (choice.message.tool_calls ?? []).map((tc: OpenAIToolCall) => ({
        id: tc.id,
        toolId: tc.function.name,
        name: tc.function.name,
        parameters: JSON.parse(tc.function.arguments) as Record<string, unknown>,
      }));

      return ok({
        content,
        model: response.model,
        usage: {
          inputTokens: response.usage?.prompt_tokens ?? 0,
          outputTokens: response.usage?.completion_tokens ?? 0,
          totalTokens: response.usage?.total_tokens ?? 0,
        },
        finishReason: this.mapFinishReason(choice.finish_reason),
        ...(toolCalls.length > 0 ? { toolCalls } : {}),
      });
    } catch (error: unknown) {
      return err(toAiError(error));
    }
  }

  async *generateStream(request: GenerationRequest): AsyncIterable<GenerationEvent> {
    try {
      const messages = this.toOpenAIMessages(request);
      const tools = this.toOpenAITools(request.tools);

      const stream = await (this.client as OpenAIClient).chat.completions.stream({
        model: request.model || this.defaultModel,
        max_tokens: request.maxTokens,
        temperature: request.temperature,
        messages,
        ...(tools.length > 0 ? { tools, tool_choice: 'auto' } : {}),
        ...(request.stopSequences?.length ? { stop: request.stopSequences } : {}),
      });

      for await (const chunk of stream as AsyncIterable<OpenAIStreamChunk>) {
        const delta = chunk.choices?.[0]?.delta;
        if (delta?.content) {
          yield { type: 'text_delta', delta: delta.content };
        }
      }

      const final = await stream.finalChatCompletion();
      yield {
        type: 'done',
        usage: {
          inputTokens: final.usage?.prompt_tokens ?? 0,
          outputTokens: final.usage?.completion_tokens ?? 0,
          totalTokens: final.usage?.total_tokens ?? 0,
        },
        finishReason: this.mapFinishReason(final.choices[0]?.finish_reason ?? null),
      };
    } catch (error: unknown) {
      const aiErr = toAiError(error);
      yield { type: 'error', code: aiErr.code, message: aiErr.message };
    }
  }

  async countTokens(text: string, _model: string): Promise<Result<number, AiError>> {
    // OpenAI doesn't expose a token counting API; use character-based estimate
    return Promise.resolve(ok(Math.ceil(text.length / 4)));
  }

  async healthCheck(): Promise<Result<HealthStatus, AiError>> {
    const start = Date.now();
    try {
      await (this.client as OpenAIClient).chat.completions.create({
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

  private toOpenAIMessages(request: GenerationRequest): Array<{ role: string; content: string }> {
    const msgs: Array<{ role: string; content: string }> = [];
    if (request.systemPrompt) {
      msgs.push({ role: 'system', content: request.systemPrompt });
    }
    for (const m of request.messages.filter((m) => m.role !== 'system')) {
      msgs.push({ role: m.role, content: m.content });
    }
    return msgs;
  }

  private toOpenAITools(
    tools?: GenerationRequest['tools'],
  ): Array<{
    type: 'function';
    function: { name: string; description: string; parameters: unknown };
  }> {
    if (!tools || tools.length === 0) return [];
    return tools.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.id,
        description: t.description,
        parameters: t.parameters,
      },
    }));
  }

  private mapFinishReason(reason: string | null): GenerationResponse['finishReason'] {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'max_tokens';
      case 'tool_calls':
        return 'tool_use';
      case 'content_filter':
        return 'content_filter';
      default:
        return 'unknown';
    }
  }
}
