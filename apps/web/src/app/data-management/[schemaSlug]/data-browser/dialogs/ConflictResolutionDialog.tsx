'use client';

import type { ConflictInfo } from '../types.js';

interface ConflictResolutionDialogProps {
  conflict: ConflictInfo;
  onTakeServer: () => void;
  onTakeLocal: () => void;
  onDiscard: () => void;
}

export function ConflictResolutionDialog({
  conflict,
  onTakeServer,
  onTakeLocal,
  onDiscard,
}: ConflictResolutionDialogProps) {
  const formatValue = (v: unknown) => {
    if (v === null || v === undefined) return '(empty)';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v as string | number | boolean);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Conflict Resolution"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    >
      <div className="w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-xl">
        <h2 className="mb-1 text-lg font-semibold">Edit Conflict</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {conflict.changedBy
            ? `This row was changed by ${conflict.changedBy}${conflict.changedAt ? ` ${conflict.changedAt.toLocaleTimeString()}` : ''}.`
            : 'This row was changed by another user while you were editing.'}{' '}
          Choose how to resolve:
        </p>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded border border-border bg-muted/30 p-3">
            <div className="mb-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Their value
            </div>
            <div className="font-mono text-sm break-all">{formatValue(conflict.serverValue)}</div>
          </div>
          <div className="rounded border border-primary/50 bg-primary/5 p-3">
            <div className="mb-1 text-xs font-medium text-primary uppercase tracking-wide">
              Your value
            </div>
            <div className="font-mono text-sm break-all">{formatValue(conflict.localValue)}</div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            className="rounded bg-muted px-4 py-2 text-sm hover:bg-muted/80"
            onClick={onTakeServer}
          >
            Take their value (discard my edit)
          </button>
          <button
            type="button"
            className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
            onClick={onTakeLocal}
          >
            Keep my value (overwrite theirs)
          </button>
          <button
            type="button"
            className="text-sm text-muted-foreground hover:text-foreground"
            onClick={onDiscard}
          >
            Cancel (review manually)
          </button>
        </div>
      </div>
    </div>
  );
}
