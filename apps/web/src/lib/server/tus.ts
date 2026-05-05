import type { Readable } from 'node:stream';

import { FileStore } from '@tus/file-store';
import { Server } from '@tus/server';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { requestContext } from './api-helpers.js';
import { getStorageService } from './storage-service.js';

/** Error thrown inside tus hooks to send a structured HTTP error to the client. */
class TusHookError extends Error {
  readonly status_code: number;
  readonly body: string;
  constructor(statusCode: number, body: string) {
    super(body);
    this.status_code = statusCode;
    this.body = body;
  }
}

const TUS_UPLOAD_DIR = join(tmpdir(), 'platform-tus-uploads');

// Single shared FileStore — survives server restarts only within the process.
// In a multi-replica deployment, replace with a shared store (e.g. Redis-backed).
export const tusFileStore = new FileStore({
  directory: TUS_UPLOAD_DIR,
  expirationPeriodInMilliseconds: 24 * 60 * 60 * 1000, // 24 h
});

// Context stored at upload creation time, needed for finalization.
interface UploadCtx {
  workspaceId: string;
  bucketId: string;
  folderPath: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  /** Raw Authorization header value, forwarded to StorageService on finish. */
  authHeader?: string;
}

const pendingUploads = new Map<string, UploadCtx>();

/**
 * Build a tus Server for a specific workspace.
 * The server is lightweight to construct; the FileStore is shared.
 */
export function createTusServerForWorkspace(workspaceId: string): Server {
  return new Server({
    path: `/api/v1/data/${workspaceId}/storage/uploads`,
    datastore: tusFileStore,
    // 5 GiB hard cap (bytes)
    maxSize: 5 * 1024 * 1024 * 1024,
    relativeLocation: true,

    generateUrl(_req, { id }) {
      return `/api/v1/data/${workspaceId}/storage/uploads/${id}`;
    },

    getFileIdFromRequest(req) {
      const url = new URL(req.url);
      const match = url.pathname.match(/\/storage\/uploads\/([^/?]+)/);
      return match?.[1];
    },

    async onUploadCreate(req, upload) {
      const meta = upload.metadata ?? {};
      const bucketId = meta['bucket-id'];
      const filename = meta['filename'] ? decodeURIComponent(meta['filename']) : null;
      const folderPath = meta['folder-path'] ? decodeURIComponent(meta['folder-path']) : '';
      const contentType = meta['content-type'] ?? 'application/octet-stream';
      const sizeBytes = upload.size ?? 0;

      if (!bucketId) {
        throw new TusHookError(
          400,
          JSON.stringify({ code: 'VALIDATION', message: 'Missing required metadata: bucket-id' }),
        );
      }
      if (!filename) {
        throw new TusHookError(
          400,
          JSON.stringify({ code: 'VALIDATION', message: 'Missing required metadata: filename' }),
        );
      }
      if (sizeBytes === 0 && !upload.sizeIsDeferred) {
        throw new TusHookError(
          400,
          JSON.stringify({ code: 'VALIDATION', message: 'Upload-Length must be > 0 or deferred' }),
        );
      }

      // Validate quota before accepting — quick preflight
      const authHeader = req.headers.get('authorization') ?? undefined;
      const syntheticReq = {
        headers: { get: (k: string) => (k === 'authorization' ? (authHeader ?? null) : null) },
      } as unknown as Request;
      const ctx = requestContext(workspaceId, syntheticReq);
      const quotaResult = await getStorageService().getQuota(ctx);
      if (quotaResult.isOk()) {
        const quota = quotaResult.value;
        if (quota.usedBytes + sizeBytes > quota.quotaBytes) {
          throw new TusHookError(
            413,
            JSON.stringify({
              code: 'STORAGE_QUOTA_EXCEEDED',
              message: 'Workspace storage quota exceeded',
            }),
          );
        }
      }

      pendingUploads.set(upload.id, {
        workspaceId,
        bucketId,
        folderPath,
        filename,
        contentType,
        sizeBytes,
        ...(authHeader !== undefined ? { authHeader } : {}),
      });

      return {};
    },

    async onUploadFinish(_req, upload) {
      const ctx_meta = pendingUploads.get(upload.id);
      if (!ctx_meta) {
        return {
          status_code: 500,
          body: JSON.stringify({
            code: 'INTERNAL',
            message: 'Upload context not found; server may have restarted',
          }),
        };
      }

      const {
        workspaceId: wid,
        bucketId,
        folderPath,
        filename,
        contentType,
        sizeBytes,
        authHeader,
      } = ctx_meta;

      // Build a synthetic request to extract RequestContext from the stored auth header
      const syntheticReq = {
        headers: { get: (k: string) => (k === 'authorization' ? (authHeader ?? null) : null) },
      } as unknown as Request;
      const serviceCtx = requestContext(wid, syntheticReq);

      // Read the assembled file as a stream and pass to StorageService
      const fileStream = tusFileStore.read(upload.id);

      const result = await getStorageService().uploadFile(
        serviceCtx,
        {
          bucketId,
          filename,
          contentType,
          sizeBytes,
          ...(folderPath ? { folderPath } : {}),
        },
        fileStream as unknown as Readable,
      );

      pendingUploads.delete(upload.id);

      if (result.isErr()) {
        // Clean up the temp file on failure
        await tusFileStore.remove(upload.id).catch(() => {});
        const err = result.error;
        const statusCode = 'statusCode' in err ? err.statusCode : 500;
        return {
          status_code: statusCode,
          body: JSON.stringify({
            code: 'code' in err ? err.code : 'INTERNAL',
            message: err.message,
          }),
        };
      }

      // Clean up temp file after successful transfer to object storage
      await tusFileStore.remove(upload.id).catch(() => {});

      return {
        headers: {
          'x-file-id': result.value.id,
          'x-storage-key': result.value.storageKey,
        },
      };
    },
  });
}
