import type { Result } from 'neverthrow';

import type { AiError } from './errors.js';
import type {
  GenerationEvent,
  GenerationRequest,
  GenerationResponse,
  HealthStatus,
  ModelInfo,
  AIProviderCapabilities,
} from './types.js';

export interface AIProviderPort {
  /** Stable identifier for this provider (e.g. 'anthropic', 'openai'). */
  readonly id: string;

  /** Feature capabilities of this provider. */
  readonly capabilities: AIProviderCapabilities;

  /** List available models from this provider. */
  listModels(): Promise<Result<ModelInfo[], AiError>>;

  /** Generate a completion (non-streaming). */
  generate(request: GenerationRequest): Promise<Result<GenerationResponse, AiError>>;

  /** Generate a completion with streaming output. */
  generateStream(request: GenerationRequest): AsyncIterable<GenerationEvent>;

  /** Count tokens for a text string with the given model. */
  countTokens(text: string, model: string): Promise<Result<number, AiError>>;

  /** Check provider health (used for failover detection). */
  healthCheck(): Promise<Result<HealthStatus, AiError>>;
}
