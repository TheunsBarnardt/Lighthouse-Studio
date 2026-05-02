import type { Result } from 'neverthrow';

import type { ConflictError, EntityNotFoundError, PersistenceError } from './errors.js';
import type { Filter, Page, PaginatedResult, Sort } from './types.js';

export interface RepositoryPort<TEntity extends { id: string }> {
  findById(id: string): Promise<Result<TEntity | null, PersistenceError>>;

  findOne(filter: Filter<TEntity>): Promise<Result<TEntity | null, PersistenceError>>;

  findMany(opts?: {
    filter?: Filter<TEntity>;
    sort?: Sort<TEntity>;
    page?: Page;
    includeArchived?: boolean;
  }): Promise<Result<PaginatedResult<TEntity>, PersistenceError>>;

  count(filter?: Filter<TEntity>): Promise<Result<number, PersistenceError>>;

  create(entity: TEntity): Promise<Result<TEntity, PersistenceError | ConflictError>>;

  update(
    id: string,
    changes: Partial<Omit<TEntity, 'id'>>,
    opts?: { expectedVersion?: number },
  ): Promise<Result<TEntity, PersistenceError | EntityNotFoundError | ConflictError>>;

  archive(id: string): Promise<Result<void, PersistenceError | EntityNotFoundError>>;

  hardDelete(id: string): Promise<Result<void, PersistenceError | EntityNotFoundError>>;
}
