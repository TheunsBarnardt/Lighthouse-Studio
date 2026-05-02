import type { Result } from 'neverthrow';

import type { PersistenceError } from './errors.js';

export interface UnitOfWorkPort {
  /**
   * Execute a callback inside a transaction. The callback receives a transaction context
   * object. If the callback throws or returns an Err Result, the transaction is rolled back.
   */
  run<T>(
    work: (tx: TransactionContext) => Promise<Result<T, PersistenceError>>,
  ): Promise<Result<T, PersistenceError>>;
}

export interface TransactionContext {
  readonly id: string;
}
