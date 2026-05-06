import type { AICachePort, AiError, GenerationResponse } from '@platform/ports-ai';
import type { Result } from 'neverthrow';
import type { Pool } from 'pg';

import { AiError as AiErrorClass } from '@platform/ports-ai';
import { err, ok } from 'neverthrow';

interface CacheRow {
  response: unknown;
}

function mapError(cause: unknown): AiError {
  return new AiErrorClass('UNKNOWN', `AI cache DB error: ${String(cause)}`, cause);
}

/**
 * Postgres-backed implementation of AICachePort.
 * Reads from and writes to the `ai_response_cache` table (migration 0013).
 */
export class PostgresAiCacheAdapter implements AICachePort {
  constructor(private readonly pool: Pool) {}

  async get(cacheKeyHash: string): Promise<Result<GenerationResponse | null, AiError>> {
    try {
      const res = await this.pool.query<CacheRow>(
        `SELECT response FROM ai_response_cache
         WHERE cache_key_hash = $1
           AND expires_at > NOW()
         LIMIT 1`,
        [cacheKeyHash],
      );
      if (res.rowCount === 0 || !res.rows[0]) return ok(null);
      return ok(res.rows[0].response as GenerationResponse);
    } catch (e) {
      return err(mapError(e));
    }
  }

  async set(
    cacheKeyHash: string,
    promptId: string,
    promptVersion: string,
    provider: string,
    model: string,
    response: GenerationResponse,
    ttlSeconds = 86400,
  ): Promise<Result<void, AiError>> {
    try {
      await this.pool.query(
        `INSERT INTO ai_response_cache
           (cache_key_hash, prompt_id, prompt_version, provider, model, response, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW() + ($7 || ' seconds')::INTERVAL)
         ON CONFLICT (cache_key_hash) DO UPDATE SET
           response    = EXCLUDED.response,
           expires_at  = EXCLUDED.expires_at,
           prompt_version = EXCLUDED.prompt_version,
           _created_at = NOW()`,
        [
          cacheKeyHash,
          promptId,
          promptVersion,
          provider,
          model,
          JSON.stringify(response),
          String(ttlSeconds),
        ],
      );
      return ok(undefined);
    } catch (e) {
      return err(mapError(e));
    }
  }

  async invalidateByPrompt(
    promptId: string,
    promptVersion: string,
  ): Promise<Result<number, AiError>> {
    try {
      const res = await this.pool.query(
        `DELETE FROM ai_response_cache
         WHERE prompt_id = $1 AND prompt_version = $2`,
        [promptId, promptVersion],
      );
      return ok(res.rowCount ?? 0);
    } catch (e) {
      return err(mapError(e));
    }
  }

  async purgeExpired(): Promise<Result<number, AiError>> {
    try {
      const res = await this.pool.query(`DELETE FROM ai_response_cache WHERE expires_at <= NOW()`);
      return ok(res.rowCount ?? 0);
    } catch (e) {
      return err(mapError(e));
    }
  }
}
