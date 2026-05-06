import type { FileRecord, StorageClient, UploadOptions, ProgressEvent } from '@platform/sdk';

import { ref, type Ref } from 'vue';

export interface UploadComposable {
  isUploading: Ref<boolean>;
  progress: Ref<number>;
  error: Ref<Error | null>;
  file: Ref<FileRecord | null>;
  upload(client: StorageClient, file: File | Blob, opts?: UploadOptions): Promise<FileRecord>;
  reset(): void;
}

export function useUpload(): UploadComposable {
  const isUploading = ref(false);
  const progress = ref(0);
  const error = ref<Error | null>(null);
  const file = ref<FileRecord | null>(null);

  async function upload(
    client: StorageClient,
    blob: File | Blob,
    opts?: UploadOptions,
  ): Promise<FileRecord> {
    isUploading.value = true;
    progress.value = 0;
    error.value = null;
    file.value = null;

    const op = client.upload(blob, opts ?? {});
    op.on('progress', (e: unknown) => {
      const evt = e as ProgressEvent;
      progress.value = evt.total > 0 ? Math.round((evt.uploaded / evt.total) * 100) : 0;
    });

    try {
      const record = await op;
      file.value = record;
      progress.value = 100;
      return record;
    } catch (err) {
      error.value = err instanceof Error ? err : new Error('Upload failed');
      throw error.value;
    } finally {
      isUploading.value = false;
    }
  }

  function reset() {
    isUploading.value = false;
    progress.value = 0;
    error.value = null;
    file.value = null;
  }

  return { isUploading, progress, error, file, upload, reset };
}
