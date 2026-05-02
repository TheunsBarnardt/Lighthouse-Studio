import type {
  AiError,
  AiGenerationOptions,
  AiGenerationPort,
  AiGenerationResult,
  AiMessage,
  AiStreamChunk,
} from '@platform/ports-ai';
import type { Result } from 'neverthrow';

import { ok } from 'neverthrow';

export class EchoAiAdapter implements AiGenerationPort {
  generate(
    messages: AiMessage[],
    _opts?: AiGenerationOptions,
  ): Promise<Result<AiGenerationResult, AiError>> {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    const content = lastUser ? `Echo: ${lastUser.content}` : 'Echo: (no user message)';
    const inputTokens = messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
    const outputTokens = Math.ceil(content.length / 4);
    return Promise.resolve(
      ok({
        content,
        model: 'memory-echo-v1',
        usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
        finishReason: 'stop',
      }),
    );
  }

  async *stream(messages: AiMessage[], opts?: AiGenerationOptions): AsyncIterable<AiStreamChunk> {
    const result = await this.generate(messages, opts);
    const content = result.isOk() ? result.value.content : '';
    yield { delta: content, done: false };
    yield { delta: '', done: true };
  }

  countTokens(
    messages: AiMessage[],
    _opts?: Pick<AiGenerationOptions, 'model' | 'systemPrompt'>,
  ): Promise<Result<number, AiError>> {
    const count = messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
    return Promise.resolve(ok(count));
  }

  availableModels(): string[] {
    return ['memory-echo-v1'];
  }
}
