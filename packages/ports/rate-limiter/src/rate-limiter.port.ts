import type { Result } from 'neverthrow';

import type { RateLimitError } from './errors.js';

export interface RateLimiterCheckOptions {
  /** Identifies the token bucket — e.g. `workspace:<id>:principal:<id>`. */
  bucketKey: string;
  /** Maximum tokens the bucket can hold. */
  capacity: number;
  /** Tokens added to the bucket per second. */
  refillRate: number;
  /**
   * Tokens this request consumes. Bulk endpoints should pass a higher cost
   * (e.g. 10) to account for their higher resource usage.
   */
  cost: number;
}

export interface RateLimiterCheckResult {
  allowed: boolean;
  /** Present when `allowed` is false; milliseconds the caller should wait before retrying. */
  retryAfterMs?: number;
  /** Remaining tokens in the bucket after this request (when allowed). */
  remainingTokens?: number;
}

export interface RateLimiterPort {
  /**
   * Check whether the request represented by `opts.bucketKey` should be allowed.
   * Consumes `opts.cost` tokens if the bucket has enough capacity.
   *
   * Returns `ok({ allowed: false, retryAfterMs })` when rate-limited — this is
   * NOT an error path. Returns `err(RateLimitError)` only on infrastructure failure.
   */
  check(opts: RateLimiterCheckOptions): Promise<Result<RateLimiterCheckResult, RateLimitError>>;

  /**
   * Reset the bucket to its full capacity.
   * Used by workspace admins to clear a rate-limit for a specific principal.
   */
  reset(bucketKey: string): Promise<Result<void, RateLimitError>>;
}
