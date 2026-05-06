'use client';

import { useState } from 'react';

import type { BulkAction } from '../types.js';

interface BulkActionDialogProps {
  action: BulkAction;
  count: number;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

const ACTION_LABELS: Record<
  BulkAction,
  { title: string; description: string; confirm: string; variant: 'danger' | 'normal' }
> = {
  delete: {
    title: 'Archive Selected Rows',
    description: 'These rows will be soft-deleted and can be restored for 90 days.',
    confirm: 'Archive',
    variant: 'danger',
  },
  archive: {
    title: 'Archive Selected Rows',
    description: 'These rows will be soft-deleted and can be restored for 90 days.',
    confirm: 'Archive',
    variant: 'danger',
  },
  restore: {
    title: 'Restore Selected Rows',
    description: 'These rows will be restored to the active state.',
    confirm: 'Restore',
    variant: 'normal',
  },
  hard_delete: {
    title: 'Permanently Delete Selected Rows',
    description: 'These rows will be permanently deleted. This cannot be undone.',
    confirm: 'Delete Permanently',
    variant: 'danger',
  },
};

export function BulkActionDialog({ action, count, onConfirm, onClose }: BulkActionDialogProps) {
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const info = ACTION_LABELS[action];
  const requiresTypedConfirm = action === 'hard_delete';

  const canConfirm = !requiresTypedConfirm || confirmText === 'delete';

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setConfirming(true);
    await onConfirm();
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={info.title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    >
      <div className="w-full max-w-sm rounded-lg border border-border bg-background p-6 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{info.title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-muted-foreground hover:text-foreground"
          >
            ×
          </button>
        </div>

        <p className="mb-3 text-sm text-muted-foreground">
          <strong>
            {count.toLocaleString()} row{count !== 1 ? 's' : ''}
          </strong>{' '}
          selected. {info.description}
        </p>

        {requiresTypedConfirm && (
          <div className="mb-4">
            <p className="mb-1 text-sm">
              Type <strong>delete</strong> to confirm:
            </p>
            <input
              type="text"
              className="w-full rounded border border-border bg-background px-3 py-1.5 text-sm focus:border-destructive focus:outline-none"
              value={confirmText}
              onChange={(e) => {
                setConfirmText(e.target.value);
              }}
              autoFocus
            />
          </div>
        )}

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
            disabled={confirming || !canConfirm}
            onClick={() => void handleConfirm()}
            className={`rounded px-4 py-2 text-sm disabled:opacity-60 ${
              info.variant === 'danger'
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
          >
            {confirming
              ? 'Processing…'
              : `${info.confirm} ${count.toLocaleString()} row${count !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
