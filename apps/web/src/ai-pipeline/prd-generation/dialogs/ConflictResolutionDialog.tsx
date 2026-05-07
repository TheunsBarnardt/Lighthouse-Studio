'use client';

import type { ConsistencyIssue, PrdSectionType } from '@platform/core';

import { AlertTriangle, Pencil, X } from 'lucide-react';

import { SECTION_DISPLAY_NAMES } from '../utils/sectionMeta.js';

interface ConflictResolutionDialogProps {
  open: boolean;
  issue: ConsistencyIssue;
  onResolve: (sectionToEdit: PrdSectionType) => void;
  onDismiss: () => void;
}

export function ConflictResolutionDialog({
  open,
  issue,
  onResolve,
  onDismiss,
}: ConflictResolutionDialogProps) {
  if (!open) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onDismiss();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="conflict-dialog-title"
      onKeyDown={handleKeyDown}
    >
      <div className="w-full max-w-lg rounded-xl border bg-card shadow-xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b px-5 py-4">
          <AlertTriangle
            className={`h-5 w-5 shrink-0 ${issue.severity === 'error' ? 'text-destructive' : 'text-amber-500'}`}
            aria-hidden="true"
          />
          <h2 id="conflict-dialog-title" className="flex-1 text-base font-semibold text-foreground">
            Consistency Issue
          </h2>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium uppercase ${
              issue.severity === 'error'
                ? 'bg-destructive/10 text-destructive'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
            }`}
          >
            {issue.severity}
          </span>
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
          {/* Description */}
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Description
            </h3>
            <p className="text-sm text-foreground">{issue.description}</p>
          </div>

          {/* Suggestion */}
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Suggestion
            </h3>
            <p className="text-sm text-muted-foreground">{issue.suggestion}</p>
          </div>

          {/* Affected sections */}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Affected Sections
            </h3>
            <div className="space-y-2">
              {issue.sections.map((sectionType) => (
                <button
                  key={sectionType}
                  type="button"
                  className="flex w-full items-center gap-3 rounded-lg border bg-background px-3 py-2.5 text-left hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                  onClick={() => {
                    onResolve(sectionType);
                  }}
                  aria-label={`Edit ${SECTION_DISPLAY_NAMES[sectionType]}`}
                >
                  <Pencil className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="flex-1 text-sm font-medium text-foreground">
                    Edit {SECTION_DISPLAY_NAMES[sectionType]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t px-5 py-3">
          <button
            type="button"
            className="rounded-lg border px-4 py-2 text-sm hover:bg-muted"
            onClick={onDismiss}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
