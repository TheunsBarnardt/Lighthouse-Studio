import type { Result } from 'neverthrow';

import type { NotSupportedError, ObjectNotFoundError, StorageError } from './errors.js';
import type {
  ListOptions,
  ListResult,
  ObjectInfo,
  PutOptions,
  Readable,
  StorageFeature,
} from './types.js';

export interface ObjectStoragePort {
  put(
    key: string,
    data: Readable | Buffer,
    opts?: PutOptions,
  ): Promise<Result<ObjectInfo, StorageError>>;
  get(key: string): Promise<Result<Readable, StorageError | ObjectNotFoundError>>;
  head(key: string): Promise<Result<ObjectInfo | null, StorageError>>;
  delete(key: string): Promise<Result<void, StorageError>>;
  list(prefix: string, opts?: ListOptions): Promise<Result<ListResult, StorageError>>;
  signedUrl(
    key: string,
    method: 'GET' | 'PUT',
    opts: { expiresIn: number; contentType?: string },
  ): Promise<Result<string, StorageError | NotSupportedError>>;
  supports(feature: StorageFeature): boolean;
}
