'use client';

import type { ColumnDefinition } from '../types.js';

interface SchemaQuickReferenceDialogProps {
  tableName: string;
  columns: ColumnDefinition[];
  onClose: () => void;
}

export function SchemaQuickReferenceDialog({
  tableName,
  columns,
  onClose,
}: SchemaQuickReferenceDialogProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Schema Reference"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    >
      <div className="w-full max-w-2xl rounded-lg border border-border bg-background p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Schema: {tableName}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-muted-foreground hover:text-foreground"
          >
            ×
          </button>
        </div>

        <div className="overflow-auto max-h-[60vh]">
          <table className="w-full text-sm" role="table" aria-label="Column definitions">
            <thead className="sticky top-0 bg-muted">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Column</th>
                <th className="px-3 py-2 text-left font-medium">Type</th>
                <th className="px-3 py-2 text-left font-medium">Constraints</th>
                <th className="px-3 py-2 text-left font-medium">References</th>
              </tr>
            </thead>
            <tbody>
              {columns.map((col) => (
                <tr key={col.id} className="border-t border-border">
                  <td className="px-3 py-2 font-mono text-xs">
                    {col.name}
                    {col.isPrimaryKey && (
                      <span className="ml-1 rounded bg-primary/10 px-1 text-primary text-xs">
                        PK
                      </span>
                    )}
                    {col.isPii && (
                      <span className="ml-1 rounded bg-yellow-500/10 px-1 text-yellow-600 text-xs">
                        PII
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground font-mono text-xs">{col.type}</td>
                  <td className="px-3 py-2 text-xs">
                    <div className="flex flex-wrap gap-1">
                      {col.required && (
                        <span className="rounded bg-red-100 px-1 text-red-700 text-xs">
                          required
                        </span>
                      )}
                      {!col.nullable && !col.required && (
                        <span className="rounded bg-orange-100 px-1 text-orange-700 text-xs">
                          not null
                        </span>
                      )}
                      {col.maxLength && (
                        <span className="text-muted-foreground">max {col.maxLength}</span>
                      )}
                      {col.precision !== undefined && (
                        <span className="text-muted-foreground">
                          p{col.precision},{col.scale ?? 0}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {col.foreignKey
                      ? `→ ${col.foreignKey.targetTableName}.${col.foreignKey.targetColumnId}`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-muted px-4 py-2 text-sm hover:bg-muted/80"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
