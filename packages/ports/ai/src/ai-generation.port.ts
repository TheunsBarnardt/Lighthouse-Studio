import type { Result } from 'neverthrow';

import type { AiError } from './errors.js';
import type { AiGenerationOptions, AiGenerationResult, AiMessage, AiStreamChunk } from './types.js';

export interface AiGenerationPort {
  generate(
    messages: AiMessage[],
    opts?: AiGenerationOptions,
  ): Promise<Result<AiGenerationResult, AiError>>;

  stream(messages: AiMessage[], opts?: AiGenerationOptions): AsyncIterable<AiStreamChunk>;

  countTokens(
    messages: AiMessage[],
    opts?: Pick<AiGenerationOptions, 'model' | 'systemPrompt'>,
  ): Promise<Result<number, AiError>>;

  availableModels(): string[];
}
