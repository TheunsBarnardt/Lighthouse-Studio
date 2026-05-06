import type { FileRecord, StorageClient, UploadOptions, ProgressEvent } from '@platform/sdk';

import { useState, useCallback } from 'react';

export interface UploadState {
  isUploading: boolean;
  progress: number; // 0–100
  error: Error | null;
  file: FileRecord | null;
}

export interface UploadActions {
  upload(
    storageClient: StorageClient,
    file: File | Blob,
    opts?: UploadOptions,
  ): Promise<FileRecord>;
  reset(): void;
}

export function useUpload(): UploadState & UploadActions {
  const [state, setState] = useState<UploadState>({
    isUploading: false,
    progress: 0,
    error: null,
    file: null,
  });

  const upload = useCallback(
    async (
      storageClient: StorageClient,
      file: File | Blob,
      opts?: UploadOptions,
    ): Promise<FileRecord> => {
      setState({ isUploading: true, progress: 0, error: null, file: null });

      const op = storageClient.upload(file, opts ?? {});

      op.on('progress', (e: unknown) => {
        const evt = e as ProgressEvent;
        const pct = evt.total > 0 ? Math.round((evt.uploaded / evt.total) * 100) : 0;
        setState((s) => ({ ...s, progress: pct }));
      });

      try {
        const record = await op;
        setState({ isUploading: false, progress: 100, error: null, file: record });
        return record;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Upload failed');
        setState((s) => ({ ...s, isUploading: false, error }));
        throw error;
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setState({ isUploading: false, progress: 0, error: null, file: null });
  }, []);

  return { ...state, upload, reset };
}
