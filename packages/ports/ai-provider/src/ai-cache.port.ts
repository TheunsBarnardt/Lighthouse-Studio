import type { Result } from 'neverthrow';

import type { GenerationResponse } from './types.js';

export interface AICacheError {
  code: 'cache_error';
  message: string;
}

export interface CachedResponse {
  response: GenerationResponse;
  cachedAt: Date;
  hitCount: number;
}

export interface AICachePort {
  get(cacheKey: string): Promise<Result<CachedResponse | null, AICacheError>>;

  set(
    cacheKey: string,
    workspaceId: string,
    promptId: string,
    response: GenerationResponse,
    ttlSeconds?: number,
  ): Promise<Result<void, AICacheError>>;

  invalidate(cacheKey: string): Promise<Result<void, AICacheError>>;

  invalidateByPrompt(promptId: string, workspaceId?: string): Promise<Result<void, AICacheError>>;
}
