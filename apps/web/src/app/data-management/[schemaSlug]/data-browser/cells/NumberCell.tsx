'use client';

import type { CellProps } from '../types.js';

export function NumberCell({
  value,
  isEditing,
  canEdit,
  isRedacted,
  onStartEdit,
  onChange,
  onCommit,
  onCancel,
  columnDef,
}: CellProps<number | null>) {
  if (isRedacted) {
    return <span className="text-muted-foreground/40 select-none">••••••</span>;
  }

  if (isEditing) {
    return (
      <input
        type="number"
        className="w-full rounded border border-primary bg-background px-2 py-0.5 text-sm focus:outline-none"
        value={value ?? ''}
        autoFocus
        onChange={(e) => {
          const v = e.target.value === '' ? null : Number(e.target.value);
          onChange(v);
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

  const display =
    value === null
      ? null
      : columnDef.type === 'decimal'
        ? value.toFixed(columnDef.scale ?? 2)
        : String(value);

  return (
    <span
      className={`block truncate text-right text-sm font-mono ${canEdit ? 'cursor-pointer hover:bg-muted/50' : ''}`}
      onClick={canEdit ? onStartEdit : undefined}
      onKeyDown={(e) => {
        if (canEdit && (e.key === 'Enter' || e.key === 'F2')) onStartEdit();
      }}
      tabIndex={canEdit ? 0 : -1}
      role={canEdit ? 'button' : undefined}
    >
      {display ?? <span className="text-muted-foreground/50">—</span>}
    </span>
  );
}
