import type { LoggerPort } from '@platform/ports-observability';
import type { LockPort } from '@platform/ports-persistence';
import type { Collection, Db } from 'mongodb';
import type { Result } from 'neverthrow';

import { LockTimeoutError, PersistenceError } from '@platform/ports-persistence';
import { err } from 'neverthrow';

const LONG_LOCK_WARN_MS = 30_000;
const LONG_LOCK_ERROR_MS = 300_000;
const DEFAULT_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 100;

interface LockDocument {
  _id: string;
  expiresAt: Date;
  acquiredAt: Date;
}

/**
 * MongoDB TTL-collection based implementation of LockPort.
 *
 * Stores lock documents in a `_platform_locks` collection with a TTL index
 * on `expiresAt`. The document is created on acquire and deleted on release.
 * If the holder crashes, the TTL index auto-expires the document.
 *
 * Requires MongoDB 4.4+ for the TTL-based expiry. The collection and index
 * must be created by the migration script (0002_platform_locks.ts).
 */
export class MongoLockAdapter implements LockPort {
  private readonly locks: Collection<LockDocument>;

  constructor(
    db: Db,
    private readonly logger?: LoggerPort,
  ) {
    this.locks = db.collection<LockDocument>('_platform_locks');
  }

  async withLock<T>(
    key: string,
    work: () => Promise<Result<T, PersistenceError>>,
    opts?: { timeoutMs?: number },
  ): Promise<Result<T, PersistenceError | LockTimeoutError>> {
    const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const deadline = Date.now() + timeoutMs;

    let acquired = false;
    while (!acquired) {
      try {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + timeoutMs + 60_000);
        await this.locks.insertOne({ _id: key, expiresAt, acquiredAt: now });
        acquired = true;
      } catch (e: unknown) {
        const isDuplicate =
          e instanceof Error && 'code' in e && (e as { code: number }).code === 11000;
        if (!isDuplicate) {
          return err(new PersistenceError('UNKNOWN', `Lock insert failed: ${String(e)}`, e));
        }

        if (Date.now() >= deadline) {
          return err(new LockTimeoutError(key, timeoutMs));
        }

        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    }

    this.logger?.debug('Mongo lock acquired', { key });
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

      try {
        await this.locks.deleteOne({ _id: key });
      } catch (e) {
        this.logger?.error('Failed to release mongo lock', { key, err: String(e) });
      }

      this.logger?.debug('Mongo lock released', { key, elapsed_ms: Date.now() - startMs });
    }

    return result;
  }
}
