'use client';

import { useState } from 'react';

interface ExportDialogProps {
  tableId: string;
  hasFilter: boolean;
  onExport: (format: 'csv' | 'json', scope: 'filtered' | 'all') => Promise<void>;
  onClose: () => void;
}

export function ExportDialog({ hasFilter, onExport, onClose }: ExportDialogProps) {
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [scope, setScope] = useState<'filtered' | 'all'>(hasFilter ? 'filtered' : 'all');
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    await onExport(format, scope);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Export"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    >
      <div className="w-full max-w-sm rounded-lg border border-border bg-background p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Export Data</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-muted-foreground hover:text-foreground"
          >
            ×
          </button>
        </div>

        <div className="mb-4 space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Format</label>
            <div className="flex gap-3">
              {(['csv', 'json'] as const).map((f) => (
                <label key={f} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="radio"
                    value={f}
                    checked={format === f}
                    onChange={() => {
                      setFormat(f);
                    }}
                  />
                  {f.toUpperCase()}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Scope</label>
            <div className="flex flex-col gap-1">
              {hasFilter && (
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="radio"
                    value="filtered"
                    checked={scope === 'filtered'}
                    onChange={() => {
                      setScope('filtered');
                    }}
                  />
                  Filtered rows only
                </label>
              )}
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="radio"
                  value="all"
                  checked={scope === 'all'}
                  onChange={() => {
                    setScope('all');
                  }}
                />
                All rows
              </label>
            </div>
          </div>
        </div>

        <p className="mb-4 text-xs text-muted-foreground">
          Large exports run as a background job. You will receive a download link when ready (valid
          for 7 days).
        </p>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-4 py-2 text-sm hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={exporting}
            onClick={() => void handleExport()}
            className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {exporting ? 'Starting…' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  );
}
