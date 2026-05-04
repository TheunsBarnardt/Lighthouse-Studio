import type { Result } from 'neverthrow';

import type { ConflictError, EntityNotFoundError, PersistenceError } from './errors.js';
import type { Filter, Page, PaginatedResult, Sort } from './types.js';

// Untyped row from a customer-defined table; the schema is determined at runtime.
export type CustomerRow = Record<string, unknown>;

// Extended repository for customer tables. Adds bulk operations and restore
// (soft-delete undo) that aren't part of the generic RepositoryPort.
export interface CustomerTableRepository {
  findById(id: string): Promise<Result<CustomerRow | null, PersistenceError>>;
  findOne(filter: Filter<CustomerRow>): Promise<Result<CustomerRow | null, PersistenceError>>;
  findMany(opts?: {
    filter?: Filter<CustomerRow>;
    sort?: Sort<CustomerRow>;
    page?: Page;
    includeArchived?: boolean;
  }): Promise<Result<PaginatedResult<CustomerRow>, PersistenceError>>;
  count(filter?: Filter<CustomerRow>): Promise<Result<number, PersistenceError>>;

  create(entity: CustomerRow): Promise<Result<CustomerRow, PersistenceError | ConflictError>>;
  update(
    id: string,
    changes: Partial<CustomerRow>,
    opts?: { expectedVersion?: number },
  ): Promise<Result<CustomerRow, PersistenceError | EntityNotFoundError | ConflictError>>;
  archive(id: string): Promise<Result<void, PersistenceError | EntityNotFoundError>>;
  restore(id: string): Promise<Result<void, PersistenceError | EntityNotFoundError>>;
  hardDelete(id: string): Promise<Result<void, PersistenceError | EntityNotFoundError>>;

  bulkCreate(
    entities: CustomerRow[],
    opts?: { maxRows?: number },
  ): Promise<Result<CustomerRow[], PersistenceError>>;
  bulkUpdate(
    filter: Filter<CustomerRow>,
    changes: Partial<CustomerRow>,
    opts?: { maxAffectedRows?: number },
  ): Promise<Result<{ affectedCount: number }, PersistenceError>>;
  bulkDelete(
    filter: Filter<CustomerRow>,
    opts?: { maxAffectedRows?: number },
  ): Promise<Result<{ affectedCount: number }, PersistenceError>>;
}

// Describes a customer table in its workspace-scoped namespace.
export interface CustomerTableDescriptor {
  /** Database namespace — e.g. `cust_acme` (Postgres/MSSQL) or `cust_acme__` (Mongo). */
  namespace: string;
  /** Table or collection name within the namespace. */
  tableName: string;
  /** All valid column names in the table; used for field validation at the API layer. */
  columnNames: string[];
  /** Name of the primary key column. */
  primaryKeyColumn: string;
}

// Implemented by persistence adapters; creates CustomerTableRepository instances
// scoped to a specific workspace namespace and table.
export interface CustomerRepositoryProviderPort {
  /**
   * Build a repository for the described customer table.
   * Caching is the caller's responsibility (see PerWorkspaceRepositoryFactory).
   */
  buildRepository(descriptor: CustomerTableDescriptor): CustomerTableRepository;
}
