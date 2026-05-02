import type { LoggerPort } from '@platform/ports-observability';
import type { MongoClient } from 'mongodb';
import type { Result } from 'neverthrow';

import {
  PersistenceError,
  type TransactionContext,
  type UnitOfWorkPort,
} from '@platform/ports-persistence';
import { err } from 'neverthrow';

const LONG_TX_WARN_MS = 30_000;
const LONG_TX_ERROR_MS = 60_000; // Mongo default session timeout is 60s

export class MongoUnitOfWork implements UnitOfWorkPort {
  constructor(
    private readonly client: MongoClient,
    private readonly logger?: LoggerPort,
  ) {}

  async run<T>(
    work: (tx: TransactionContext) => Promise<Result<T, PersistenceError>>,
  ): Promise<Result<T, PersistenceError>> {
    const session = this.client.startSession();
    const txId = crypto.randomUUID();
    const tx: TransactionContext = { id: txId };

    this.logger?.debug('MongoDB session started', { txId });

    const startMs = Date.now();
    const warnTimer = setTimeout(() => {
      this.logger?.warn('Long-running MongoDB session', { txId, elapsed_ms: LONG_TX_WARN_MS });
    }, LONG_TX_WARN_MS);
    const errorTimer = setTimeout(() => {
      this.logger?.error('MongoDB session nearing timeout limit', {
        txId,
        elapsed_ms: LONG_TX_ERROR_MS,
      });
    }, LONG_TX_ERROR_MS);

    let result: Result<T, PersistenceError>;

    try {
      session.startTransaction({
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' },
      });

      result = await work(tx);

      if (result.isErr()) {
        await session.abortTransaction();
        this.logger?.debug('MongoDB transaction aborted (Err result)', { txId });
      } else {
        await session.commitTransaction();
        this.logger?.debug('MongoDB transaction committed', {
          txId,
          elapsed_ms: Date.now() - startMs,
        });
      }
    } catch (e) {
      try {
        await session.abortTransaction();
      } catch {
        // ignore abort error
      }
      this.logger?.error('MongoDB transaction aborted (exception)', { txId, err: String(e) });
      result = err(new PersistenceError('UNKNOWN', `MongoDB transaction failed: ${String(e)}`, e));
    } finally {
      clearTimeout(warnTimer);
      clearTimeout(errorTimer);
      await session.endSession();
    }

    return result;
  }
}
