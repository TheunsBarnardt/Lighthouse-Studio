import type { Result } from 'neverthrow';

import type {
  GenerationEvent,
  GenerationRequest,
  GenerationResponse,
  HealthStatus,
  ModelInfo,
} from './types.js';

export interface AIProviderError {
  code: 'rate_limit' | 'context_length' | 'invalid_request' | 'provider_error' | 'timeout';
  message: string;
  retryable: boolean;
  providerCode?: string;
}

export interface AIProviderPort {
  readonly providerId: string;

  listModels(): Promise<Result<ModelInfo[], AIProviderError>>;

  generate(request: GenerationRequest): Promise<Result<GenerationResponse, AIProviderError>>;

  generateStream(request: GenerationRequest): AsyncIterable<GenerationEvent>;

  countTokens(text: string, model: string): Promise<Result<number, AIProviderError>>;

  healthCheck(): Promise<Result<HealthStatus, AIProviderError>>;
}
