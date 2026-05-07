'use client';

import { useState } from 'react';
import { Download, X } from 'lucide-react';

interface Props {
  prdId: string;
  onClose: () => void;
}

export function ExportDialog({ prdId, onClose }: Props) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/v1/prd/${prdId}/export?format=markdown`);
      if (!res.ok) throw new Error('Export failed');
      const { content } = (await res.json()) as { content: string };
      const blob = new Blob([content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `prd-${prdId}.md`;
      a.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch {
      // error handled silently; user can retry
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-6 shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">Export PRD</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-6 text-sm text-neutral-600 dark:text-neutral-400">
          Download the PRD as a Markdown file. All 13 sections are included in order.
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg border border-neutral-200 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300">
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {exporting ? 'Exporting…' : 'Download Markdown'}
          </button>
        </div>
      </div>
    </div>
  );
}
