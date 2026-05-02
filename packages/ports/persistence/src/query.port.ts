import type { Result } from 'neverthrow';

import type { PersistenceError } from './errors.js';
import type { Page, PaginatedResult } from './types.js';

export interface QueryPort {
  /**
   * Execute a named read-only query with typed parameters and result shape.
   */
  query<TResult, TParams extends Record<string, unknown> = Record<string, never>>(
    queryName: string,
    params?: TParams,
    page?: Page,
  ): Promise<Result<PaginatedResult<TResult>, PersistenceError>>;

  queryOne<TResult, TParams extends Record<string, unknown> = Record<string, never>>(
    queryName: string,
    params?: TParams,
  ): Promise<Result<TResult | null, PersistenceError>>;
}
