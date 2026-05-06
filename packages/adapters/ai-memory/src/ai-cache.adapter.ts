import type { AICachePort, AiError, GenerationResponse } from '@platform/ports-ai';
import type { Result } from 'neverthrow';

import { ok } from 'neverthrow';

interface CacheEntry {
  response: GenerationResponse;
  promptId: string;
  promptVersion: string;
  provider: string;
  model: string;
  expiresAt: number;
}

export class InMemoryAiCache implements AICachePort {
  private readonly store = new Map<string, CacheEntry>();

  get(cacheKeyHash: string): Promise<Result<GenerationResponse | null, AiError>> {
    const entry = this.store.get(cacheKeyHash);
    if (!entry || Date.now() > entry.expiresAt) {
      if (entry) this.store.delete(cacheKeyHash);
      return Promise.resolve(ok(null));
    }
    return Promise.resolve(ok(entry.response));
  }

  set(
    cacheKeyHash: string,
    promptId: string,
    promptVersion: string,
    provider: string,
    model: string,
    response: GenerationResponse,
    ttlSeconds = 86400,
  ): Promise<Result<void, AiError>> {
    this.store.set(cacheKeyHash, {
      response,
      promptId,
      promptVersion,
      provider,
      model,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    return Promise.resolve(ok(undefined));
  }

  invalidateByPrompt(promptId: string, promptVersion: string): Promise<Result<number, AiError>> {
    let count = 0;
    for (const [key, entry] of this.store.entries()) {
      if (entry.promptId === promptId && entry.promptVersion === promptVersion) {
        this.store.delete(key);
        count++;
      }
    }
    return Promise.resolve(ok(count));
  }

  purgeExpired(): Promise<Result<number, AiError>> {
    const now = Date.now();
    let count = 0;
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        count++;
      }
    }
    return Promise.resolve(ok(count));
  }

  /** Expose the raw store for test assertions. */
  get size(): number {
    return this.store.size;
  }
}
