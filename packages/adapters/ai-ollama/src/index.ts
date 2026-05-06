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

import { AiError } from '@platform/ports-ai';
import { err } from 'neverthrow';

// Stub — full implementation deferred. See GitHub issue: ollama-adapter
// Ollama is self-hosted; implements OpenAI-compatible API. PII rules exempt.

export interface OllamaAdapterConfig {
  baseURL: string;
  defaultModel?: string;
}

const NOT_IMPLEMENTED = new AiError('PROVIDER_ERROR', 'Ollama adapter not yet implemented');

export class OllamaAdapter implements AIProviderPort {
  readonly id = 'ollama';

  readonly capabilities: AIProviderCapabilities = {
    streaming: true,
    toolUse: false,
    structuredOutput: false,
    imageInput: false,
    maxContextTokens: 32768,
  };

  listModels(): Promise<Result<ModelInfo[], AiError>> {
    return Promise.resolve(err(NOT_IMPLEMENTED));
  }

  generate(_request: GenerationRequest): Promise<Result<GenerationResponse, AiError>> {
    return Promise.resolve(err(NOT_IMPLEMENTED));
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async *generateStream(_request: GenerationRequest): AsyncIterable<GenerationEvent> {
    yield { type: 'error', code: 'PROVIDER_ERROR', message: NOT_IMPLEMENTED.message };
  }

  countTokens(_text: string, _model: string): Promise<Result<number, AiError>> {
    return Promise.resolve(err(NOT_IMPLEMENTED));
  }

  healthCheck(): Promise<Result<HealthStatus, AiError>> {
    return Promise.resolve(err(NOT_IMPLEMENTED));
  }
}
