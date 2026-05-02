import type {
  PersistenceError,
  TransactionContext,
  UnitOfWorkPort,
} from '@platform/ports-persistence';
import type { Result } from 'neverthrow';

import { PersistenceError as PE } from '@platform/ports-persistence';
import { err } from 'neverthrow';

export class InMemoryUnitOfWork implements UnitOfWorkPort {
  async run<T>(
    work: (tx: TransactionContext) => Promise<Result<T, PersistenceError>>,
  ): Promise<Result<T, PersistenceError>> {
    const tx: TransactionContext = { id: crypto.randomUUID() };
    try {
      return await work(tx);
    } catch (e) {
      return err(new PE('UNKNOWN', `Transaction failed: ${String(e)}`, e));
    }
  }
}
