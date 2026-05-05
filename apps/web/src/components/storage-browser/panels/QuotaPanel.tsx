'use client';

import type { QuotaSummary } from '../types.js';

import { formatBytes } from '../types.js';

interface QuotaPanelProps {
  quota: QuotaSummary | null;
}

export function QuotaPanel({ quota }: QuotaPanelProps) {
  if (!quota) return null;

  const pct = Math.min(100, Math.round(quota.usedPercent * 100));
  const barColor = pct >= 95 ? 'bg-destructive' : pct >= 80 ? 'bg-amber-500' : 'bg-primary';

  return (
    <div className="flex items-center gap-3" aria-label={`Storage quota: ${String(pct)}% used`}>
      <div className="w-32">
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${String(pct)}%` }}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {formatBytes(quota.usedBytes)} / {formatBytes(quota.quotaBytes)}
        {pct >= 80 && (
          <span
            className={`ml-1 font-medium ${pct >= 95 ? 'text-destructive' : 'text-amber-600 dark:text-amber-400'}`}
          >
            ({pct}%)
          </span>
        )}
      </span>
    </div>
  );
}
