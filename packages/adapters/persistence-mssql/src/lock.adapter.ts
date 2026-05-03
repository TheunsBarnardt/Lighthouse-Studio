import type { LoggerPort } from '@platform/ports-observability';
import type { LockPort } from '@platform/ports-persistence';
import type { ConnectionPool } from 'mssql';
import type { Result } from 'neverthrow';

import { LockTimeoutError, PersistenceError } from '@platform/ports-persistence';
import { err } from 'neverthrow';

const LONG_LOCK_WARN_MS = 30_000;
const LONG_LOCK_ERROR_MS = 300_000;
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * MSSQL sp_getapplock based implementation of LockPort.
 * Uses application-level locks that are session-scoped and auto-released on disconnect.
 */
export class MssqlLockAdapter implements LockPort {
  constructor(
    private readonly pool: ConnectionPool,
    private readonly logger?: LoggerPort,
  ) {}

  async withLock<T>(
    key: string,
    work: () => Promise<Result<T, PersistenceError>>,
    opts?: { timeoutMs?: number },
  ): Promise<Result<T, PersistenceError | LockTimeoutError>> {
    const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const truncatedKey = key.slice(0, 255);
    const request = this.pool.request();

    let acquired = false;
    try {
      const result = await request.query<{ return_code: number }>(
        `DECLARE @ret INT;
         EXEC @ret = sp_getapplock
           @Resource = '${truncatedKey}',
           @LockMode = 'Exclusive',
           @LockOwner = 'Session',
           @LockTimeout = ${String(timeoutMs)};
         SELECT @ret AS return_code;`,
      );

      const returnCode = result.recordset[0]?.return_code ?? -1;
      // 0 = granted, 1 = granted after wait — both are success
      acquired = returnCode >= 0;
    } catch (e) {
      return err(new PersistenceError('UNKNOWN', `sp_getapplock failed: ${String(e)}`, e));
    }

    if (!acquired) {
      return err(new LockTimeoutError(key, timeoutMs));
    }

    this.logger?.debug('App lock acquired', { key: truncatedKey });
    const startMs = Date.now();

    const warnTimer = setTimeout(() => {
      this.logger?.warn('Long-running lock detected', {
        key: truncatedKey,
        elapsed_ms: LONG_LOCK_WARN_MS,
      });
    }, LONG_LOCK_WARN_MS);
    const errorTimer = setTimeout(() => {
      this.logger?.error('Extremely long-running lock', {
        key: truncatedKey,
        elapsed_ms: LONG_LOCK_ERROR_MS,
      });
    }, LONG_LOCK_ERROR_MS);

    let result: Result<T, PersistenceError>;
    try {
      result = await work();
    } finally {
      clearTimeout(warnTimer);
      clearTimeout(errorTimer);

      try {
        await this.pool
          .request()
          .query(`EXEC sp_releaseapplock @Resource = '${truncatedKey}', @LockOwner = 'Session'`);
      } catch (e) {
        this.logger?.error('Failed to release app lock', { key: truncatedKey, err: String(e) });
      }

      this.logger?.debug('App lock released', {
        key: truncatedKey,
        elapsed_ms: Date.now() - startMs,
      });
    }

    return result;
  }
}
