'use client';

import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import type { StalenessReport } from '@platform/core';

interface Props {
  report: StalenessReport;
  onRegenerateAffected: () => Promise<void>;
  onClose: () => void;
}

export function StalenessDialog({ report, onRegenerateAffected, onClose }: Props) {
  const [loading, setLoading] = useState(false);

  const handleRegenerate = async () => {
    setLoading(true);
    try { await onRegenerateAffected(); onClose(); } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-6 shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
        <div className="mb-4 flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-500" />
          <div className="flex-1">
            <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">PRD may be stale</h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              The intent brief was updated after this PRD was generated. {report.indicators.length} section(s) may be affected.
            </p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <ul className="mb-5 space-y-1 rounded-lg bg-neutral-50 p-3 dark:bg-neutral-800">
          {report.indicators.map((ind) => (
            <li key={ind.sectionType} className="text-sm text-neutral-700 dark:text-neutral-300">
              <span className="font-medium">{ind.sectionType.replace(/_/g, ' ')}</span>
              <span className="text-neutral-500"> — {ind.reason}</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg border border-neutral-200 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300">
            Dismiss
          </button>
          <button
            onClick={handleRegenerate}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" />
            {loading ? 'Regenerating…' : `Regenerate ${report.indicators.length} section(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}

// useState import needed
import { useState } from 'react';
