'use client';

import type { TraceabilityReport } from '@platform/core';
import type { IntentBrief } from '@platform/core';

import * as Progress from '@radix-ui/react-progress';
import { CheckCircle, AlertCircle } from 'lucide-react';

interface TraceabilityMatrixViewProps {
  report: TraceabilityReport;
  intentBrief: IntentBrief | null;
}

export function TraceabilityMatrixView({ report, intentBrief }: TraceabilityMatrixViewProps) {
  const coveragePercent =
    report.totalIntentGoals > 0
      ? Math.round((report.coveredGoals / report.totalIntentGoals) * 100)
      : 100;

  const coveredGoalIds = new Set(
    intentBrief?.goals
      .filter((g) => !report.gaps.some((gap) => gap.intentGoalId === g.id))
      .map((g) => g.id) ?? [],
  );

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Intent goals covered</span>
          <span className="font-medium text-foreground">
            {report.coveredGoals} / {report.totalIntentGoals}
          </span>
        </div>
        <Progress.Root
          className="relative h-2 w-full overflow-hidden rounded-full bg-muted"
          value={coveragePercent}
          aria-label={`${coveragePercent.toString()}% of intent goals covered`}
        >
          <Progress.Indicator
            className={`h-full transition-transform duration-500 ${
              coveragePercent === 100
                ? 'bg-green-500'
                : coveragePercent >= 70
                  ? 'bg-amber-500'
                  : 'bg-destructive'
            }`}
            style={{ transform: `translateX(-${(100 - coveragePercent).toString()}%)` }}
          />
        </Progress.Root>
        <p
          className={`text-xs font-medium ${
            report.fullyCovered
              ? 'text-green-600 dark:text-green-400'
              : 'text-amber-600 dark:text-amber-400'
          }`}
        >
          {report.fullyCovered
            ? 'All intent goals are covered by requirements.'
            : `${report.gaps.length.toString()} intent ${report.gaps.length === 1 ? 'goal has' : 'goals have'} no supporting requirements.`}
        </p>
      </div>

      {/* Gaps */}
      {report.gaps.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Coverage Gaps ({report.gaps.length})
          </h4>
          {report.gaps.map((gap) => (
            <div
              key={gap.intentGoalId}
              className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-800/50 dark:bg-amber-900/10"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
              <div className="flex-1 space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    {gap.intentGoalId}
                  </span>
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    No requirements found
                  </span>
                </div>
                <p className="text-sm text-foreground">{gap.intentGoalDescription}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Covered goals */}
      {intentBrief && coveredGoalIds.size > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Covered Goals ({coveredGoalIds.size})
          </h4>
          {intentBrief.goals
            .filter((g) => coveredGoalIds.has(g.id))
            .map((goal) => (
              <div key={goal.id} className="flex items-start gap-2 rounded-lg border bg-card p-3">
                <CheckCircle
                  className="mt-0.5 h-4 w-4 shrink-0 text-green-500"
                  aria-hidden="true"
                />
                <div className="flex-1 space-y-0.5">
                  <span className="font-mono text-xs text-muted-foreground">{goal.id}</span>
                  <p className="text-sm text-foreground">{goal.description}</p>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* No intent brief */}
      {!intentBrief && (
        <p className="text-xs text-muted-foreground italic">
          Intent brief not loaded — load the parent brief for detailed goal coverage.
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        Last checked: {new Date(report.ranAt).toLocaleString()}
      </p>
    </div>
  );
}
