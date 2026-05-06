import type { Result } from 'neverthrow';

import type { AiError } from './errors.js';
import type { GenerationResponse } from './types.js';

export interface AICachePort {
  /** Look up a cached response by cache key hash. Returns null on miss. */
  get(cacheKeyHash: string): Promise<Result<GenerationResponse | null, AiError>>;

  /** Store a response. ttlSeconds defaults to 86400 (24 hours). */
  set(
    cacheKeyHash: string,
    promptId: string,
    promptVersion: string,
    provider: string,
    model: string,
    response: GenerationResponse,
    ttlSeconds?: number,
  ): Promise<Result<void, AiError>>;

  /** Remove all cached entries for a specific prompt + version. */
  invalidateByPrompt(promptId: string, promptVersion: string): Promise<Result<number, AiError>>;

  /** Remove all expired entries (for scheduled cleanup). */
  purgeExpired(): Promise<Result<number, AiError>>;
}
