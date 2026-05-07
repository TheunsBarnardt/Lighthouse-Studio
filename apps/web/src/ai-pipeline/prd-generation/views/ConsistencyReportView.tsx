'use client';

import type { ConsistencyReport } from '@platform/core';

import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

import { SECTION_DISPLAY_NAMES } from '../utils/sectionMeta.js';

interface ConsistencyReportViewProps {
  report: ConsistencyReport;
}

export function ConsistencyReportView({ report }: ConsistencyReportViewProps) {
  const unresolvedIssues = report.issues.filter((i) => !i.resolved);
  const resolvedIssues = report.issues.filter((i) => i.resolved);

  return (
    <div className="space-y-4">
      {/* Banner */}
      {report.clean ? (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 dark:bg-green-900/20">
          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" aria-hidden="true" />
          <p className="text-sm font-medium text-green-700 dark:text-green-400">
            No consistency issues found.
          </p>
          <span className="ml-auto text-xs text-green-600 dark:text-green-500">
            Checked {new Date(report.ranAt).toLocaleString()}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-3 dark:bg-amber-900/20">
          <AlertTriangle
            className="h-5 w-5 text-amber-600 dark:text-amber-400"
            aria-hidden="true"
          />
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
            {unresolvedIssues.length} unresolved{' '}
            {unresolvedIssues.length === 1 ? 'issue' : 'issues'} found.
          </p>
          <span className="ml-auto text-xs text-amber-600 dark:text-amber-500">
            Checked {new Date(report.ranAt).toLocaleString()}
          </span>
        </div>
      )}

      {/* Unresolved issues */}
      {unresolvedIssues.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Issues ({unresolvedIssues.length})
          </h4>
          {unresolvedIssues.map((issue) => (
            <div
              key={issue.id}
              className="rounded-lg border bg-card p-4 space-y-2"
              role="article"
              aria-label={`Consistency issue ${issue.id}`}
            >
              <div className="flex items-start gap-2">
                {issue.severity === 'error' ? (
                  <XCircle
                    className="mt-0.5 h-4 w-4 shrink-0 text-destructive"
                    aria-hidden="true"
                  />
                ) : (
                  <AlertTriangle
                    className="mt-0.5 h-4 w-4 shrink-0 text-amber-500"
                    aria-hidden="true"
                  />
                )}
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium uppercase ${
                        issue.severity === 'error'
                          ? 'bg-destructive/10 text-destructive'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      }`}
                    >
                      {issue.severity}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {issue.sections.map((s) => (
                        <span
                          key={s}
                          className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                        >
                          {SECTION_DISPLAY_NAMES[s]}
                        </span>
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-foreground">{issue.description}</p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">Suggestion:</span> {issue.suggestion}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Resolved issues */}
      {resolvedIssues.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Resolved ({resolvedIssues.length})
          </h4>
          {resolvedIssues.map((issue) => (
            <div
              key={issue.id}
              className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3 opacity-60"
            >
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-500" aria-hidden="true" />
              <p className="text-sm text-muted-foreground line-through">{issue.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
