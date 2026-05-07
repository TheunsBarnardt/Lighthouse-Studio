'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';

interface RegenerateAllDialogProps {
  open: boolean;
  approvedCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RegenerateAllDialog({
  open,
  approvedCount,
  onConfirm,
  onCancel,
}: RegenerateAllDialogProps) {
  if (!open) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onCancel();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="regen-all-dialog-title"
      onKeyDown={handleKeyDown}
    >
      <div className="w-full max-w-md rounded-xl border bg-card shadow-xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b px-5 py-4">
          <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden="true" />
          <h2 id="regen-all-dialog-title" className="text-base font-semibold text-foreground">
            Regenerate All Sections
          </h2>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-foreground">
            This will regenerate all 10 PRD sections from scratch using the current intent brief.
          </p>

          {approvedCount > 0 && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 dark:bg-amber-900/20">
              <AlertTriangle
                className="mt-0.5 h-4 w-4 shrink-0 text-amber-500"
                aria-hidden="true"
              />
              <p className="text-sm text-amber-700 dark:text-amber-400">
                This will invalidate{' '}
                <strong>
                  {approvedCount} approved {approvedCount === 1 ? 'section' : 'sections'}
                </strong>
                . All approvals will be reset.
              </p>
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            This action cannot be undone. All current section content will be replaced.
          </p>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t px-5 py-3">
          <button
            type="button"
            className="rounded-lg border px-4 py-2 text-sm hover:bg-muted"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-white hover:bg-destructive/90"
            onClick={onConfirm}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Regenerate All
          </button>
        </div>
      </div>
    </div>
  );
}
