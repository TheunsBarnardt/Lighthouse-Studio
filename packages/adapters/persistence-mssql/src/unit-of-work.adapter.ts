import type { LoggerPort } from '@platform/ports-observability';
import type * as mssql from 'mssql';
import type { Result } from 'neverthrow';

import {
  PersistenceError,
  type TransactionContext,
  type UnitOfWorkPort,
} from '@platform/ports-persistence';
import { err } from 'neverthrow';

const LONG_TX_WARN_MS = 30_000;
const LONG_TX_ERROR_MS = 300_000;
const MAX_DEADLOCK_RETRIES = 3;

const MSSQL_DEADLOCK_NUMBER = 1205;

export class MssqlUnitOfWork implements UnitOfWorkPort {
  constructor(
    private readonly pool: mssql.ConnectionPool,
    private readonly logger?: LoggerPort,
  ) {}

  async run<T>(
    work: (tx: TransactionContext) => Promise<Result<T, PersistenceError>>,
  ): Promise<Result<T, PersistenceError>> {
    for (let attempt = 1; attempt <= MAX_DEADLOCK_RETRIES; attempt++) {
      const result = await this.runOnce(work, attempt);
      if (result.isErr() && result.error.code === 'DEADLOCK' && attempt < MAX_DEADLOCK_RETRIES) {
        const backoffMs = attempt * 50;
        this.logger?.warn('Deadlock detected; retrying transaction', {
          attempt,
          backoff_ms: backoffMs,
        });
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }
      return result;
    }
    // Unreachable, but TypeScript requires a return
    return err(new PersistenceError('DEADLOCK', 'Max deadlock retries exceeded'));
  }

  private async runOnce<T>(
    work: (tx: TransactionContext) => Promise<Result<T, PersistenceError>>,
    attempt: number,
  ): Promise<Result<T, PersistenceError>> {
    let transaction: mssql.Transaction | undefined;

    try {
      transaction = new (await import('mssql')).Transaction(this.pool);
      await transaction.begin();
    } catch (e) {
      return err(
        new PersistenceError(
          'CONNECTION_FAILED',
          `Failed to begin MSSQL transaction: ${String(e)}`,
          e,
        ),
      );
    }

    const txId = crypto.randomUUID();
    const tx: TransactionContext = { id: txId };

    this.logger?.debug('Transaction started', { txId, attempt });

    const startMs = Date.now();
    const warnTimer = setTimeout(() => {
      this.logger?.warn('Long-running MSSQL transaction', { txId, elapsed_ms: LONG_TX_WARN_MS });
    }, LONG_TX_WARN_MS);
    const errorTimer = setTimeout(() => {
      this.logger?.error('Extremely long-running MSSQL transaction', {
        txId,
        elapsed_ms: LONG_TX_ERROR_MS,
      });
    }, LONG_TX_ERROR_MS);

    let result: Result<T, PersistenceError>;

    try {
      result = await work(tx);

      if (result.isErr()) {
        await transaction.rollback();
        this.logger?.debug('Transaction rolled back (Err result)', { txId });
      } else {
        await transaction.commit();
        this.logger?.debug('Transaction committed', { txId, elapsed_ms: Date.now() - startMs });
      }
    } catch (e) {
      try {
        await transaction.rollback();
      } catch {
        // ignore rollback error — connection may be dead
      }
      this.logger?.error('Transaction rolled back (exception)', { txId, err: String(e) });

      const num = (e as { number?: number }).number;
      if (num === MSSQL_DEADLOCK_NUMBER) {
        result = err(new PersistenceError('DEADLOCK', 'Deadlock detected', e));
      } else {
        result = err(new PersistenceError('UNKNOWN', `Transaction failed: ${String(e)}`, e));
      }
    } finally {
      clearTimeout(warnTimer);
      clearTimeout(errorTimer);
    }

    return result;
  }
}
