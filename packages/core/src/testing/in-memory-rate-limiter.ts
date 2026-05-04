import type {
  RateLimiterCheckOptions,
  RateLimiterCheckResult,
  RateLimiterPort,
} from '@platform/ports-rate-limiter';
import type { RateLimitError } from '@platform/ports-rate-limiter';
import type { Result } from 'neverthrow';

import { ok } from 'neverthrow';

interface Bucket {
  tokens: number;
  lastRefillAt: number;
}

/** Token-bucket rate limiter for unit tests; mirrors the production in-memory adapter. */
export function createInMemoryRateLimiter(): RateLimiterPort {
  const buckets = new Map<string, Bucket>();

  return {
    check(opts: RateLimiterCheckOptions): Promise<Result<RateLimiterCheckResult, RateLimitError>> {
      const now = Date.now();
      let bucket = buckets.get(opts.bucketKey);
      if (!bucket) {
        bucket = { tokens: opts.capacity, lastRefillAt: now };
        buckets.set(opts.bucketKey, bucket);
      } else {
        const elapsed = (now - bucket.lastRefillAt) / 1000;
        bucket.tokens = Math.min(opts.capacity, bucket.tokens + elapsed * opts.refillRate);
        bucket.lastRefillAt = now;
      }
      if (bucket.tokens >= opts.cost) {
        bucket.tokens -= opts.cost;
        return Promise.resolve(ok({ allowed: true, remainingTokens: Math.floor(bucket.tokens) }));
      }
      const retryAfterMs = Math.ceil(((opts.cost - bucket.tokens) / opts.refillRate) * 1000);
      return Promise.resolve(ok({ allowed: false, retryAfterMs }));
    },
    reset(bucketKey: string): Promise<Result<void, RateLimitError>> {
      buckets.delete(bucketKey);
      return Promise.resolve(ok(undefined));
    },
  };
}
