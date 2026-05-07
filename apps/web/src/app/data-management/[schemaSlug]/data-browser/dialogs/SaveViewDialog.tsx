'use client';

import { useState } from 'react';

interface SaveViewDialogProps {
  existingName?: string | undefined;
  onSave: (name: string, description: string, shared: boolean) => Promise<void>;
  onClose: () => void;
}

export function SaveViewDialog({ existingName, onSave, onClose }: SaveViewDialogProps) {
  const [name, setName] = useState(existingName ?? '');
  const [description, setDescription] = useState('');
  const [shared, setShared] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(name.trim(), description.trim(), shared);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save view');
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Save View"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    >
      <div className="w-full max-w-sm rounded-lg border border-border bg-background p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{existingName ? 'Update View' : 'Save View'}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-muted-foreground hover:text-foreground"
          >
            ×
          </button>
        </div>

        <div className="mb-4 space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="view-name">
              Name
            </label>
            <input
              id="view-name"
              type="text"
              maxLength={255}
              className="w-full rounded border border-border bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSave();
              }}
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="view-description">
              Description (optional)
            </label>
            <textarea
              id="view-description"
              className="w-full rounded border border-border bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
              }}
              rows={2}
            />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={shared}
              onChange={(e) => {
                setShared(e.target.checked);
              }}
            />
            Share with workspace members
          </label>
        </div>

        {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-4 py-2 text-sm hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
