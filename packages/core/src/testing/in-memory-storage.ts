/* eslint-disable @typescript-eslint/require-await */
import type {
  ListOptions,
  ListResult,
  NotSupportedError,
  ObjectInfo,
  ObjectStoragePort,
  PutOptions,
  StorageFeature,
} from '@platform/ports-storage';
import type { Result } from 'neverthrow';
import type { Readable } from 'node:stream';

import { StorageError } from '@platform/ports-storage';
import { ok, err } from 'neverthrow';
import { Readable as NodeReadable } from 'node:stream';

/**
 * In-memory ObjectStoragePort for unit tests.
 */
export function createInMemoryObjectStorage(): ObjectStoragePort & {
  objects: Map<string, { data: Buffer; info: ObjectInfo }>;
} {
  const objects = new Map<string, { data: Buffer; info: ObjectInfo }>();

  return {
    objects,

    async put(
      key: string,
      data: Readable | Buffer,
      opts?: PutOptions,
    ): Promise<Result<ObjectInfo, StorageError>> {
      const buf = Buffer.isBuffer(data) ? data : await streamToBuffer(data);
      const info: ObjectInfo = {
        key,
        size: buf.length,
        lastModified: new Date(),
        etag: `etag-${key}`,
        ...(opts?.contentType !== undefined ? { contentType: opts.contentType } : {}),
      };
      objects.set(key, { data: buf, info });
      return ok(info);
    },

    async get(key: string): Promise<Result<Readable, StorageError>> {
      const entry = objects.get(key);
      if (!entry) return err(new StorageError('OBJECT_NOT_FOUND', `Not found: ${key}`));
      return ok(NodeReadable.from([entry.data]));
    },

    async head(key: string): Promise<Result<ObjectInfo | null, StorageError>> {
      const entry = objects.get(key);
      return ok(entry?.info ?? null);
    },

    async delete(key: string): Promise<Result<void, StorageError>> {
      objects.delete(key);
      return ok(undefined);
    },

    async list(prefix: string, opts?: ListOptions): Promise<Result<ListResult, StorageError>> {
      const maxKeys = opts?.maxKeys ?? 1000;
      const allMatching = [...objects.entries()]
        .filter(([k]) => k.startsWith(prefix))
        .map(([, v]) => v.info);

      return ok({
        objects: allMatching.slice(0, maxKeys),
        isTruncated: allMatching.length > maxKeys,
      });
    },

    async signedUrl(
      key: string,
      _method: 'GET' | 'PUT',
      _opts: { expiresIn: number; contentType?: string },
    ): Promise<Result<string, StorageError | NotSupportedError>> {
      return ok(`https://test-storage/signed/${encodeURIComponent(key)}`);
    },

    supports(feature: StorageFeature): boolean {
      return feature === 'signed_urls';
    },
  };
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer | string>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
