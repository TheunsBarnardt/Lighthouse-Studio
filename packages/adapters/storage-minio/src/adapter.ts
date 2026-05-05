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
import { err, ok } from 'neverthrow';

import type { MinioStorageConfig } from './config.js';

/**
 * Object storage adapter for S3-compatible backends (MinIO, AWS S3, etc.).
 *
 * Uses the AWS SDK v3 with path-style URLs so it works with self-hosted MinIO.
 * Suitable for Linux self-hosted and on-premise deployments.
 * See ADR-0123 (per-workspace storage credentials).
 */
export class MinioStorageAdapter implements ObjectStoragePort {
  constructor(private readonly config: MinioStorageConfig) {}

  private resolveKey(key: string): string {
    const prefix = this.config.keyPrefix ?? '';
    return prefix ? `${prefix}/${key}` : key;
  }

  private async client() {
    const { S3Client } = await import('@aws-sdk/client-s3');
    return new S3Client({
      endpoint: this.config.endpoint,
      region: this.config.region,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
      },
      forcePathStyle: this.config.forcePathStyle ?? true,
    });
  }

  async put(
    key: string,
    data: Readable | Buffer,
    opts?: PutOptions,
  ): Promise<Result<ObjectInfo, StorageError>> {
    try {
      const { PutObjectCommand } = await import('@aws-sdk/client-s3');
      const client = await this.client();

      const body = Buffer.isBuffer(data) ? data : await streamToBuffer(data);
      const cmd = new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: this.resolveKey(key),
        Body: body,
        ...(opts?.contentType !== undefined ? { ContentType: opts.contentType } : {}),
        ...(opts?.metadata !== undefined ? { Metadata: opts.metadata } : {}),
        ...(opts?.acl === 'public-read' ? { ACL: 'public-read' } : {}),
      });

      const resp = await client.send(cmd);
      return ok({
        key,
        size: body.length,
        lastModified: new Date(),
        ...(resp.ETag !== undefined ? { etag: resp.ETag.replace(/"/g, '') } : {}),
        ...(opts?.contentType !== undefined ? { contentType: opts.contentType } : {}),
      });
    } catch (cause) {
      return err(new StorageError('PROVIDER_ERROR', `Failed to put object '${key}'`, cause));
    }
  }

  async get(key: string): Promise<Result<Readable, StorageError>> {
    try {
      const { GetObjectCommand } = await import('@aws-sdk/client-s3');
      const client = await this.client();

      const cmd = new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: this.resolveKey(key),
      });

      const resp = await client.send(cmd);
      if (!resp.Body) {
        return err(new StorageError('OBJECT_NOT_FOUND', `Object '${key}' returned empty body`));
      }
      return ok(resp.Body as unknown as Readable);
    } catch (cause: unknown) {
      const isNotFound =
        cause instanceof Error && (cause.name === 'NoSuchKey' || cause.name === 'NotFound');
      if (isNotFound) {
        return err(new StorageError('OBJECT_NOT_FOUND', `Object '${key}' not found`, cause));
      }
      return err(new StorageError('PROVIDER_ERROR', `Failed to get object '${key}'`, cause));
    }
  }

  async head(key: string): Promise<Result<ObjectInfo | null, StorageError>> {
    try {
      const { HeadObjectCommand } = await import('@aws-sdk/client-s3');
      const client = await this.client();

      const cmd = new HeadObjectCommand({
        Bucket: this.config.bucket,
        Key: this.resolveKey(key),
      });

      try {
        const resp = await client.send(cmd);
        return ok({
          key,
          size: resp.ContentLength ?? 0,
          lastModified: resp.LastModified ?? new Date(),
          ...(resp.ETag !== undefined ? { etag: resp.ETag.replace(/"/g, '') } : {}),
          ...(resp.ContentType !== undefined ? { contentType: resp.ContentType } : {}),
          ...(resp.Metadata !== undefined ? { metadata: resp.Metadata } : {}),
        });
      } catch (headErr: unknown) {
        const isNotFound =
          headErr instanceof Error &&
          (headErr.name === 'NotFound' ||
            headErr.name === 'NoSuchKey' ||
            (headErr as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode ===
              404);
        if (isNotFound) return ok(null);
        throw headErr;
      }
    } catch (cause) {
      return err(new StorageError('PROVIDER_ERROR', `Failed to head object '${key}'`, cause));
    }
  }

  async delete(key: string): Promise<Result<void, StorageError>> {
    try {
      const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
      const client = await this.client();

      await client.send(
        new DeleteObjectCommand({ Bucket: this.config.bucket, Key: this.resolveKey(key) }),
      );
      return ok(undefined);
    } catch (cause) {
      return err(new StorageError('PROVIDER_ERROR', `Failed to delete object '${key}'`, cause));
    }
  }

  async list(prefix: string, opts?: ListOptions): Promise<Result<ListResult, StorageError>> {
    try {
      const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');
      const client = await this.client();

      const resolvedPrefix = this.resolveKey(prefix);
      const maxKeys = opts?.maxKeys ?? 1000;

      const cmd = new ListObjectsV2Command({
        Bucket: this.config.bucket,
        Prefix: resolvedPrefix,
        MaxKeys: maxKeys,
        ...(opts?.continuationToken !== undefined
          ? { ContinuationToken: opts.continuationToken }
          : {}),
      });

      const resp = await client.send(cmd);
      const objects: ObjectInfo[] = (resp.Contents ?? []).map((obj) => ({
        key: (obj.Key ?? '').replace(resolvedPrefix, prefix),
        size: obj.Size ?? 0,
        lastModified: obj.LastModified ?? new Date(),
        ...(obj.ETag !== undefined ? { etag: obj.ETag.replace(/"/g, '') } : {}),
      }));

      return ok({
        objects,
        isTruncated: resp.IsTruncated ?? false,
        ...(resp.NextContinuationToken !== undefined
          ? { continuationToken: resp.NextContinuationToken }
          : {}),
      });
    } catch (cause) {
      return err(
        new StorageError('PROVIDER_ERROR', `Failed to list objects with prefix '${prefix}'`, cause),
      );
    }
  }

  async signedUrl(
    key: string,
    method: 'GET' | 'PUT',
    opts: { expiresIn: number; contentType?: string },
  ): Promise<Result<string, StorageError | NotSupportedError>> {
    try {
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      const { GetObjectCommand, PutObjectCommand } = await import('@aws-sdk/client-s3');
      const client = await this.client();

      const cmd =
        method === 'GET'
          ? new GetObjectCommand({ Bucket: this.config.bucket, Key: this.resolveKey(key) })
          : new PutObjectCommand({
              Bucket: this.config.bucket,
              Key: this.resolveKey(key),
              ...(opts.contentType !== undefined ? { ContentType: opts.contentType } : {}),
            });

      const url = await getSignedUrl(client, cmd, { expiresIn: opts.expiresIn });
      return ok(url);
    } catch (cause) {
      return err(
        new StorageError('PROVIDER_ERROR', `Failed to generate signed URL for '${key}'`, cause),
      );
    }
  }

  supports(feature: StorageFeature): boolean {
    return feature === 'signed_urls' || feature === 'multipart';
  }
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer | string>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
