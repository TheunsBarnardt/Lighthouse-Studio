'use client';

import type { CellProps } from '../types.js';

export function StringCell({
  value,
  isEditing,
  canEdit,
  isRedacted,
  onStartEdit,
  onChange,
  onCommit,
  onCancel,
  columnDef,
}: CellProps<string | null>) {
  if (isRedacted) {
    return (
      <span className="text-muted-foreground/40 select-none" aria-label="Redacted field">
        ••••••
      </span>
    );
  }

  if (isEditing) {
    const isLong = (columnDef.maxLength ?? 0) > 255 || columnDef.type === 'text';
    if (isLong) {
      return (
        <textarea
          className="h-20 w-full resize-none rounded border border-primary bg-background px-2 py-1 text-sm focus:outline-none"
          value={value ?? ''}
          maxLength={columnDef.maxLength}
          autoFocus
          onChange={(e) => {
            onChange(e.target.value || null);
          }}
          onBlur={() => void onCommit()}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onCancel();
            if (e.key === 'Tab') {
              e.preventDefault();
              void onCommit();
            }
          }}
        />
      );
    }
    return (
      <input
        type="text"
        className="w-full rounded border border-primary bg-background px-2 py-0.5 text-sm focus:outline-none"
        value={value ?? ''}
        maxLength={columnDef.maxLength}
        autoFocus
        onChange={(e) => {
          onChange(e.target.value || null);
        }}
        onBlur={() => void onCommit()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel();
          if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            void onCommit();
          }
        }}
      />
    );
  }

  return (
    <span
      className={`block truncate text-sm ${canEdit ? 'cursor-pointer hover:bg-muted/50' : ''}`}
      onClick={canEdit ? onStartEdit : undefined}
      onKeyDown={(e) => {
        if (canEdit && (e.key === 'Enter' || e.key === 'F2')) onStartEdit();
      }}
      tabIndex={canEdit ? 0 : -1}
      role={canEdit ? 'button' : undefined}
      aria-label={canEdit ? `Edit ${columnDef.name}` : undefined}
    >
      {value ?? <span className="text-muted-foreground/50">—</span>}
    </span>
  );
}
