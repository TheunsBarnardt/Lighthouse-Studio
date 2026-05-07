'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';

interface Column {
  name: string;
  type?: string;
}

interface ResultsPanelProps {
  rows: Record<string, unknown>[];
  columns: Column[];
  rowCount: number;
  truncated: boolean;
  durationMs: number;
  statementsAffected?: { statement: number; rowsAffected: number }[];
}

function CellValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground italic">NULL</span>;
  }
  if (typeof value === 'boolean') {
    return <span className="font-mono text-blue-600 dark:text-blue-400">{String(value)}</span>;
  }
  if (typeof value === 'number') {
    return <span className="font-mono text-green-700 dark:text-green-400">{String(value)}</span>;
  }
  const str =
    typeof value === 'object'
      ? JSON.stringify(value)
      : String(value as string | number | boolean | bigint);
  const display = str.length > 120 ? `${str.slice(0, 120)}…` : str;
  return (
    <span className="font-mono" title={str.length > 120 ? str : undefined}>
      {display}
    </span>
  );
}

export function ResultsPanel({
  rows,
  columns,
  rowCount,
  truncated,
  durationMs,
  statementsAffected,
}: ResultsPanelProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32,
    overscan: 10,
  });

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Status bar */}
      <div className="flex items-center gap-4 border-b px-3 py-1 text-xs text-muted-foreground">
        <span>
          {rowCount} row{rowCount !== 1 ? 's' : ''}
        </span>
        {truncated && (
          <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
            Truncated — grant query.large_result to fetch more
          </span>
        )}
        <span className="ml-auto">{durationMs}ms</span>
      </div>

      {statementsAffected && statementsAffected.length > 0 && (
        <div className="border-b px-3 py-1.5 text-xs text-muted-foreground">
          <span className="font-medium">Per-statement:</span>{' '}
          {statementsAffected.map((s) => (
            <span key={s.statement} className="mr-3">
              #{s.statement}: {s.rowsAffected} row{s.rowsAffected !== 1 ? 's' : ''} affected
            </span>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          No rows returned
        </div>
      ) : (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Sticky header */}
          <div className="flex border-b bg-muted/50">
            {columns.map((col) => (
              <div
                key={col.name}
                className="shrink-0 w-40 overflow-hidden whitespace-nowrap px-3 py-1.5 text-left text-xs font-medium text-muted-foreground"
              >
                {col.name}
                {col.type && <span className="ml-1 opacity-60">{col.type}</span>}
              </div>
            ))}
          </div>

          {/* Virtualised body */}
          <div ref={parentRef} className="flex-1 overflow-auto">
            <div
              style={{ height: `${String(rowVirtualizer.getTotalSize())}px`, position: 'relative' }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const row = rows[virtualRow.index];
                return (
                  <div
                    key={virtualRow.key}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    className="flex border-b hover:bg-muted/30"
                    style={{ position: 'absolute', top: virtualRow.start, left: 0, width: '100%' }}
                  >
                    {columns.map((col) => (
                      <div
                        key={col.name}
                        className="w-40 shrink-0 overflow-hidden px-3 py-1.5 text-sm"
                      >
                        <CellValue value={row?.[col.name]} />
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
