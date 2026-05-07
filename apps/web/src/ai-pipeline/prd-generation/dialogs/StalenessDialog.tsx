'use client';

import type { StalenessIndicator } from '@platform/core';

import { AlertTriangle, RefreshCw, X } from 'lucide-react';

import { SECTION_DISPLAY_NAMES } from '../utils/sectionMeta.js';

interface StalenessDialogProps {
  open: boolean;
  indicators: StalenessIndicator[];
  onRegenerateAffected: () => void;
  onDismiss: () => void;
}

export function StalenessDialog({
  open,
  indicators,
  onRegenerateAffected,
  onDismiss,
}: StalenessDialogProps) {
  if (!open) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onDismiss();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="staleness-dialog-title"
      onKeyDown={handleKeyDown}
    >
      <div className="w-full max-w-lg rounded-xl border bg-card shadow-xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b px-5 py-4">
          <AlertTriangle className="h-5 w-5 text-yellow-500" aria-hidden="true" />
          <h2
            id="staleness-dialog-title"
            className="flex-1 text-base font-semibold text-foreground"
          >
            Stale Sections Detected
          </h2>
          <button
            type="button"
            className="rounded p-1 hover:bg-muted"
            onClick={onDismiss}
            aria-label="Dismiss"
          >
            <X className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            The intent brief has been updated. The following sections may no longer reflect the
            current intent:
          </p>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {indicators.map((indicator) => (
              <div
                key={indicator.sectionId}
                className="rounded-lg border bg-yellow-50/50 p-3 dark:bg-yellow-900/10 space-y-1.5"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {SECTION_DISPLAY_NAMES[indicator.sectionType]}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{indicator.reason}</p>
                {indicator.changedIntentFields.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {indicator.changedIntentFields.map((field) => (
                      <span
                        key={field}
                        className="rounded bg-yellow-100 px-1.5 py-0.5 font-mono text-xs text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                      >
                        {field}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t px-5 py-3">
          <button
            type="button"
            className="rounded-lg border px-4 py-2 text-sm hover:bg-muted"
            onClick={onDismiss}
          >
            Dismiss
          </button>
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            onClick={onRegenerateAffected}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Regenerate Affected Sections
          </button>
        </div>
      </div>
    </div>
  );
}
