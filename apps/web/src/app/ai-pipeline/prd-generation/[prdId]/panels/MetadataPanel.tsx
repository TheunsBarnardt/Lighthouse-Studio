'use client';

import { AlertTriangle, Link2, History } from 'lucide-react';
import type { ConsistencyReport, TraceabilityReport } from '@platform/core';

interface Props {
  consistencyReport?: ConsistencyReport;
  traceabilityReport?: TraceabilityReport;
  sectionVersion?: number;
}

export function MetadataPanel({ consistencyReport, traceabilityReport, sectionVersion }: Props) {
  return (
    <aside className="flex w-64 flex-shrink-0 flex-col gap-4 overflow-y-auto border-l border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950">
      {/* Version */}
      {sectionVersion !== undefined && (
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-neutral-500">
            <History className="h-3.5 w-3.5" />
            Version
          </div>
          <p className="text-sm text-neutral-700 dark:text-neutral-300">v{sectionVersion}</p>
        </div>
      )}

      {/* Consistency report */}
      {consistencyReport && (
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-neutral-500">
            <AlertTriangle className="h-3.5 w-3.5" />
            Consistency
          </div>
          {consistencyReport.issues.length === 0 ? (
            <p className="text-xs text-green-600 dark:text-green-400">No issues found</p>
          ) : (
            <ul className="space-y-2">
              {consistencyReport.issues.map((issue) => (
                <li key={issue.id} className="rounded-lg border border-yellow-200 bg-yellow-50 p-2 text-xs dark:border-yellow-800/40 dark:bg-yellow-900/20">
                  <p className={`font-medium ${issue.severity === 'error' ? 'text-red-700 dark:text-red-400' : 'text-yellow-700 dark:text-yellow-400'}`}>
                    {issue.severity === 'error' ? 'Error' : 'Warning'}
                  </p>
                  <p className="mt-0.5 text-neutral-700 dark:text-neutral-300">{issue.description}</p>
                  <p className="mt-1 text-neutral-500">{issue.suggestedResolution}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Traceability report */}
      {traceabilityReport && (
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-neutral-500">
            <Link2 className="h-3.5 w-3.5" />
            Traceability
          </div>
          <p className="text-xs text-neutral-700 dark:text-neutral-300">
            {traceabilityReport.coveredGoals}/{traceabilityReport.totalGoals} intent goals covered
          </p>
          {traceabilityReport.gaps.length > 0 && (
            <ul className="mt-2 space-y-1">
              {traceabilityReport.gaps.map((gap, i) => (
                <li key={i} className="text-xs text-red-600 dark:text-red-400">
                  ↳ {gap.description}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {(!consistencyReport && !traceabilityReport && sectionVersion === undefined) && (
        <p className="text-xs text-neutral-400">
          Run consistency and traceability checks to see quality signals here.
        </p>
      )}
    </aside>
  );
}
