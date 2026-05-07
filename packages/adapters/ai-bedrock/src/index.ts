import type {
  AIProviderCapabilities,
  AIProviderPort,
  GenerationEvent,
  GenerationRequest,
  GenerationResponse,
  HealthStatus,
  ModelInfo,
} from '@platform/ports-ai';
import type { Result } from 'neverthrow';

import { AiError } from '@platform/ports-ai';
import { err } from 'neverthrow';

// Stub — full implementation deferred. See GitHub issue: bedrock-adapter

export interface BedrockAdapterConfig {
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  defaultModel?: string;
}

const NOT_IMPLEMENTED = new AiError('PROVIDER_ERROR', 'AWS Bedrock adapter not yet implemented');

export class BedrockAdapter implements AIProviderPort {
  readonly id = 'bedrock';

  readonly capabilities: AIProviderCapabilities = {
    streaming: true,
    toolUse: true,
    structuredOutput: false,
    imageInput: true,
    maxContextTokens: 200000,
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
