import type { Result } from 'neverthrow';

import type { PersistenceError } from './errors.js';

export class LockTimeoutError extends Error {
  readonly code = 'LOCK_TIMEOUT' as const;

  constructor(
    public readonly lockKey: string,
    public readonly timeoutMs: number,
  ) {
    super(`Could not acquire lock '${lockKey}' within ${String(timeoutMs)}ms`);
    this.name = 'LockTimeoutError';
  }
}

export interface LockPort {
  /**
   * Acquire an exclusive named lock, run the callback, then release.
   *
   * - **Postgres**: advisory locks via pg_try_advisory_lock
   * - **MSSQL**: sp_getapplock
   * - **MongoDB**: TTL document in a `locks` collection
   *
   * If the lock is held by another process and cannot be acquired within
   * `timeoutMs` (default 30 000ms), returns LockTimeoutError without
   * executing the callback. Holding a lock longer than 30 s emits a warning;
   * longer than 5 min emits an error.
   *
   * Do not call external services (HTTP, AI, email) inside the callback.
   * Transactions that block on external IO while holding a lock will hit
   * the timeout and poison the lock. Stage those operations: acquire lock,
   * prepare, release, then call external service.
   */
  withLock<T>(
    key: string,
    work: () => Promise<Result<T, PersistenceError>>,
    opts?: { timeoutMs?: number },
  ): Promise<Result<T, PersistenceError | LockTimeoutError>>;
}
