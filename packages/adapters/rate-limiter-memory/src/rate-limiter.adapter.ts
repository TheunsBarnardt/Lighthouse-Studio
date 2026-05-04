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
  lastRefillAt: number; // ms since epoch
}

/**
 * Token-bucket rate limiter backed by a single in-process Map.
 *
 * Suitable for development and single-instance deployments. For multi-instance
 * production deployments, replace with the Redis-backed adapter so buckets are
 * shared across processes.
 */
export class InMemoryRateLimiter implements RateLimiterPort {
  private readonly buckets = new Map<string, Bucket>();

  check(opts: RateLimiterCheckOptions): Promise<Result<RateLimiterCheckResult, RateLimitError>> {
    const now = Date.now();
    let bucket = this.buckets.get(opts.bucketKey);

    if (!bucket) {
      bucket = { tokens: opts.capacity, lastRefillAt: now };
      this.buckets.set(opts.bucketKey, bucket);
    } else {
      // Refill proportionally to elapsed time
      const elapsedSec = (now - bucket.lastRefillAt) / 1000;
      const refill = elapsedSec * opts.refillRate;
      bucket.tokens = Math.min(opts.capacity, bucket.tokens + refill);
      bucket.lastRefillAt = now;
    }

    if (bucket.tokens >= opts.cost) {
      bucket.tokens -= opts.cost;
      return Promise.resolve(ok({ allowed: true, remainingTokens: Math.floor(bucket.tokens) }));
    }

    // Not enough tokens — compute how long until enough tokens refill
    const tokensNeeded = opts.cost - bucket.tokens;
    const retryAfterMs = Math.ceil((tokensNeeded / opts.refillRate) * 1000);

    return Promise.resolve(ok({ allowed: false, retryAfterMs }));
  }

  reset(bucketKey: string): Promise<Result<void, RateLimitError>> {
    this.buckets.delete(bucketKey);
    return Promise.resolve(ok(undefined));
  }
}
