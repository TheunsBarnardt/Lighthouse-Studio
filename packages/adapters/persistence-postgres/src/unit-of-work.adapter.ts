import type { LoggerPort } from '@platform/ports-observability';
import type { Result } from 'neverthrow';
import type { Pool, PoolClient } from 'pg';

import {
  PersistenceError,
  type TransactionContext,
  type UnitOfWorkPort,
} from '@platform/ports-persistence';
import { err } from 'neverthrow';

const LONG_TX_WARN_MS = 30_000; // 30 s
const LONG_TX_ERROR_MS = 300_000; // 5 min

export class PostgresUnitOfWork implements UnitOfWorkPort {
  constructor(
    private readonly pool: Pool,
    private readonly logger?: LoggerPort,
  ) {}

  async run<T>(
    work: (tx: TransactionContext) => Promise<Result<T, PersistenceError>>,
  ): Promise<Result<T, PersistenceError>> {
    let client: PoolClient | undefined;

    try {
      client = await this.pool.connect();
    } catch (e) {
      return err(
        new PersistenceError('CONNECTION_FAILED', `Failed to acquire connection: ${String(e)}`, e),
      );
    }

    const txId = crypto.randomUUID();
    const tx: TransactionContext = { id: txId };

    this.logger?.debug('Transaction started', { txId });

    const startMs = Date.now();
    const warnTimer = setTimeout(() => {
      this.logger?.warn('Long-running transaction detected', { txId, elapsed_ms: LONG_TX_WARN_MS });
    }, LONG_TX_WARN_MS);
    const errorTimer = setTimeout(() => {
      this.logger?.error('Extremely long-running transaction', {
        txId,
        elapsed_ms: LONG_TX_ERROR_MS,
      });
    }, LONG_TX_ERROR_MS);

    let result: Result<T, PersistenceError>;

    try {
      await client.query('BEGIN');
      result = await work(tx);

      if (result.isErr()) {
        await client.query('ROLLBACK');
        this.logger?.debug('Transaction rolled back (Err result)', { txId });
      } else {
        await client.query('COMMIT');
        this.logger?.debug('Transaction committed', { txId, elapsed_ms: Date.now() - startMs });
      }
    } catch (e) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore rollback error — connection may be dead
      }
      this.logger?.error('Transaction rolled back (exception)', { txId, err: String(e) });
      result = err(new PersistenceError('UNKNOWN', `Transaction failed: ${String(e)}`, e));
    } finally {
      clearTimeout(warnTimer);
      clearTimeout(errorTimer);
      client.release();
    }

    return result;
  }
}
