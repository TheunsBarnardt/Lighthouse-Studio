'use client';

import { useState } from 'react';

interface SaveQueryDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (opts: { name: string; description: string; folderPath: string; shared: boolean; sharedCanRun: boolean }) => void;
}

export function SaveQueryDialog({ open, onClose, onSave }: SaveQueryDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [folderPath, setFolderPath] = useState('');
  const [shared, setShared] = useState(false);
  const [sharedCanRun, setSharedCanRun] = useState(false);

  if (!open) return null;

  function handleSave() {
    if (!name.trim()) return;
    onSave({ name: name.trim(), description, folderPath, shared, sharedCanRun });
    setName('');
    setDescription('');
    setFolderPath('');
    setShared(false);
    setSharedCanRun(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold">Save Query</h2>

        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); }}
              placeholder="My query"
              className="w-full rounded border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Description</label>
            <textarea
              value={description}
              onChange={(e) => { setDescription(e.target.value); }}
              rows={2}
              className="w-full rounded border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Folder</label>
            <input
              type="text"
              value={folderPath}
              onChange={(e) => { setFolderPath(e.target.value); }}
              placeholder="reports/monthly"
              className="w-full rounded border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="shared-toggle"
              type="checkbox"
              checked={shared}
              onChange={(e) => { setShared(e.target.checked); }}
              className="h-4 w-4 rounded border"
            />
            <label htmlFor="shared-toggle" className="text-sm">Share with workspace members</label>
          </div>

          {shared && (
            <div className="flex items-center gap-2 pl-6">
              <input
                id="shared-can-run"
                type="checkbox"
                checked={sharedCanRun}
                onChange={(e) => { setSharedCanRun(e.target.checked); }}
                className="h-4 w-4 rounded border"
              />
              <label htmlFor="shared-can-run" className="text-sm">Allow others to run this query</label>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border px-4 py-1.5 text-sm hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!name.trim()}
            className="rounded bg-primary px-4 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
