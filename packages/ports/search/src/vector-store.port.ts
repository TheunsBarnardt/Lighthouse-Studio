import type { Result } from 'neverthrow';

import type { SearchError } from './errors.js';
import type { VectorPoint, VectorSearchOptions, VectorSearchResult } from './types.js';

export interface VectorStorePort {
  upsert(collectionName: string, points: VectorPoint[]): Promise<Result<void, SearchError>>;
  search(
    collectionName: string,
    vector: number[],
    opts?: VectorSearchOptions,
  ): Promise<Result<VectorSearchResult<Record<string, unknown>>, SearchError>>;
  delete(collectionName: string, ids: string[]): Promise<Result<void, SearchError>>;
  createCollection(collectionName: string, dimensions: number): Promise<Result<void, SearchError>>;
  deleteCollection(collectionName: string): Promise<Result<void, SearchError>>;
}
