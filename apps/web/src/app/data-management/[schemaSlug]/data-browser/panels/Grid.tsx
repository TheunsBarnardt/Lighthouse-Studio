'use client';

import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useCallback, useRef, useState } from 'react';

import type { ColumnDefinition, ConflictInfo, RowContext, SortConfig } from '../types.js';

import { ArrayCell } from '../cells/ArrayCell.js';
import { BooleanCell } from '../cells/BooleanCell.js';
import { DateCell } from '../cells/DateCell.js';
import { FileCell } from '../cells/FileCell.js';
import { FkCell } from '../cells/FkCell.js';
import { JsonCell } from '../cells/JsonCell.js';
import { NumberCell } from '../cells/NumberCell.js';
import { StringCell } from '../cells/StringCell.js';
import { ConflictResolutionDialog } from '../dialogs/ConflictResolutionDialog.js';
import { useRowPermissions } from '../hooks/useRowPermissions.js';

interface GridProps {
  rows: Record<string, unknown>[];
  columns: ColumnDefinition[];
  sortConfig: SortConfig[];
  selectedRowIds: Set<string>;
  fkLabels?: Record<string, Record<string, string>>;
  onSortChange: (col: ColumnDefinition, multi: boolean) => void;
  onRowSelect: (rowId: string, mode: 'single' | 'shift' | 'ctrl') => void;
  onRowClick: (row: Record<string, unknown>) => void;
  onCellSave: (
    rowId: string,
    columnId: string,
    value: unknown,
    version: number,
  ) => Promise<{ conflict?: ConflictInfo }>;
  onFkSearch: (columnId: string, query: string) => Promise<Array<{ id: string; label: string }>>;
  pendingRealtimeRowIds?: Set<string>;
  highlightedRowIds?: Set<string>;
}

type EditState = { rowId: string; columnId: string; draft: unknown };

const ROW_HEIGHT = 36;

export function Grid({
  rows,
  columns,
  sortConfig,
  selectedRowIds,
  fkLabels,
  onSortChange,
  onRowSelect,
  onRowClick,
  onCellSave,
  onFkSearch,
  pendingRealtimeRowIds = new Set(),
  highlightedRowIds = new Set(),
}: GridProps) {
  const [editState, setEditState] = useState<EditState | null>(null);
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const getSortDir = (colId: string) => sortConfig.find((s) => s.columnId === colId)?.direction;

  const handleStartEdit = (rowId: string, columnId: string, currentValue: unknown) => {
    setEditState({ rowId, columnId, draft: currentValue });
  };

  const handleCommit = useCallback(
    async (rowId: string, columnId: string, value: unknown, version: number) => {
      setEditState(null);
      const result = await onCellSave(rowId, columnId, value, version);
      if (result.conflict) {
        setConflict(result.conflict);
      }
    },
    [onCellSave],
  );

  const handleCancel = useCallback(() => {
    setEditState(null);
  }, []);

  const visibleCols: ColumnDef<Record<string, unknown>>[] = [
    // Selection checkbox column
    {
      id: '__select__',
      header: () => null,
      size: 32,
      cell: ({ row }) => {
        const rawId = row.original['id'];
        const rowId = rawId !== null && rawId !== undefined ? String(rawId as string | number) : '';
        return (
          <input
            type="checkbox"
            aria-label="Select row"
            checked={selectedRowIds.has(rowId)}
            onChange={() => {
              onRowSelect(rowId, 'single');
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (e.shiftKey) onRowSelect(rowId, 'shift');
              else if (e.ctrlKey || e.metaKey) onRowSelect(rowId, 'ctrl');
            }}
            className="h-3.5 w-3.5 cursor-pointer accent-primary"
          />
        );
      },
    },
    // Data columns
    ...columns
      .filter((col) => !col.id.startsWith('_'))
      .map(
        (col): ColumnDef<Record<string, unknown>> => ({
          id: col.id,
          header: () => (
            <button
              type="button"
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                onSortChange(col, e.shiftKey);
              }}
              aria-sort={
                getSortDir(col.id) === 'asc'
                  ? 'ascending'
                  : getSortDir(col.id) === 'desc'
                    ? 'descending'
                    : 'none'
              }
            >
              {col.name}
              {col.required && <span className="text-destructive text-xs">*</span>}
              {getSortDir(col.id) === 'asc' && <span aria-hidden>↑</span>}
              {getSortDir(col.id) === 'desc' && <span aria-hidden>↓</span>}
            </button>
          ),
          size:
            col.type === 'boolean' ? 60 : col.type === 'json' ? 200 : col.type === 'fk' ? 180 : 160,
          cell: ({ row }) => {
            const rawRow = row.original;
            const rawRowId = rawRow['id'];
            const rowId =
              rawRowId !== null && rawRowId !== undefined
                ? String(rawRowId as string | number)
                : '';
            const version = Number(rawRow['_version'] ?? 1);
            const perms = useRowPermissions(rawRow);
            const isEditing =
              editState !== null && editState.rowId === rowId && editState.columnId === col.id;
            const isRedacted = perms.redactedFields.has(col.id);
            const value = isEditing ? editState.draft : rawRow[col.id];

            const rowCtx: RowContext = {
              id: rowId,
              version,
              permissions: perms,
              isEditingLocally: editState?.rowId === rowId,
              hasPendingRealtime: pendingRealtimeRowIds.has(rowId),
            };

            const cellProps = {
              value,
              isEditing,
              canEdit: perms.canEdit && !col.isPrimaryKey,
              isRedacted,
              columnDef: col,
              rowContext: rowCtx,
              onStartEdit: () => {
                handleStartEdit(rowId, col.id, rawRow[col.id]);
              },
              onChange: (v: unknown) => {
                setEditState((prev) => (prev ? { ...prev, draft: v } : null));
              },
              onCommit: () => handleCommit(rowId, col.id, editState?.draft ?? value, version),
              onCancel: handleCancel,
            };

            if (['string', 'text', 'uuid'].includes(col.type)) {
              return (
                <StringCell
                  {...(cellProps as Parameters<typeof StringCell>[0])}
                  value={value as string | null}
                />
              );
            }
            if (['number', 'decimal'].includes(col.type)) {
              return (
                <NumberCell
                  {...(cellProps as Parameters<typeof NumberCell>[0])}
                  value={value as number | null}
                />
              );
            }
            if (col.type === 'boolean') {
              return (
                <BooleanCell
                  {...(cellProps as Parameters<typeof BooleanCell>[0])}
                  value={value as boolean | null}
                />
              );
            }
            if (['date', 'datetime'].includes(col.type)) {
              return (
                <DateCell
                  {...(cellProps as Parameters<typeof DateCell>[0])}
                  value={value as string | null}
                />
              );
            }
            if (col.type === 'json') {
              return <JsonCell {...cellProps} value={value} />;
            }
            if (col.type === 'array') {
              return (
                <ArrayCell
                  {...(cellProps as Parameters<typeof ArrayCell>[0])}
                  value={value as unknown[] | null}
                />
              );
            }
            if (col.type === 'fk') {
              return (
                <FkCell
                  {...(cellProps as Parameters<typeof FkCell>[0])}
                  value={value as string | null}
                  resolvedLabel={fkLabels?.[col.id]?.[String(value)]}
                  onSearch={(q) => onFkSearch(col.id, q)}
                />
              );
            }
            if (['file', 'image', 'video'].includes(col.type)) {
              return (
                <FileCell
                  {...(cellProps as Parameters<typeof FileCell>[0])}
                  value={value as string | null}
                  fileType={col.type as 'file' | 'image' | 'video'}
                />
              );
            }
            const fallback =
              value !== null && value !== undefined
                ? String(value as string | number | boolean)
                : '';
            return <span className="text-xs text-muted-foreground">{fallback}</span>;
          },
        }),
      ),
  ];

  const table = useReactTable({
    data: rows,
    columns: visibleCols,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    getRowId: (row) => {
      const v = row['id'];
      return v !== null && v !== undefined ? String(v as string | number) : '';
    },
  });

  const { rows: tableRows } = table.getRowModel();

  const virtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  return (
    <>
      <div
        ref={containerRef}
        className="flex-1 overflow-auto"
        role="grid"
        aria-label="Data grid"
        aria-rowcount={rows.length}
      >
        <table className="w-full border-collapse text-sm" style={{ tableLayout: 'fixed' }}>
          <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="border-b border-border px-3 py-2 text-left"
                    style={{ width: header.getSize() }}
                    role="columnheader"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody style={{ height: totalSize }}>
            {virtualItems.map((virtualRow) => {
              const row = tableRows[virtualRow.index];
              if (!row) return null;
              const rowId = row.id;
              const isSelected = selectedRowIds.has(rowId);
              const isHighlighted = highlightedRowIds.has(rowId);
              const hasPending = pendingRealtimeRowIds.has(rowId);

              return (
                <tr
                  key={rowId}
                  role="row"
                  aria-selected={isSelected}
                  style={{
                    position: 'absolute',
                    top: virtualRow.start,
                    left: 0,
                    width: '100%',
                    height: ROW_HEIGHT,
                  }}
                  className={`border-b border-border transition-colors ${
                    isSelected
                      ? 'bg-primary/10'
                      : isHighlighted
                        ? 'bg-green-50 dark:bg-green-950/20'
                        : 'hover:bg-muted/40'
                  } ${hasPending ? 'opacity-60' : ''}`}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).tagName === 'INPUT') return;
                    onRowClick(row.original);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onRowClick(row.original);
                    if (e.key === ' ') onRowSelect(rowId, 'single');
                  }}
                  tabIndex={0}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      role="gridcell"
                      className="overflow-hidden px-2 py-1 align-middle"
                      style={{ width: cell.column.getSize() }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>

        {rows.length === 0 && (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            No rows found
          </div>
        )}
      </div>

      {conflict && (
        <ConflictResolutionDialog
          conflict={conflict}
          onTakeServer={() => {
            // Revert the edit to server value — onCellSave with serverValue and serverVersion
            void onCellSave(
              conflict.rowId,
              conflict.columnId,
              conflict.serverValue,
              conflict.serverVersion,
            );
            setConflict(null);
          }}
          onTakeLocal={() => {
            // Force-save local value using the server's version
            void onCellSave(
              conflict.rowId,
              conflict.columnId,
              conflict.localValue,
              conflict.serverVersion,
            );
            setConflict(null);
          }}
          onDiscard={() => {
            setConflict(null);
          }}
        />
      )}
    </>
  );
}
