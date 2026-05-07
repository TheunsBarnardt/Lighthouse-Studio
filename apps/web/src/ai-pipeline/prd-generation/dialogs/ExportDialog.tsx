'use client';

import { FileText, FileDown } from 'lucide-react';

interface ExportDialogProps {
  open: boolean;
  prdTitle: string;
  onExport: (format: 'markdown' | 'pdf') => void;
  onCancel: () => void;
}

export function ExportDialog({ open, prdTitle, onExport, onCancel }: ExportDialogProps) {
  if (!open) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onCancel();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-dialog-title"
      onKeyDown={handleKeyDown}
    >
      <div className="w-full max-w-sm rounded-xl border bg-card shadow-xl">
        {/* Header */}
        <div className="border-b px-5 py-4">
          <h2 id="export-dialog-title" className="text-base font-semibold text-foreground">
            Export PRD
          </h2>
          {prdTitle && <p className="mt-0.5 text-sm text-muted-foreground truncate">{prdTitle}</p>}
        </div>

        {/* Format options */}
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-muted-foreground">Choose an export format:</p>

          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-lg border bg-background p-3 text-left hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
            onClick={() => {
              onExport('markdown');
            }}
            aria-label="Export as Markdown"
          >
            <FileText className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-foreground">Export Markdown</p>
              <p className="text-xs text-muted-foreground">
                .md file — suitable for GitHub, Notion, or any markdown editor
              </p>
            </div>
          </button>

          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-lg border bg-background p-3 text-left hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
            onClick={() => {
              onExport('pdf');
            }}
            aria-label="Export as PDF"
          >
            <FileDown className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-foreground">Export PDF</p>
              <p className="text-xs text-muted-foreground">
                .pdf file — formatted document for sharing with stakeholders
              </p>
            </div>
          </button>
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t px-5 py-3">
          <button
            type="button"
            className="rounded-lg border px-4 py-2 text-sm hover:bg-muted"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
