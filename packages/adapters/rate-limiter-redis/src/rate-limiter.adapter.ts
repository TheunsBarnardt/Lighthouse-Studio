import type {
  RateLimiterCheckOptions,
  RateLimiterCheckResult,
  RateLimiterPort,
} from '@platform/ports-rate-limiter';
import type { Redis } from 'ioredis';
import type { Result } from 'neverthrow';

import { RateLimitError } from '@platform/ports-rate-limiter';
import { ok, err } from 'neverthrow';

// Lua script: atomic token-bucket check-and-consume.
// Keys[1] = bucket key
// Args[1] = capacity (max tokens)
// Args[2] = refillRate (tokens per second)
// Args[3] = cost (tokens this request consumes)
// Args[4] = nowMs (current time in milliseconds)
// Returns: [allowed (0|1), value (remaining tokens OR retryAfterMs)]
const TOKEN_BUCKET_SCRIPT = `
local key        = KEYS[1]
local capacity   = tonumber(ARGV[1])
local refillRate = tonumber(ARGV[2])
local cost       = tonumber(ARGV[3])
local nowMs      = tonumber(ARGV[4])

local data = redis.call('HMGET', key, 'tokens', 'lastRefillAt')
local tokens      = tonumber(data[1])
local lastRefill  = tonumber(data[2])

if tokens == nil then
  tokens     = capacity
  lastRefill = nowMs
end

-- Refill proportionally to elapsed time
local elapsedSec = (nowMs - lastRefill) / 1000
local refill     = elapsedSec * refillRate
tokens = math.min(capacity, tokens + refill)

if tokens >= cost then
  tokens = tokens - cost
  local ttlSec = math.ceil(capacity / refillRate) + 1
  redis.call('HMSET', key, 'tokens', tokens, 'lastRefillAt', nowMs)
  redis.call('EXPIRE', key, ttlSec)
  return {1, math.floor(tokens)}
else
  local tokensNeeded = cost - tokens
  local retryAfterMs = math.ceil((tokensNeeded / refillRate) * 1000)
  -- Still persist refill progress so the next check starts correctly
  local ttlSec = math.ceil(capacity / refillRate) + 1
  redis.call('HMSET', key, 'tokens', tokens, 'lastRefillAt', nowMs)
  redis.call('EXPIRE', key, ttlSec)
  return {0, retryAfterMs}
end
`;

export interface RedisRateLimiterOptions {
  /** Prefix applied to every Redis key, e.g. `"rl:"`. Defaults to `"rl:"`. */
  keyPrefix?: string;
}

export class RedisRateLimiter implements RateLimiterPort {
  private readonly redis: Redis;
  private readonly keyPrefix: string;
  private scriptSha: string | null = null;

  constructor(redis: Redis, opts: RedisRateLimiterOptions = {}) {
    this.redis = redis;
    this.keyPrefix = opts.keyPrefix ?? 'rl:';
  }

  private async loadScript(): Promise<string> {
    if (this.scriptSha) return this.scriptSha;
    const sha = (await this.redis.script('LOAD', TOKEN_BUCKET_SCRIPT)) as string;
    this.scriptSha = sha;
    return sha;
  }

  async check(
    opts: RateLimiterCheckOptions,
  ): Promise<Result<RateLimiterCheckResult, RateLimitError>> {
    const key = `${this.keyPrefix}${opts.bucketKey}`;
    const nowMs = Date.now();

    try {
      const sha = await this.loadScript();

      let result: [number, number];
      try {
        result = (await this.redis.evalsha(
          sha,
          1,
          key,
          String(opts.capacity),
          String(opts.refillRate),
          String(opts.cost),
          String(nowMs),
        )) as [number, number];
      } catch (e: unknown) {
        // NOSCRIPT means Redis flushed its script cache; reload and retry once
        if (e instanceof Error && e.message.startsWith('NOSCRIPT')) {
          this.scriptSha = null;
          const freshSha = await this.loadScript();
          result = (await this.redis.evalsha(
            freshSha,
            1,
            key,
            String(opts.capacity),
            String(opts.refillRate),
            String(opts.cost),
            String(nowMs),
          )) as [number, number];
        } else {
          throw e;
        }
      }

      const [allowed, value] = result;
      if (allowed === 1) {
        return ok({ allowed: true, remainingTokens: value });
      }
      return ok({ allowed: false, retryAfterMs: value });
    } catch (cause: unknown) {
      return err(new RateLimitError('BACKEND_FAILURE', 'Redis rate-limiter error', { cause }));
    }
  }

  async reset(bucketKey: string): Promise<Result<void, RateLimitError>> {
    const key = `${this.keyPrefix}${bucketKey}`;
    try {
      await this.redis.del(key);
      return ok(undefined);
    } catch (cause: unknown) {
      return err(
        new RateLimitError('BACKEND_FAILURE', 'Redis rate-limiter reset error', { cause }),
      );
    }
  }
}
