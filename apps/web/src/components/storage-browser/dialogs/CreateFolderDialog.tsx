'use client';

import { useState } from 'react';

interface CreateFolderDialogProps {
  currentPath: string;
  onConfirm: (folderName: string) => Promise<void>;
  onClose: () => void;
}

export function CreateFolderDialog({ currentPath, onConfirm, onClose }: CreateFolderDialogProps) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const validate = (v: string) => {
    if (!v.trim()) return 'Folder name is required';
    if (/[/\\]/.test(v)) return 'Folder name cannot contain / or \\';
    if (v.length > 255) return 'Folder name is too long';
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate(name);
    if (err) {
      setError(err);
      return;
    }
    setLoading(true);
    try {
      const fullPath = currentPath ? `${currentPath}/${name.trim()}` : name.trim();
      await onConfirm(fullPath);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create folder');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Create folder"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-xl border bg-card shadow-xl">
        <div className="border-b px-5 py-4">
          <h2 className="text-base font-semibold">Create Folder</h2>
        </div>
        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          className="p-5 space-y-4"
        >
          <div>
            <label htmlFor="folder-name" className="mb-1 block text-sm font-medium">
              Folder name
            </label>
            <input
              id="folder-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              placeholder="e.g. documents"
              autoFocus
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
            {error && (
              <p className="mt-1 text-xs text-destructive" role="alert">
                {error}
              </p>
            )}
          </div>
          {currentPath && (
            <p className="text-xs text-muted-foreground">
              Will be created inside: <span className="font-mono">{currentPath}</span>
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
              {loading ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
