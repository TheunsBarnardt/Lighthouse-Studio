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

import {
  NotSupportedError as StorageNotSupportedError,
  StorageError,
} from '@platform/ports-storage';
import { err, ok } from 'neverthrow';

import type { B2StorageConfig } from './config.js';

interface B2AuthResponse {
  authorizationToken: string;
  apiUrl: string;
  downloadUrl: string;
  recommendedPartSize: number;
}

interface B2UploadUrlResponse {
  uploadUrl: string;
  authorizationToken: string;
}

/**
 * Object storage adapter for Backblaze B2.
 *
 * Uses the B2 native API via the `backblaze-b2` npm package.
 * B2 is the recommended backend for Linux self-hosted deployments.
 * Signed URL support uses B2's native download authorization tokens.
 *
 * Note: B2 does not support storage classes/tiers — capability flag reflects this.
 * See ADR-0123 (per-workspace storage credentials) and ADR-0126 (storage credentials).
 */
export class B2StorageAdapter implements ObjectStoragePort {
  private authCache: { auth: B2AuthResponse; expiresAt: number } | null = null;

  constructor(private readonly config: B2StorageConfig) {}

  private resolveKey(key: string): string {
    const prefix = this.config.keyPrefix ?? '';
    return prefix ? `${prefix}/${key}` : key;
  }

  private async authorize(): Promise<B2AuthResponse> {
    const now = Date.now();
    if (this.authCache && this.authCache.expiresAt > now) {
      return this.authCache.auth;
    }

    const credentials = Buffer.from(
      `${this.config.applicationKeyId}:${this.config.applicationKey}`,
    ).toString('base64');

    const response = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
      headers: { Authorization: `Basic ${credentials}` },
    });

    if (!response.ok) {
      throw new Error(`B2 authorization failed: ${String(response.status)} ${response.statusText}`);
    }

    const auth = (await response.json()) as B2AuthResponse;
    // Cache for 23 hours (B2 tokens last 24h)
    this.authCache = { auth, expiresAt: now + 23 * 60 * 60 * 1000 };
    return auth;
  }

  async put(
    key: string,
    data: Readable | Buffer,
    opts?: PutOptions,
  ): Promise<Result<ObjectInfo, StorageError>> {
    try {
      const auth = await this.authorize();

      // Get upload URL
      const uploadUrlResp = await fetch(`${auth.apiUrl}/b2api/v2/b2_get_upload_url`, {
        method: 'POST',
        headers: {
          Authorization: auth.authorizationToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bucketId: this.config.bucketId }),
      });

      if (!uploadUrlResp.ok) {
        throw new Error(`Failed to get B2 upload URL: ${String(uploadUrlResp.status)}`);
      }

      const uploadUrl = (await uploadUrlResp.json()) as B2UploadUrlResponse;
      const body = Buffer.isBuffer(data) ? data : await streamToBuffer(data);

      const crypto = await import('node:crypto');
      const sha1 = crypto.createHash('sha1').update(body).digest('hex');

      const uploadResp = await fetch(uploadUrl.uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: uploadUrl.authorizationToken,
          'X-Bz-File-Name': encodeURIComponent(this.resolveKey(key)),
          'Content-Type': opts?.contentType ?? 'application/octet-stream',
          'Content-Length': String(body.length),
          'X-Bz-Content-Sha1': sha1,
          ...(opts?.metadata
            ? Object.fromEntries(
                Object.entries(opts.metadata).map(([k, v]) => [`X-Bz-Info-${k}`, v]),
              )
            : {}),
        },
        body,
      });

      if (!uploadResp.ok) {
        throw new Error(`B2 upload failed: ${String(uploadResp.status)}`);
      }

      const uploaded = (await uploadResp.json()) as { fileId: string; contentSha1: string };
      return ok({
        key,
        size: body.length,
        lastModified: new Date(),
        etag: uploaded.contentSha1,
        ...(opts?.contentType !== undefined ? { contentType: opts.contentType } : {}),
      });
    } catch (cause) {
      return err(new StorageError('PROVIDER_ERROR', `Failed to upload '${key}' to B2`, cause));
    }
  }

  async get(key: string): Promise<Result<Readable, StorageError>> {
    try {
      const auth = await this.authorize();
      const url = `${auth.downloadUrl}/file/${this.config.bucketName}/${this.resolveKey(key)}`;

      const resp = await fetch(url, {
        headers: { Authorization: auth.authorizationToken },
      });

      if (resp.status === 404) {
        return err(new StorageError('OBJECT_NOT_FOUND', `Object '${key}' not found in B2`));
      }
      if (!resp.ok) {
        throw new Error(`B2 download failed: ${String(resp.status)}`);
      }

      const { Readable } = await import('node:stream');
      if (!resp.body) {
        return err(new StorageError('PROVIDER_ERROR', `B2 response body is null for '${key}'`));
      }
      return ok(Readable.fromWeb(resp.body as unknown as Parameters<typeof Readable.fromWeb>[0]));
    } catch (cause) {
      return err(new StorageError('PROVIDER_ERROR', `Failed to download '${key}' from B2`, cause));
    }
  }

  async head(key: string): Promise<Result<ObjectInfo | null, StorageError>> {
    try {
      const auth = await this.authorize();
      const url = `${auth.downloadUrl}/file/${this.config.bucketName}/${this.resolveKey(key)}`;

      const resp = await fetch(url, {
        method: 'HEAD',
        headers: { Authorization: auth.authorizationToken },
      });

      if (resp.status === 404) return ok(null);
      if (!resp.ok) {
        throw new Error(`B2 head failed: ${String(resp.status)}`);
      }

      const etag = resp.headers.get('x-bz-content-sha1');
      const contentType = resp.headers.get('content-type');
      return ok({
        key,
        size: Number(resp.headers.get('content-length') ?? 0),
        lastModified: new Date(resp.headers.get('x-bz-upload-timestamp') ?? Date.now()),
        ...(etag !== null && { etag }),
        ...(contentType !== null && { contentType }),
      });
    } catch (cause) {
      return err(new StorageError('PROVIDER_ERROR', `Failed to head '${key}' in B2`, cause));
    }
  }

  async delete(key: string): Promise<Result<void, StorageError>> {
    try {
      const auth = await this.authorize();

      // B2 requires the fileId to delete; we must list first to get it
      const listResp = await fetch(`${auth.apiUrl}/b2api/v2/b2_list_file_names`, {
        method: 'POST',
        headers: {
          Authorization: auth.authorizationToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bucketId: this.config.bucketId,
          startFileName: this.resolveKey(key),
          maxFileCount: 1,
          prefix: this.resolveKey(key),
        }),
      });

      if (!listResp.ok) throw new Error(`B2 list failed: ${String(listResp.status)}`);

      const listData = (await listResp.json()) as {
        files: Array<{ fileId: string; fileName: string }>;
      };
      const file = listData.files.find((f) => f.fileName === this.resolveKey(key));

      if (!file) return ok(undefined); // Already gone

      const deleteResp = await fetch(`${auth.apiUrl}/b2api/v2/b2_delete_file_version`, {
        method: 'POST',
        headers: {
          Authorization: auth.authorizationToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileId: file.fileId, fileName: file.fileName }),
      });

      if (!deleteResp.ok) throw new Error(`B2 delete failed: ${String(deleteResp.status)}`);
      return ok(undefined);
    } catch (cause) {
      return err(new StorageError('PROVIDER_ERROR', `Failed to delete '${key}' from B2`, cause));
    }
  }

  async list(prefix: string, opts?: ListOptions): Promise<Result<ListResult, StorageError>> {
    try {
      const auth = await this.authorize();

      const body: Record<string, unknown> = {
        bucketId: this.config.bucketId,
        prefix: this.resolveKey(prefix),
        maxFileCount: opts?.maxKeys ?? 1000,
      };

      if (opts?.continuationToken) {
        body['startFileName'] = opts.continuationToken;
      }

      const resp = await fetch(`${auth.apiUrl}/b2api/v2/b2_list_file_names`, {
        method: 'POST',
        headers: {
          Authorization: auth.authorizationToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!resp.ok) throw new Error(`B2 list failed: ${String(resp.status)}`);

      const data = (await resp.json()) as {
        files: Array<{
          fileName: string;
          contentLength: number;
          uploadTimestamp: number;
          contentSha1: string;
          contentType: string;
        }>;
        nextFileName: string | null;
      };

      const resolvedPrefix = this.resolveKey(prefix);
      const objects: ObjectInfo[] = data.files.map((f) => ({
        key: f.fileName.replace(resolvedPrefix, prefix),
        size: f.contentLength,
        lastModified: new Date(f.uploadTimestamp),
        etag: f.contentSha1,
        contentType: f.contentType,
      }));

      return ok({
        objects,
        isTruncated: data.nextFileName !== null,
        ...(data.nextFileName !== null ? { continuationToken: data.nextFileName } : {}),
      });
    } catch (cause) {
      return err(
        new StorageError(
          'PROVIDER_ERROR',
          `Failed to list B2 objects with prefix '${prefix}'`,
          cause,
        ),
      );
    }
  }

  async signedUrl(
    key: string,
    method: 'GET' | 'PUT',
    opts: { expiresIn: number; contentType?: string },
  ): Promise<Result<string, StorageError | NotSupportedError>> {
    if (method === 'PUT') {
      return err(new StorageNotSupportedError('B2 does not support pre-signed PUT URLs'));
    }

    try {
      const auth = await this.authorize();

      const resp = await fetch(`${auth.apiUrl}/b2api/v2/b2_get_download_authorization`, {
        method: 'POST',
        headers: {
          Authorization: auth.authorizationToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bucketId: this.config.bucketId,
          fileNamePrefix: this.resolveKey(key),
          validDurationInSeconds: opts.expiresIn,
        }),
      });

      if (!resp.ok) throw new Error(`B2 download auth failed: ${String(resp.status)}`);

      const data = (await resp.json()) as { authorizationToken: string };
      const url = `${auth.downloadUrl}/file/${this.config.bucketName}/${this.resolveKey(key)}?Authorization=${encodeURIComponent(data.authorizationToken)}`;
      return ok(url);
    } catch (cause) {
      return err(
        new StorageError(
          'PROVIDER_ERROR',
          `Failed to generate B2 download auth for '${key}'`,
          cause,
        ),
      );
    }
  }

  supports(feature: StorageFeature): boolean {
    // B2 does not support PUT signed URLs or native versioning tiers
    return feature === 'signed_urls';
  }
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer | string>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
