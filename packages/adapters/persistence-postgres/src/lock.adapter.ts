import type { LoggerPort } from '@platform/ports-observability';
import type { LockPort } from '@platform/ports-persistence';
import type { Result } from 'neverthrow';
import type { Pool } from 'pg';

import { LockTimeoutError, PersistenceError } from '@platform/ports-persistence';
import { err } from 'neverthrow';

const LONG_LOCK_WARN_MS = 30_000;
const LONG_LOCK_ERROR_MS = 300_000;
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * PostgreSQL advisory-lock based implementation of LockPort.
 * Uses pg_try_advisory_lock / pg_advisory_unlock for exclusive named locks.
 *
 * Advisory lock keys are integers; we hash the string key into a bigint bucket.
 * Collision probability is low for < 10k distinct lock keys.
 */
export class PostgresLockAdapter implements LockPort {
  constructor(
    private readonly pool: Pool,
    private readonly logger?: LoggerPort,
  ) {}

  async withLock<T>(
    key: string,
    work: () => Promise<Result<T, PersistenceError>>,
    opts?: { timeoutMs?: number },
  ): Promise<Result<T, PersistenceError | LockTimeoutError>> {
    const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const lockKey = this._hashKey(key);
    const client = await this.pool.connect();

    try {
      const deadline = Date.now() + timeoutMs;
      let acquired = false;

      while (!acquired) {
        const { rows } = await client.query<{ acquired: boolean }>(
          'SELECT pg_try_advisory_lock($1) AS acquired',
          [lockKey],
        );
        acquired = rows[0]?.acquired === true;

        if (!acquired) {
          if (Date.now() >= deadline) {
            return err(new LockTimeoutError(key, timeoutMs));
          }
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }

      this.logger?.debug('Advisory lock acquired', { key, lockKey: String(lockKey) });

      const startMs = Date.now();
      const warnTimer = setTimeout(() => {
        this.logger?.warn('Long-running lock detected', { key, elapsed_ms: LONG_LOCK_WARN_MS });
      }, LONG_LOCK_WARN_MS);
      const errorTimer = setTimeout(() => {
        this.logger?.error('Extremely long-running lock', { key, elapsed_ms: LONG_LOCK_ERROR_MS });
      }, LONG_LOCK_ERROR_MS);

      let result: Result<T, PersistenceError>;
      try {
        result = await work();
      } finally {
        clearTimeout(warnTimer);
        clearTimeout(errorTimer);
        await client.query('SELECT pg_advisory_unlock($1)', [lockKey]);
        this.logger?.debug('Advisory lock released', {
          key,
          elapsed_ms: Date.now() - startMs,
        });
      }

      return result;
    } catch (e) {
      return err(new PersistenceError('UNKNOWN', `Lock operation failed: ${String(e)}`, e));
    } finally {
      client.release();
    }
  }

  private _hashKey(key: string): number {
    // djb2 hash — deterministic, fast, good distribution for this use case
    let hash = 5381;
    for (let i = 0; i < key.length; i++) {
      hash = ((hash << 5) + hash + key.charCodeAt(i)) & 0x7fffffff;
    }
    return hash;
  }
}
