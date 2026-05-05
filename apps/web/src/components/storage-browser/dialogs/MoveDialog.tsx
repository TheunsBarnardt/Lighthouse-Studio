'use client';

import { useState } from 'react';

import type { BucketSummary } from '../types.js';

interface MoveDialogProps {
  fileCount: number;
  buckets: BucketSummary[];
  currentBucketId: string;
  currentFolderPath: string;
  onConfirm: (bucketId: string, folderPath: string) => Promise<void>;
  onClose: () => void;
}

export function MoveDialog({
  fileCount,
  buckets,
  currentBucketId,
  currentFolderPath,
  onConfirm,
  onClose,
}: MoveDialogProps) {
  const [bucketId, setBucketId] = useState(currentBucketId);
  const [folderPath, setFolderPath] = useState(currentFolderPath);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bucketId === currentBucketId && folderPath === currentFolderPath) {
      onClose();
      return;
    }
    setLoading(true);
    try {
      await onConfirm(bucketId, folderPath);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Move failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Move files"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-xl border bg-card shadow-xl">
        <div className="border-b px-5 py-4">
          <h2 className="text-base font-semibold">
            Move {fileCount} file{fileCount !== 1 ? 's' : ''}
          </h2>
        </div>
        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          className="p-5 space-y-4"
        >
          <div>
            <label htmlFor="move-bucket" className="mb-1 block text-sm font-medium">
              Destination bucket
            </label>
            <select
              id="move-bucket"
              value={bucketId}
              onChange={(e) => {
                setBucketId(e.target.value);
              }}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            >
              {buckets.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="move-folder" className="mb-1 block text-sm font-medium">
              Destination folder path
            </label>
            <input
              id="move-folder"
              type="text"
              value={folderPath}
              onChange={(e) => {
                setFolderPath(e.target.value);
              }}
              placeholder="Leave blank for root"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          {error && (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? 'Moving…' : 'Move'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
