import type { HttpTransport } from '../transport/index.js';

import { parseApiError } from '../errors/index.js';
import { getRuntime } from '../runtime/index.js';
import { uuidv4 } from '../util.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FileRecord {
  id: string;
  name: string;
  bucket: string;
  path: string;
  size: number;
  contentType: string;
  createdAt: string;
  updatedAt: string;
}

export interface FileLocation {
  bucket: string;
  path: string;
}

export interface UploadOptions {
  filename?: string;
  contentType?: string;
  resumable?: boolean;
  metadata?: Record<string, string>;
}

export interface ListFilesOptions {
  prefix?: string;
  limit?: number;
  cursor?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  nextCursor?: string;
}

export interface SignedUrlOptions {
  expiresIn?: string; // e.g. '1h', '30m'
}

export type ProgressEvent = { uploaded: number; total: number };
export type UploadEventType = 'progress' | 'completed' | 'error' | 'abort';

// ── UploadOperation ───────────────────────────────────────────────────────────

export class UploadOperation implements PromiseLike<FileRecord> {
  private readonly listeners = new Map<UploadEventType, Set<(payload: unknown) => void>>();
  private readonly promise: Promise<FileRecord>;
  private abortController: AbortController | null = null;
  /** Whether upload is currently paused (resumable uploads only). */
  private isPaused = false;

  constructor(executor: (op: UploadOperation) => Promise<FileRecord>) {
    this.promise = executor(this);
  }

  on(event: UploadEventType, handler: (event: unknown) => void): this {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(handler);
    return this;
  }

  emit(event: UploadEventType, payload: unknown): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const h of Array.from(set)) {
      try {
        h(payload);
      } catch {
        /* noop */
      }
    }
  }

  abort(): void {
    this.abortController?.abort();
  }

  pause(): void {
    this.isPaused = true;
  }
  resume(): void {
    this.isPaused = false;
  }
  setAbortController(c: AbortController): void {
    this.abortController = c;
  }

  async waitIfPaused(): Promise<void> {
    while (this.isPaused) {
      await new Promise<void>((resolve) => setTimeout(resolve, 200));
    }
  }

  then<TResult1 = FileRecord, TResult2 = never>(
    onfulfilled?: ((value: FileRecord) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.promise.then(onfulfilled, onrejected);
  }
}

// ── StorageClient ─────────────────────────────────────────────────────────────

const SIMPLE_UPLOAD_THRESHOLD = 5 * 1024 * 1024; // 5 MB

export class StorageClient {
  constructor(
    private readonly transport: HttpTransport,
    private readonly bucket: string,
    private readonly workspace: string,
  ) {}

  upload(
    file: File | Blob | ArrayBuffer | ReadableStream,
    opts: UploadOptions = {},
  ): UploadOperation {
    const size = file instanceof Blob ? file.size : undefined;
    const useResumable =
      opts.resumable === true || (size !== undefined && size > SIMPLE_UPLOAD_THRESHOLD);

    return new UploadOperation(async (op) => {
      if (useResumable) {
        return this.resumableUpload(file as Blob, opts, op);
      }
      return this.simpleUpload(file as Blob, opts, op);
    });
  }

  private async simpleUpload(
    file: Blob,
    opts: UploadOptions,
    op: UploadOperation,
  ): Promise<FileRecord> {
    const { fetch: fetchImpl } = getRuntime();
    const idempotencyKey = uuidv4();
    const name = opts.filename ?? (file instanceof File ? file.name : 'upload');
    const url = `${this.transport.getBaseUrl()}/api/v1/storage/${this.workspace}/${this.bucket}/upload`;

    // Send as multipart so the server receives the actual file bytes
    const form = new FormData();
    form.append('file', file, name);
    if (opts.contentType) form.append('contentType', opts.contentType);
    if (opts.metadata) form.append('metadata', JSON.stringify(opts.metadata));

    const headers = this.transport.getAuthHeaders(idempotencyKey);
    const response = await fetchImpl(url, { method: 'POST', headers, body: form });

    if (!response.ok) {
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      throw parseApiError(body, response.status);
    }

    const result = (await response.json()) as FileRecord;
    op.emit('progress', { uploaded: file.size, total: file.size } satisfies ProgressEvent);
    op.emit('completed', result);
    return result;
  }

  private async resumableUpload(
    file: Blob,
    opts: UploadOptions,
    op: UploadOperation,
  ): Promise<FileRecord> {
    const name = opts.filename ?? (file instanceof File ? file.name : 'upload');

    // Step 1: Create tus upload session
    const session = await this.transport.request<{ uploadUrl: string; uploadId: string }>({
      method: 'POST',
      path: `/api/v1/storage/${this.workspace}/${this.bucket}/upload/resumable`,
      body: {
        filename: name,
        contentType: opts.contentType ?? file.type,
        size: file.size,
        metadata: opts.metadata,
      },
    });

    // Step 2: Upload chunks
    const chunkSize = 5 * 1024 * 1024; // 5 MB chunks
    let offset = 0;
    const controller = new AbortController();
    op.setAbortController(controller);

    while (offset < file.size) {
      await op.waitIfPaused();
      const chunk = file.slice(offset, offset + chunkSize);
      const chunkBuffer = await chunk.arrayBuffer();

      await fetch(session.uploadUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/offset+octet-stream',
          'Upload-Offset': String(offset),
          'Tus-Resumable': '1.0.0',
        },
        body: chunkBuffer,
        signal: controller.signal,
      });

      offset = Math.min(offset + chunkSize, file.size);
      op.emit('progress', { uploaded: offset, total: file.size } satisfies ProgressEvent);
    }

    // Step 3: Finalize
    const record = await this.transport.request<FileRecord>({
      method: 'POST',
      path: `/api/v1/storage/${this.workspace}/${this.bucket}/upload/resumable/${session.uploadId}/finalize`,
    });

    op.emit('completed', record);
    return record;
  }

  async download(fileIdOrPath: string): Promise<Blob> {
    const url = `/api/v1/storage/${this.workspace}/${this.bucket}/download/${fileIdOrPath}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Download failed: ${String(response.status)}`);
    return response.blob();
  }

  async getSignedUrl(fileIdOrPath: string, opts?: SignedUrlOptions): Promise<string> {
    const result = await this.transport.request<{ url: string }>({
      method: 'POST',
      path: `/api/v1/storage/${this.workspace}/${this.bucket}/signed-url`,
      body: { fileId: fileIdOrPath, expiresIn: opts?.expiresIn ?? '1h' },
    });
    return result.url;
  }

  async list(opts?: ListFilesOptions): Promise<PaginatedResult<FileRecord>> {
    return this.transport.request({
      path: `/api/v1/storage/${this.workspace}/${this.bucket}/files`,
      params: {
        prefix: opts?.prefix,
        limit: opts?.limit,
        cursor: opts?.cursor,
      },
    });
  }

  async rename(fileId: string, newName: string): Promise<FileRecord> {
    return this.transport.request({
      method: 'PATCH',
      path: `/api/v1/storage/${this.workspace}/${this.bucket}/files/${fileId}/rename`,
      body: { newName },
    });
  }

  async move(fileId: string, destination: FileLocation): Promise<FileRecord> {
    return this.transport.request({
      method: 'POST',
      path: `/api/v1/storage/${this.workspace}/${this.bucket}/files/${fileId}/move`,
      body: { destination },
    });
  }

  async copy(fileId: string, destination: FileLocation): Promise<FileRecord> {
    return this.transport.request({
      method: 'POST',
      path: `/api/v1/storage/${this.workspace}/${this.bucket}/files/${fileId}/copy`,
      body: { destination },
    });
  }

  async delete(fileId: string): Promise<void> {
    await this.transport.request({
      method: 'DELETE',
      path: `/api/v1/storage/${this.workspace}/${this.bucket}/files/${fileId}`,
    });
  }

  async createFolder(path: string): Promise<void> {
    await this.transport.request({
      method: 'POST',
      path: `/api/v1/storage/${this.workspace}/${this.bucket}/folders`,
      body: { path },
    });
  }

  async deleteFolder(path: string): Promise<void> {
    await this.transport.request({
      method: 'DELETE',
      path: `/api/v1/storage/${this.workspace}/${this.bucket}/folders`,
      body: { path },
    });
  }
}
