'use client';

import { useCallback, useRef, useState } from 'react';

import { formatBytes } from '../types.js';

interface UploadDialogProps {
  bucketId: string;
  folderPath: string;
  onUpload: (files: File[]) => Promise<void>;
  onClose: () => void;
}

interface UploadItem {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
}

export function UploadDialog({
  bucketId: _bucketId,
  folderPath,
  onUpload,
  onClose,
}: UploadDialogProps) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    setItems((prev) => [
      ...prev,
      ...fileArray.map((f) => ({ file: f, progress: 0, status: 'pending' as const })),
    ]);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const handleUpload = async () => {
    if (items.length === 0 || uploading) return;
    setUploading(true);

    try {
      await onUpload(items.map((i) => i.file));
      setItems((prev) => prev.map((i) => ({ ...i, status: 'done', progress: 100 })));
    } catch (err) {
      setItems((prev) =>
        prev.map((i) =>
          i.status === 'uploading'
            ? { ...i, status: 'error', error: err instanceof Error ? err.message : 'Upload failed' }
            : i,
        ),
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Upload files"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-xl border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-base font-semibold">Upload Files</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-muted-foreground hover:bg-muted"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => {
              setIsDragging(false);
            }}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
            aria-label="Drop files or click to browse"
            className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed py-10 transition-colors ${
              isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            }`}
          >
            <svg
              className="mb-2 h-10 w-10 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="text-sm font-medium">Drag & drop files here</p>
            <p className="text-xs text-muted-foreground">or click to browse</p>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
              }}
            />
          </div>

          {/* File list */}
          {items.length > 0 && (
            <ul className="max-h-48 overflow-y-auto space-y-1" aria-label="Files to upload">
              {items.map((item, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{item.file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatBytes(item.file.size)}</p>
                  </div>
                  <StatusBadge status={item.status} />
                </li>
              ))}
            </ul>
          )}

          <p className="text-xs text-muted-foreground">
            Uploading to: <span className="font-mono">{folderPath || '/ (root)'}</span>
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              void handleUpload();
            }}
            disabled={items.length === 0 || uploading}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {uploading
              ? 'Uploading…'
              : `Upload ${items.length > 0 ? `(${String(items.length)})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: UploadItem['status'] }) {
  const map = {
    pending: <span className="text-xs text-muted-foreground">Pending</span>,
    uploading: <span className="text-xs text-primary">Uploading…</span>,
    done: <span className="text-xs text-green-600 dark:text-green-400">Done</span>,
    error: <span className="text-xs text-destructive">Error</span>,
  };
  return map[status];
}
