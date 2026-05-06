'use client';

import type { CellProps } from '../types.js';

function toInputValue(value: string | Date | null, includeTime: boolean): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return '';
  if (includeTime) {
    return d.toISOString().slice(0, 16);
  }
  return d.toISOString().slice(0, 10);
}

function formatDisplay(value: string | Date | null, includeTime: boolean): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return includeTime ? d.toLocaleString() : d.toLocaleDateString();
}

export function DateCell({
  value,
  isEditing,
  canEdit,
  isRedacted,
  onStartEdit,
  onChange,
  onCommit,
  onCancel,
  columnDef,
}: CellProps<string | Date | null>) {
  const includeTime = columnDef.type === 'datetime';

  if (isRedacted) {
    return <span className="text-muted-foreground/40 select-none">••••••</span>;
  }

  if (isEditing) {
    return (
      <input
        type={includeTime ? 'datetime-local' : 'date'}
        className="rounded border border-primary bg-background px-2 py-0.5 text-sm focus:outline-none"
        value={toInputValue(value, includeTime)}
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

  const display = formatDisplay(value, includeTime);

  return (
    <span
      className={`block truncate text-sm ${canEdit ? 'cursor-pointer hover:bg-muted/50' : ''}`}
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
