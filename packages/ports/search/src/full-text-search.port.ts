import type { Result } from 'neverthrow';

import type { SearchError } from './errors.js';
import type { FullTextSearchOptions, SearchResult } from './types.js';

export interface FullTextSearchPort {
  index(
    indexName: string,
    id: string,
    document: Record<string, unknown>,
  ): Promise<Result<void, SearchError>>;
  delete(indexName: string, id: string): Promise<Result<void, SearchError>>;
  search<T extends Record<string, unknown>>(
    indexName: string,
    query: string,
    opts?: FullTextSearchOptions,
  ): Promise<Result<SearchResult<T>, SearchError>>;
  deleteIndex(indexName: string): Promise<Result<void, SearchError>>;
}
