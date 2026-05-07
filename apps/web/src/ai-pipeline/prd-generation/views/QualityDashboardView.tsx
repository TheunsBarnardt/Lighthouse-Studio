'use client';

import type { PrdQualitySignals, PrdGenerationMetadata } from '@platform/core';

import * as Progress from '@radix-ui/react-progress';
import { CheckCircle, AlertTriangle } from 'lucide-react';

// ── Props ──────────────────────────────────────────────────────────────────────

interface QualityDashboardViewProps {
  qualitySignals: PrdQualitySignals;
  generationMetadata: PrdGenerationMetadata;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function QualityDashboardView({
  qualitySignals,
  generationMetadata,
}: QualityDashboardViewProps) {
  const totalSections = 10;

  // Derived display values
  const costDisplay = `$${generationMetadata.totalCostUsd.toFixed(2)}`;
  const totalMs = generationMetadata.totalGenerationTimeMs;
  const minutes = Math.floor(totalMs / 60_000);
  const seconds = Math.floor((totalMs % 60_000) / 1_000);
  const timeDisplay =
    minutes > 0 ? `${minutes.toString()}m ${seconds.toString()}s` : `${seconds.toString()}s`;

  const approvalPct = Math.round((qualitySignals.sectionsAcceptedFirstPass / totalSections) * 100);

  const totalIntentGoals = qualitySignals.intentGoalsCovered + qualitySignals.intentGoalsUncovered;
  const traceabilityPct =
    totalIntentGoals > 0
      ? Math.round((qualitySignals.intentGoalsCovered / totalIntentGoals) * 100)
      : 0;
  const traceabilityFullyCovered = qualitySignals.intentGoalsUncovered === 0;

  const hasUnresolvedConsistency =
    qualitySignals.consistencyIssuesFound > 0 &&
    qualitySignals.consistencyIssuesFound > qualitySignals.consistencyIssuesResolved;

  return (
    <div className="space-y-5">
      {/* Generation summary row */}
      <div className="grid grid-cols-3 gap-2">
        <SummaryCard label="Total cost" value={costDisplay} />
        <SummaryCard label="Generation time" value={timeDisplay} />
        <SummaryCard label="Sections generated" value={String(totalSections)} />
      </div>

      {/* Section quality grid */}
      <section aria-label="Section quality">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Section Quality
        </h4>
        <div className="grid grid-cols-2 gap-2">
          <StatCard
            label="Accepted first pass"
            value={`${qualitySignals.sectionsAcceptedFirstPass.toString()} / ${totalSections.toString()}`}
            badge="green"
          />
          <StatCard
            label="Needed revision"
            value={String(qualitySignals.sectionsRejectedAtLeastOnce)}
            badge="amber"
          />
          <StatCard
            label="Total revisions"
            value={String(qualitySignals.totalSectionRevisions)}
            badge="gray"
          />
          <div className="rounded-lg border bg-card p-3 space-y-2">
            <p className="text-xs text-muted-foreground">Overall approval</p>
            <div className="space-y-1">
              <Progress.Root
                className="relative h-2 w-full overflow-hidden rounded-full bg-muted"
                value={approvalPct}
                aria-label={`Overall approval: ${approvalPct.toString()}%`}
              >
                <Progress.Indicator
                  className="h-full bg-green-500 transition-all duration-300"
                  style={{ width: `${approvalPct.toString()}%` }}
                />
              </Progress.Root>
              <p className="text-xs font-mono text-foreground">{approvalPct.toString()}%</p>
            </div>
          </div>
        </div>
      </section>

      {/* Consistency section */}
      <section aria-label="Consistency">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Consistency
        </h4>
        <div className="rounded-lg border bg-card p-3 space-y-2">
          {qualitySignals.consistencyIssuesFound === 0 ? (
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" aria-hidden="true" />
              <span className="text-sm text-green-700 dark:text-green-400">
                No consistency issues found.
              </span>
            </div>
          ) : (
            <div
              className={`flex items-center gap-2 ${hasUnresolvedConsistency ? 'text-amber-700 dark:text-amber-400' : 'text-green-700 dark:text-green-400'}`}
            >
              {hasUnresolvedConsistency ? (
                <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />
              ) : (
                <CheckCircle className="h-4 w-4 text-green-500" aria-hidden="true" />
              )}
              <span className="text-sm">
                {hasUnresolvedConsistency
                  ? `${(qualitySignals.consistencyIssuesFound - qualitySignals.consistencyIssuesResolved).toString()} unresolved issue(s)`
                  : 'All issues resolved'}
              </span>
            </div>
          )}
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>Found: {qualitySignals.consistencyIssuesFound.toString()}</span>
            <span>Resolved: {qualitySignals.consistencyIssuesResolved.toString()}</span>
          </div>
        </div>
      </section>

      {/* Traceability coverage */}
      <section aria-label="Traceability coverage">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Traceability Coverage
        </h4>
        <div className="rounded-lg border bg-card p-3 space-y-2">
          <div className="space-y-1">
            <Progress.Root
              className="relative h-2 w-full overflow-hidden rounded-full bg-muted"
              value={traceabilityPct}
              aria-label={`Traceability coverage: ${traceabilityPct.toString()}%`}
            >
              <Progress.Indicator
                className={`h-full transition-all duration-300 ${traceabilityFullyCovered ? 'bg-green-500' : 'bg-red-500'}`}
                style={{ width: `${traceabilityPct.toString()}%` }}
              />
            </Progress.Root>
            <p className="text-xs text-muted-foreground">
              {qualitySignals.intentGoalsCovered.toString()} of {totalIntentGoals.toString()} intent
              goal
              {totalIntentGoals !== 1 ? 's' : ''} covered
            </p>
          </div>
          {!traceabilityFullyCovered && (
            <p className="text-xs text-red-600 dark:text-red-400">
              {qualitySignals.intentGoalsUncovered.toString()} goal
              {qualitySignals.intentGoalsUncovered !== 1 ? 's' : ''} not covered by any requirement.
            </p>
          )}
        </div>
      </section>

      {/* Downstream status */}
      <section aria-label="Downstream status">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Downstream Status
        </h4>
        {qualitySignals.causedDownstreamRejection ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-900/20">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
            <p className="text-sm text-amber-700 dark:text-amber-400">
              This PRD caused a downstream stage rejection.
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 dark:border-green-800 dark:bg-green-900/20">
            <CheckCircle className="h-4 w-4 text-green-500" aria-hidden="true" />
            <p className="text-sm text-green-700 dark:text-green-400">No downstream rejections.</p>
          </div>
        )}
      </section>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3 space-y-0.5 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold font-mono text-foreground">{value}</p>
    </div>
  );
}

type BadgeVariant = 'green' | 'amber' | 'gray';

function StatCard({ label, value, badge }: { label: string; value: string; badge: BadgeVariant }) {
  const badgeClass: Record<BadgeVariant, string> = {
    green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    gray: 'bg-muted text-muted-foreground',
  };

  return (
    <div className="rounded-lg border bg-card p-3 flex items-center justify-between gap-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-semibold font-mono ${badgeClass[badge]}`}
      >
        {value}
      </span>
    </div>
  );
}
