import type { Result } from 'neverthrow';

import {
  NotSupportedError,
  ObjectNotFoundError,
  type ListOptions,
  type ListResult,
  type ObjectInfo,
  type ObjectStoragePort,
  type PutOptions,
  type StorageError,
  type StorageFeature,
} from '@platform/ports-storage';
import { err, ok } from 'neverthrow';
import { Readable } from 'node:stream';

interface StoredObject {
  data: Buffer;
  contentType?: string;
  metadata?: Record<string, string>;
  lastModified: Date;
}

function toObjectInfo(key: string, entry: StoredObject): ObjectInfo {
  return {
    key,
    size: entry.data.length,
    lastModified: entry.lastModified,
    ...(entry.contentType !== undefined ? { contentType: entry.contentType } : {}),
    ...(entry.metadata !== undefined ? { metadata: entry.metadata } : {}),
  };
}

export class InMemoryObjectStorage implements ObjectStoragePort {
  private readonly store = new Map<string, StoredObject>();

  async put(
    key: string,
    data: Readable | Buffer,
    opts?: PutOptions,
  ): Promise<Result<ObjectInfo, StorageError>> {
    let buf: Buffer;
    if (Buffer.isBuffer(data)) {
      buf = data;
    } else {
      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        data.on('data', (chunk: Buffer) => chunks.push(chunk));
        data.on('end', resolve);
        data.on('error', reject);
      });
      buf = Buffer.concat(chunks);
    }
    const entry: StoredObject = {
      data: buf,
      lastModified: new Date(),
      ...(opts?.contentType !== undefined ? { contentType: opts.contentType } : {}),
      ...(opts?.metadata !== undefined ? { metadata: opts.metadata } : {}),
    };
    this.store.set(key, entry);
    return ok(toObjectInfo(key, entry));
  }

  get(key: string): Promise<Result<Readable, StorageError | ObjectNotFoundError>> {
    const entry = this.store.get(key);
    if (!entry) return Promise.resolve(err(new ObjectNotFoundError(key)));
    return Promise.resolve(ok(Readable.from(entry.data)));
  }

  head(key: string): Promise<Result<ObjectInfo | null, StorageError>> {
    const entry = this.store.get(key);
    if (!entry) return Promise.resolve(ok(null));
    return Promise.resolve(ok(toObjectInfo(key, entry)));
  }

  delete(key: string): Promise<Result<void, StorageError>> {
    this.store.delete(key);
    return Promise.resolve(ok(undefined));
  }

  list(prefix: string, _opts?: ListOptions): Promise<Result<ListResult, StorageError>> {
    const objects: ObjectInfo[] = [];
    for (const [k, v] of this.store.entries()) {
      if (k.startsWith(prefix)) {
        objects.push(toObjectInfo(k, v));
      }
    }
    return Promise.resolve(ok({ objects, isTruncated: false }));
  }

  signedUrl(
    _key: string,
    _method: 'GET' | 'PUT',
    _opts: { expiresIn: number; contentType?: string },
  ): Promise<Result<string, StorageError | NotSupportedError>> {
    return Promise.resolve(err(new NotSupportedError('signed_urls')));
  }

  supports(feature: StorageFeature): boolean {
    return feature !== 'signed_urls' && feature !== 'versioning' && feature !== 'object_locks';
  }
}
