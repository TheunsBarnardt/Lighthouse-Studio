'use client';

import { useState } from 'react';

import type { CellProps } from '../types.js';

export function JsonCell({
  value,
  isEditing,
  canEdit,
  isRedacted,
  onStartEdit,
  onChange,
  onCommit,
  onCancel,
}: CellProps) {
  const [parseError, setParseError] = useState<string | null>(null);
  const [draft, setDraft] = useState(() =>
    value !== null && value !== undefined ? JSON.stringify(value, null, 2) : '',
  );

  if (isRedacted) {
    return <span className="text-muted-foreground/40 select-none">••••••</span>;
  }

  if (isEditing) {
    return (
      <div className="flex flex-col gap-1">
        <textarea
          className={`h-32 w-full resize-y rounded border bg-background px-2 py-1 font-mono text-xs focus:outline-none ${
            parseError ? 'border-destructive' : 'border-primary'
          }`}
          value={draft}
          autoFocus
          onChange={(e) => {
            setDraft(e.target.value);
            try {
              const parsed: unknown = e.target.value
                ? (JSON.parse(e.target.value) as unknown)
                : null;
              onChange(parsed);
              setParseError(null);
            } catch {
              setParseError('Invalid JSON');
            }
          }}
          onBlur={() => {
            if (!parseError) void onCommit();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setParseError(null);
              onCancel();
            }
          }}
        />
        {parseError && <span className="text-xs text-destructive">{parseError}</span>}
      </div>
    );
  }

  const preview = value !== null && value !== undefined ? JSON.stringify(value) : null;

  return (
    <span
      className={`block truncate font-mono text-xs ${canEdit ? 'cursor-pointer hover:bg-muted/50' : ''}`}
      title={preview ?? undefined}
      onClick={canEdit ? onStartEdit : undefined}
      onKeyDown={(e) => {
        if (canEdit && (e.key === 'Enter' || e.key === 'F2')) onStartEdit();
      }}
      tabIndex={canEdit ? 0 : -1}
      role={canEdit ? 'button' : undefined}
    >
      {preview ?? <span className="text-muted-foreground/50 font-sans">—</span>}
    </span>
  );
}
