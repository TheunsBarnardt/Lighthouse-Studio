'use client';

import { useState } from 'react';

import type { ColumnDefinition } from '../types.js';

import { ArrayCell } from '../cells/ArrayCell.js';
import { BooleanCell } from '../cells/BooleanCell.js';
import { DateCell } from '../cells/DateCell.js';
import { FileCell } from '../cells/FileCell.js';
import { FkCell } from '../cells/FkCell.js';
import { JsonCell } from '../cells/JsonCell.js';
import { NumberCell } from '../cells/NumberCell.js';
import { StringCell } from '../cells/StringCell.js';
import { useRowPermissions } from '../hooks/useRowPermissions.js';

interface RowDetailPanelProps {
  row: Record<string, unknown>;
  columns: ColumnDefinition[];
  onClose: () => void;
  onSave: (rowId: string, changes: Record<string, unknown>) => Promise<void>;
  onDelete: (rowId: string, hard?: boolean) => void;
  fkLabels?: Record<string, Record<string, string>>;
  onFkSearch?: (columnId: string, query: string) => Promise<Array<{ id: string; label: string }>>;
}

export function RowDetailPanel({
  row,
  columns,
  onClose,
  onSave,
  onDelete,
  fkLabels,
  onFkSearch,
}: RowDetailPanelProps) {
  const permissions = useRowPermissions(row);
  const [edits, setEdits] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);

  const rawRowId = row['id'];
  const rowId =
    rawRowId !== null && rawRowId !== undefined ? String(rawRowId as string | number) : '';
  const hasEdits = Object.keys(edits).length > 0;

  const handleSave = async () => {
    if (!hasEdits) return;
    setSaving(true);
    try {
      await onSave(rowId, edits);
      setEdits({});
    } finally {
      setSaving(false);
    }
  };

  const currentValue = (colId: string) => (colId in edits ? edits[colId] : row[colId]);

  return (
    <aside
      className="flex h-full w-80 flex-col border-l border-border bg-background"
      aria-label="Row detail"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="font-semibold text-sm">Row Detail</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close detail panel"
          className="text-muted-foreground hover:text-foreground"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {columns
          .filter((col) => !col.id.startsWith('_'))
          .map((col) => {
            const value = currentValue(col.id);
            const isEditing = editingField === col.id;
            const isRedacted = permissions.redactedFields.has(col.id);
            const canEdit = permissions.canEdit && !col.isPrimaryKey;

            const cellProps = {
              value,
              isEditing,
              canEdit,
              isRedacted,
              columnDef: col,
              rowContext: {
                id: rowId,
                version: Number(row['_version'] ?? 1),
                permissions,
                isEditingLocally: hasEdits,
                hasPendingRealtime: false,
              },
              onStartEdit: () => {
                setEditingField(col.id);
              },
              onChange: (v: unknown) => {
                setEdits((prev) => ({ ...prev, [col.id]: v }));
              },
              onCommit: (): Promise<void> => {
                setEditingField(null);
                return Promise.resolve();
              },
              onCancel: () => {
                setEdits((prev) => {
                  const { [col.id]: _removed, ...rest } = prev;
                  return rest;
                });
                setEditingField(null);
              },
            };

            return (
              <div key={col.id} className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  {col.name}
                  {col.required && <span className="text-destructive">*</span>}
                  {col.isPii && (
                    <span className="rounded bg-yellow-100 px-1 text-yellow-700 text-[10px]">
                      PII
                    </span>
                  )}
                </label>
                <div className="min-h-7">
                  {['string', 'text', 'uuid'].includes(col.type) && (
                    <StringCell
                      {...(cellProps as Parameters<typeof StringCell>[0])}
                      value={value as string | null}
                    />
                  )}
                  {['number', 'decimal'].includes(col.type) && (
                    <NumberCell
                      {...(cellProps as Parameters<typeof NumberCell>[0])}
                      value={value as number | null}
                    />
                  )}
                  {col.type === 'boolean' && (
                    <BooleanCell
                      {...(cellProps as Parameters<typeof BooleanCell>[0])}
                      value={value as boolean | null}
                    />
                  )}
                  {['date', 'datetime'].includes(col.type) && (
                    <DateCell
                      {...(cellProps as Parameters<typeof DateCell>[0])}
                      value={value as string | null}
                    />
                  )}
                  {col.type === 'json' && <JsonCell {...cellProps} value={value} />}
                  {col.type === 'array' && (
                    <ArrayCell
                      {...(cellProps as Parameters<typeof ArrayCell>[0])}
                      value={value as unknown[] | null}
                    />
                  )}
                  {col.type === 'fk' && onFkSearch && (
                    <FkCell
                      {...(cellProps as Parameters<typeof FkCell>[0])}
                      value={value as string | null}
                      resolvedLabel={fkLabels?.[col.id]?.[String(value)]}
                      onSearch={(q) => onFkSearch(col.id, q)}
                    />
                  )}
                  {['file', 'image', 'video'].includes(col.type) && (
                    <FileCell
                      {...(cellProps as Parameters<typeof FileCell>[0])}
                      value={value as string | null}
                      fileType={col.type as 'file' | 'image' | 'video'}
                    />
                  )}
                </div>
              </div>
            );
          })}
      </div>

      {permissions.canEdit && (
        <div className="border-t border-border p-3 flex gap-2">
          <button
            type="button"
            disabled={!hasEdits || saving}
            onClick={() => void handleSave()}
            className="flex-1 rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          {hasEdits && (
            <button
              type="button"
              onClick={() => {
                setEdits({});
              }}
              className="rounded px-3 py-1.5 text-sm hover:bg-muted"
            >
              Discard
            </button>
          )}
        </div>
      )}

      {permissions.canDelete && (
        <div className="border-t border-border px-3 py-2">
          <button
            type="button"
            onClick={() => {
              onDelete(rowId);
            }}
            className="w-full rounded px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10"
          >
            Archive row
          </button>
        </div>
      )}
    </aside>
  );
}
