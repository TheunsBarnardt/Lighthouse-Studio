'use client';

import type { CellProps } from '../types.js';

export function BooleanCell({
  value,
  isEditing,
  canEdit,
  isRedacted,
  onStartEdit,
  onChange,
  onCommit,
  columnDef,
}: CellProps<boolean | null>) {
  if (isRedacted) {
    return <span className="text-muted-foreground/40 select-none">••••••</span>;
  }

  if (isEditing || canEdit) {
    return (
      <input
        type="checkbox"
        className="h-4 w-4 cursor-pointer rounded border-border accent-primary"
        checked={value ?? false}
        disabled={!canEdit}
        aria-label={columnDef.name}
        onChange={(e) => {
          onChange(e.target.checked);
          void onCommit();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            onChange(value);
            void onCommit();
          }
        }}
        onClick={(e) => {
          if (!isEditing) {
            e.preventDefault();
            onStartEdit();
          }
        }}
      />
    );
  }

  return (
    <span className="text-sm">
      {value === null ? <span className="text-muted-foreground/50">—</span> : value ? '✓' : '✗'}
    </span>
  );
}
