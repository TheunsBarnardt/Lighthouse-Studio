'use client';

import { useState } from 'react';

import type { CellProps } from '../types.js';

export function ArrayCell({
  value,
  isEditing,
  canEdit,
  isRedacted,
  onStartEdit,
  onChange,
  onCommit,
  onCancel,
}: CellProps<unknown[] | null>) {
  const [draft, setDraft] = useState('');

  if (isRedacted) {
    return <span className="text-muted-foreground/40 select-none">••••••</span>;
  }

  const items = Array.isArray(value) ? value : [];

  if (isEditing) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap gap-1">
          {items.map((item, idx) => (
            <span
              key={idx}
              className="flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-xs"
            >
              {String(item)}
              <button
                type="button"
                className="ml-0.5 text-muted-foreground hover:text-destructive"
                onClick={() => {
                  const next = items.filter((_, i) => i !== idx);
                  onChange(next.length > 0 ? next : null);
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-1">
          <input
            type="text"
            className="flex-1 rounded border border-primary bg-background px-2 py-0.5 text-xs focus:outline-none"
            placeholder="Add value and press Enter"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && draft.trim()) {
                e.preventDefault();
                onChange([...items, draft.trim()]);
                setDraft('');
              }
              if (e.key === 'Escape') {
                setDraft('');
                onCancel();
              }
              if (e.key === 'Tab') {
                e.preventDefault();
                void onCommit();
              }
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <span
      className={`flex flex-wrap gap-1 ${canEdit ? 'cursor-pointer hover:bg-muted/50' : ''}`}
      onClick={canEdit ? onStartEdit : undefined}
      onKeyDown={(e) => {
        if (canEdit && (e.key === 'Enter' || e.key === 'F2')) onStartEdit();
      }}
      tabIndex={canEdit ? 0 : -1}
      role={canEdit ? 'button' : undefined}
    >
      {items.length === 0 ? (
        <span className="text-muted-foreground/50 text-sm">—</span>
      ) : (
        items.slice(0, 3).map((item, idx) => (
          <span key={idx} className="rounded bg-muted px-1.5 py-0.5 text-xs">
            {String(item)}
          </span>
        ))
      )}
      {items.length > 3 && (
        <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
          +{items.length - 3}
        </span>
      )}
    </span>
  );
}
