import type { Result } from 'neverthrow';

import type { StorageError } from './errors.js';
import type { StorageMetadata } from './types.js';

export interface StorageMetadataPort {
  record(
    metadata: Omit<StorageMetadata, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Result<StorageMetadata, StorageError>>;
  findByKey(key: string): Promise<Result<StorageMetadata | null, StorageError>>;
  listByWorkspace(
    workspaceId: string,
    opts?: { limit?: number; offset?: number },
  ): Promise<Result<{ items: StorageMetadata[]; total: number }, StorageError>>;
  delete(id: string): Promise<Result<void, StorageError>>;
}
