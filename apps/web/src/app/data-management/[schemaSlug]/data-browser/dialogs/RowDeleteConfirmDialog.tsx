'use client';

import { useState } from 'react';

interface RowDeleteConfirmDialogProps {
  rowId: string;
  hardDelete?: boolean;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

export function RowDeleteConfirmDialog({
  hardDelete = false,
  onConfirm,
  onClose,
}: RowDeleteConfirmDialogProps) {
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = async () => {
    setConfirming(true);
    await onConfirm();
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Delete Row"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    >
      <div className="w-full max-w-sm rounded-lg border border-border bg-background p-6 shadow-xl">
        <h2 className="mb-2 text-lg font-semibold">
          {hardDelete ? 'Permanently Delete Row' : 'Archive Row'}
        </h2>
        <p className="mb-5 text-sm text-muted-foreground">
          {hardDelete
            ? 'This row will be permanently deleted. This cannot be undone.'
            : 'This row will be archived and can be restored for 90 days.'}
        </p>
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
            disabled={confirming}
            onClick={() => void handleConfirm()}
            className="rounded bg-destructive px-4 py-2 text-sm text-destructive-foreground hover:bg-destructive/90 disabled:opacity-60"
          >
            {confirming ? 'Deleting…' : hardDelete ? 'Delete Permanently' : 'Archive'}
          </button>
        </div>
      </div>
    </div>
  );
}
