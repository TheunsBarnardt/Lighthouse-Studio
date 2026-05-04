'use client';

import { useState } from 'react';

import type { TableDefinition } from '@/lib/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { detectPiiColumns, newColumn, newTable } from '@/lib/schema-utils';
import { cn } from '@/lib/utils';
import { useDesignerStore } from '@/state/designer-store';

import { ColumnRow } from './column-row';

function TableListItem({
  table,
  selected,
  onSelect,
}: {
  table: TableDefinition;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      className={cn(
        'w-full rounded-md px-3 py-2 text-left text-sm font-medium transition-colors',
        selected ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted',
      )}
      onClick={() => {
        onSelect(table.id);
      }}
      aria-pressed={selected}
    >
      <span className="truncate">{table.name}</span>
      <span className="ml-2 text-xs opacity-70">{table.columns.length}c</span>
    </button>
  );
}

export function TableView() {
  const schema = useDesignerStore((s) => s.schema);
  const selectedTableId = useDesignerStore((s) => s.selectedTableId);
  const selectTable = useDesignerStore((s) => s.selectTable);
  const updateSchema = useDesignerStore((s) => s.updateSchema);

  const [editingTableName, setEditingTableName] = useState<string | null>(null);

  const selectedTable = schema?.tables.find((t) => t.id === selectedTableId) ?? schema?.tables[0];

  const handleAddTable = () => {
    if (!schema) return;
    const table = newTable(schema.id);
    updateSchema((s) => {
      s.tables.push(table);
    });
    selectTable(table.id);
  };

  const handleRemoveTable = (tableId: string) => {
    updateSchema((s) => {
      s.tables = s.tables.filter((t) => t.id !== tableId);
    });
    if (selectedTableId === tableId) {
      selectTable(null);
    }
  };

  const handleRenameTable = (tableId: string, name: string) => {
    updateSchema((s) => {
      const table = s.tables.find((t) => t.id === tableId);
      if (table) table.name = name;
    });
    setEditingTableName(null);
  };

  const handleAddColumn = () => {
    if (!selectedTable) return;
    const col = newColumn('', selectedTable.id);
    updateSchema((s) => {
      const table = s.tables.find((t) => t.id === selectedTable.id);
      if (table) table.columns.push(col);
    });
  };

  if (!schema) {
    return <div className="p-4 text-muted-foreground">No schema loaded.</div>;
  }

  const pkColumnIds = selectedTable
    ? new Set(
        selectedTable.primaryKey.kind === 'single'
          ? [selectedTable.primaryKey.columnId]
          : selectedTable.primaryKey.columnIds,
      )
    : new Set<string>();

  return (
    <div className="flex h-full gap-0" role="main">
      {/* Table list sidebar */}
      <aside className="w-52 shrink-0 border-r" aria-label="Table list">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-xs font-semibold uppercase text-muted-foreground">
            Tables ({schema.tables.length})
          </span>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleAddTable}
            aria-label="Add table"
            className="h-6 w-6 text-lg"
          >
            +
          </Button>
        </div>
        <nav className="p-2" aria-label="Tables">
          {schema.tables.map((table) => (
            <div key={table.id} className="group relative">
              <TableListItem
                table={table}
                selected={selectedTableId === table.id || selectedTable?.id === table.id}
                onSelect={selectTable}
              />
              <button
                className="absolute right-1 top-1.5 hidden rounded text-xs text-muted-foreground hover:text-error group-hover:block"
                onClick={() => {
                  handleRemoveTable(table.id);
                }}
                aria-label={`Remove table ${table.name}`}
              >
                ×
              </button>
            </div>
          ))}
        </nav>
      </aside>

      {/* Column editor */}
      <main className="flex flex-1 flex-col overflow-auto" aria-label="Column editor">
        {selectedTable ? (
          <>
            {/* Table header */}
            <div className="flex items-center gap-3 border-b px-4 py-2">
              {editingTableName === selectedTable.id ? (
                <Input
                  autoFocus
                  defaultValue={selectedTable.name}
                  className="h-7 w-48 font-mono text-sm"
                  onBlur={(e) => {
                    handleRenameTable(selectedTable.id, e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter')
                      handleRenameTable(selectedTable.id, (e.target as HTMLInputElement).value);
                    if (e.key === 'Escape') setEditingTableName(null);
                  }}
                  aria-label="Table name"
                />
              ) : (
                <button
                  className="font-mono text-base font-semibold hover:text-primary"
                  onClick={() => {
                    setEditingTableName(selectedTable.id);
                  }}
                  aria-label={`Rename table: ${selectedTable.name}`}
                >
                  {selectedTable.name}
                </button>
              )}
              <span className="text-xs text-muted-foreground">
                {selectedTable.columns.length} columns
              </span>
              {schema.databaseDriver === 'mongo' && selectedTable.foreignKeys.length > 0 && (
                <span className="rounded bg-warning/10 px-2 py-0.5 text-xs text-warning">
                  FK advisory on MongoDB
                </span>
              )}
            </div>

            {/* PII heuristic hints */}
            {(() => {
              const untaggedPiiIds = detectPiiColumns(selectedTable);
              const hints = selectedTable.columns.filter((c) => untaggedPiiIds.includes(c.id));
              return hints.length > 0 ? (
                <div className="border-b bg-info/5 px-4 py-2" role="status" aria-live="polite">
                  {hints.map((col) => (
                    <p key={col.id} className="text-xs text-info">
                      <span className="font-medium">Suggestion:</span> Column &ldquo;{col.name}
                      &rdquo; looks like PII — consider marking it in the PII column.
                    </p>
                  ))}
                </div>
              ) : null;
            })()}

            {/* Column table */}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm" aria-label={`Columns for ${selectedTable.name}`}>
                <thead className="sticky top-0 bg-card shadow-xs">
                  <tr className="border-b border-border text-xs font-semibold text-muted-foreground">
                    <th className="w-8 px-2 py-2 text-left" scope="col"></th>
                    <th className="px-2 py-2 text-left" scope="col">
                      Name
                    </th>
                    <th className="px-2 py-2 text-left" scope="col">
                      Type
                    </th>
                    <th className="w-20 px-2 py-2 text-center" scope="col">
                      Nullable
                    </th>
                    <th className="w-16 px-2 py-2 text-center" scope="col">
                      PII
                    </th>
                    <th className="px-2 py-2 text-left" scope="col">
                      PII Category
                    </th>
                    <th className="px-2 py-2 text-left" scope="col">
                      Description
                    </th>
                    <th className="w-10 px-2 py-2" scope="col" aria-label="Actions"></th>
                  </tr>
                </thead>
                <tbody>
                  {selectedTable.columns.map((col) => (
                    <ColumnRow
                      key={col.id}
                      tableId={selectedTable.id}
                      column={col}
                      isPrimaryKey={pkColumnIds.has(col.id)}
                      driver={schema.databaseDriver}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Add column */}
            <div className="border-t p-2">
              <Button variant="outline" size="sm" onClick={handleAddColumn} aria-label="Add column">
                + Add Column
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            Select or create a table to start editing.
          </div>
        )}
      </main>
    </div>
  );
}
