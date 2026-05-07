'use client';

import { useEffect, useRef, useState } from 'react';

import type { CellProps } from '../types.js';

interface FkOption {
  id: string;
  label: string;
}

interface FkCellProps extends CellProps<string | null> {
  resolvedLabel?: string | undefined;
  onSearch: (query: string) => Promise<FkOption[]>;
}

export function FkCell({
  value,
  isEditing,
  canEdit,
  isRedacted,
  onStartEdit,
  onChange,
  onCommit,
  onCancel,
  columnDef,
  resolvedLabel,
  onSearch,
}: FkCellProps) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<FkOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState(resolvedLabel ?? value ?? '');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isEditing) return;
    setQuery('');
    setOptions([]);
  }, [isEditing]);

  const handleSearch = (q: string) => {
    setQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      void (async () => {
        setLoading(true);
        try {
          const results = await onSearch(q);
          setOptions(results);
        } finally {
          setLoading(false);
        }
      })();
    }, 200);
  };

  if (isRedacted) {
    return <span className="text-muted-foreground/40 select-none">••••••</span>;
  }

  if (isEditing) {
    return (
      <div className="relative flex flex-col gap-1">
        <input
          type="text"
          className="w-full rounded border border-primary bg-background px-2 py-0.5 text-sm focus:outline-none"
          placeholder={`Search ${columnDef.foreignKey?.targetTableName ?? ''}...`}
          value={query}
          autoFocus
          onChange={(e) => {
            handleSearch(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              onCancel();
            }
          }}
        />
        {(options.length > 0 || loading) && (
          <div className="absolute top-full z-50 mt-1 w-full rounded border border-border bg-popover shadow-lg">
            {loading && <div className="px-3 py-2 text-sm text-muted-foreground">Loading...</div>}
            {options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className="flex w-full items-center px-3 py-1.5 text-left text-sm hover:bg-accent"
                onClick={() => {
                  onChange(opt.id);
                  setSelectedLabel(opt.label);
                  void onCommit();
                }}
              >
                <span className="font-medium">{opt.label}</span>
                <span className="ml-auto text-xs text-muted-foreground font-mono">
                  {opt.id.slice(0, 8)}…
                </span>
              </button>
            ))}
            {!loading && options.length === 0 && query.length > 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">No results</div>
            )}
          </div>
        )}
      </div>
    );
  }

  const display = resolvedLabel ?? selectedLabel;

  return (
    <span
      className={`block truncate text-sm ${canEdit ? 'cursor-pointer hover:bg-muted/50' : ''}`}
      onClick={canEdit ? onStartEdit : undefined}
      onKeyDown={(e) => {
        if (canEdit && (e.key === 'Enter' || e.key === 'F2')) onStartEdit();
      }}
      tabIndex={canEdit ? 0 : -1}
      role={canEdit ? 'button' : undefined}
      title={value ?? undefined}
    >
      {display ? (
        <span className="text-primary/90">{display}</span>
      ) : (
        <span className="text-muted-foreground/50">—</span>
      )}
    </span>
  );
}
