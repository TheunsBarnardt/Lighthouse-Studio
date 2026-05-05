'use client';

import { useState } from 'react';

import type { FileSummary } from '../types.js';

import { formatBytes } from '../types.js';

interface PropertiesDialogProps {
  file: FileSummary;
  onSaveTags: (fileId: string, tags: string[]) => Promise<void>;
  onSaveMetadata: (fileId: string, metadata: Record<string, string>) => Promise<void>;
  onClose: () => void;
}

export function PropertiesDialog({
  file,
  onSaveTags,
  onSaveMetadata: _onSaveMetadata,
  onClose,
}: PropertiesDialogProps) {
  const [tags, setTags] = useState(file.tags.join(', '));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const parsed = tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      await onSaveTags(file.id, parsed);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Properties: ${file.filename}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-base font-semibold">Properties</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-muted-foreground hover:bg-muted"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Filename</dt>
              <dd className="font-medium max-w-[60%] truncate">{file.filename}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Size</dt>
              <dd className="font-medium">{formatBytes(file.sizeBytes)}</dd>
            </div>
            {file.contentType && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Content type</dt>
                <dd className="font-medium max-w-[60%] truncate">{file.contentType}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Created</dt>
              <dd className="font-medium">{new Date(file.createdAt).toLocaleString()}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Modified</dt>
              <dd className="font-medium">{new Date(file.updatedAt).toLocaleString()}</dd>
            </div>
            {file.etag && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">ETag</dt>
                <dd className="font-mono text-xs text-muted-foreground max-w-[60%] truncate">
                  {file.etag}
                </dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted-foreground">PII</dt>
              <dd
                className={file.piiFlag ? 'font-medium text-destructive' : 'text-muted-foreground'}
              >
                {file.piiFlag ? 'Yes — contains personal data' : 'No'}
              </dd>
            </div>
          </dl>

          <div>
            <label htmlFor="props-tags" className="mb-1 block text-sm font-medium">
              Tags (comma-separated)
            </label>
            <input
              id="props-tags"
              type="text"
              value={tags}
              onChange={(e) => {
                setTags(e.target.value);
              }}
              placeholder="e.g. hr, confidential, 2024"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {error && (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
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
              void handleSave();
            }}
            disabled={saving}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
