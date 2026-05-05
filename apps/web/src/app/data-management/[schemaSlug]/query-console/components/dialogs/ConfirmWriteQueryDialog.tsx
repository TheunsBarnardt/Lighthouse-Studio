'use client';

interface ConfirmWriteQueryDialogProps {
  open: boolean;
  statementCount: number;
  affectedTables: string[];
  hasWriteStatements: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmWriteQueryDialog({
  open,
  statementCount,
  affectedTables,
  hasWriteStatements,
  onConfirm,
  onCancel,
}: ConfirmWriteQueryDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border border-destructive/30 bg-card p-6 shadow-lg">
        <h2 className="mb-2 text-lg font-semibold text-destructive">Confirm Write Query</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          This query will modify data. Please review and confirm.
        </p>

        <div className="mb-4 rounded border bg-muted/40 p-3 text-sm">
          <div className="flex justify-between">
            <span>Statements</span>
            <span className="font-medium">{statementCount}</span>
          </div>
          {hasWriteStatements && (
            <div className="mt-1 flex justify-between">
              <span>Type</span>
              <span className="font-medium text-destructive">Write (INSERT / UPDATE / DELETE)</span>
            </div>
          )}
          {affectedTables.length > 0 && (
            <div className="mt-1">
              <span className="block">Affected tables</span>
              <div className="mt-1 flex flex-wrap gap-1">
                {affectedTables.map((t) => (
                  <span key={t} className="rounded bg-destructive/10 px-1.5 py-0.5 font-mono text-xs text-destructive">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <p className="mb-6 text-xs text-muted-foreground">
          Multi-statement writes are wrapped in a single transaction and rolled back on error.
        </p>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border px-4 py-1.5 text-sm hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded bg-destructive px-4 py-1.5 text-sm text-destructive-foreground hover:bg-destructive/90"
          >
            Execute Query
          </button>
        </div>
      </div>
    </div>
  );
}
