import type {
  AIProviderCapabilities,
  AIProviderPort,
  AiError,
  GenerationEvent,
  GenerationRequest,
  GenerationResponse,
  HealthStatus,
  ModelInfo,
} from '@platform/ports-ai';
import type { Result } from 'neverthrow';

import { ok } from 'neverthrow';

const MEMORY_MODEL = 'memory-echo-v1';

export class EchoAiAdapter implements AIProviderPort {
  readonly id = 'memory';

  readonly capabilities: AIProviderCapabilities = {
    streaming: true,
    toolUse: false,
    structuredOutput: false,
    imageInput: false,
    maxContextTokens: 8192,
  };

  listModels(): Promise<Result<ModelInfo[], AiError>> {
    return Promise.resolve(
      ok([
        {
          id: MEMORY_MODEL,
          displayName: 'Memory Echo v1',
          contextWindow: 8192,
          supportsTools: false,
          supportsStreaming: true,
        },
      ]),
    );
  }

  generate(request: GenerationRequest): Promise<Result<GenerationResponse, AiError>> {
    const lastUser = [...request.messages].reverse().find((m) => m.role === 'user');
    const content = lastUser ? `Echo: ${lastUser.content}` : 'Echo: (no user message)';
    const inputTokens = request.messages.reduce(
      (sum, m) => sum + Math.ceil(m.content.length / 4),
      0,
    );
    const outputTokens = Math.ceil(content.length / 4);
    return Promise.resolve(
      ok({
        content,
        model: request.model || MEMORY_MODEL,
        usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
        finishReason: 'stop' as const,
      }),
    );
  }

  async *generateStream(request: GenerationRequest): AsyncIterable<GenerationEvent> {
    const result = await this.generate(request);
    const content = result.isOk() ? result.value.content : '';
    const inputTokens = request.messages.reduce(
      (sum, m) => sum + Math.ceil(m.content.length / 4),
      0,
    );
    const outputTokens = Math.ceil(content.length / 4);
    yield { type: 'text_delta', delta: content };
    yield {
      type: 'done',
      usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
      finishReason: 'stop',
    };
  }

  countTokens(text: string, _model: string): Promise<Result<number, AiError>> {
    return Promise.resolve(ok(Math.ceil(text.length / 4)));
  }

  healthCheck(): Promise<Result<HealthStatus, AiError>> {
    return Promise.resolve(ok({ healthy: true, latencyMs: 0 }));
  }
}
