'use client';

import type {
  PrdSectionType,
  PrdSectionContent,
  ConsistencyReport,
  TraceabilityReport,
  StalenessIndicator,
  PrdGenerationMetadata,
  PrdQualitySignals,
} from '@platform/core';
import type { ReasoningRecord, ArtifactStatus } from '@platform/core';

import * as Tabs from '@radix-ui/react-tabs';
import { Brain, GitBranch, Clock, DollarSign, BarChart2 } from 'lucide-react';

import { QualityDashboardView } from '../views/QualityDashboardView.js';

interface PrdSectionSummary {
  id: string;
  sectionType: PrdSectionType;
  status: ArtifactStatus;
  version: number;
  content: PrdSectionContent;
  reasoning: ReasoningRecord;
  updatedAt: string;
}

interface PrdData {
  id: string;
  intentBriefId: string;
  sections: PrdSectionSummary[];
  consistencyReport?: ConsistencyReport;
  traceabilityReport?: TraceabilityReport;
  stalenessIndicators?: StalenessIndicator[];
  generationMetadata: PrdGenerationMetadata;
  qualitySignals?: PrdQualitySignals;
}

interface MetadataPanelProps {
  section: PrdSectionSummary | null;
  prd: PrdData | null;
}

export function MetadataPanel({ section, prd }: MetadataPanelProps) {
  return (
    <Tabs.Root defaultValue="reasoning" className="flex h-full flex-col">
      <Tabs.List className="flex shrink-0 border-b" aria-label="Section metadata tabs">
        {(
          [
            { value: 'reasoning', icon: Brain, label: 'Reasoning' },
            { value: 'traceability', icon: GitBranch, label: 'Traceability' },
            { value: 'history', icon: Clock, label: 'History' },
            { value: 'cost', icon: DollarSign, label: 'Cost' },
            { value: 'quality', icon: BarChart2, label: 'Quality' },
          ] as const
        ).map(({ value, icon: Icon, label }) => (
          <Tabs.Trigger
            key={value}
            value={value}
            className="flex flex-1 items-center justify-center gap-1 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary"
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>

      <div className="flex-1 overflow-y-auto">
        {/* Reasoning */}
        <Tabs.Content value="reasoning" className="p-3 space-y-4">
          {section ? (
            <>
              <div>
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Summary
                </h4>
                <p className="text-sm text-foreground">{section.reasoning.summary}</p>
              </div>

              {section.reasoning.steps.length > 0 && (
                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Reasoning Steps
                  </h4>
                  <ol className="space-y-1.5">
                    {section.reasoning.steps.map((step: string, i: number) => (
                      <li key={i} className="flex gap-2 text-xs text-foreground">
                        <span className="mt-0.5 shrink-0 rounded-full bg-muted px-1.5 py-0.5 font-mono text-muted-foreground">
                          {i + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              <div className="space-y-1">
                <Row label="Model" value={section.reasoning.model} />
                <Row label="Provider" value={section.reasoning.provider} />
                <Row label="Tokens in" value={section.reasoning.inputTokens.toLocaleString()} />
                <Row label="Tokens out" value={section.reasoning.outputTokens.toLocaleString()} />
                <Row label="Est. cost" value={`$${section.reasoning.costUsd.toFixed(4)}`} />
                <Row
                  label="Generated"
                  value={new Date(section.reasoning.generatedAt).toLocaleString()}
                />
              </div>
            </>
          ) : (
            <EmptyState>Select a section to see its reasoning metadata.</EmptyState>
          )}
        </Tabs.Content>

        {/* Traceability */}
        <Tabs.Content value="traceability" className="p-3 space-y-3">
          {section ? (
            <>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Traces To
              </h4>
              {/* Traceability refs are embedded in content — we pull them out generically */}
              <TraceabilityRefs content={section.content} sectionType={section.sectionType} />
            </>
          ) : (
            <EmptyState>Select a section to see its traceability links.</EmptyState>
          )}
        </Tabs.Content>

        {/* History */}
        <Tabs.Content value="history" className="p-3 space-y-3">
          {section ? (
            <>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Version History
              </h4>
              <div className="space-y-2">
                <div className="rounded-lg border bg-card p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground">
                      Version {section.version} (current)
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${getStatusClass(section.status)}`}
                    >
                      {section.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(section.updatedAt).toLocaleString()}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground italic">
                  Full version history will be available in a future release.
                </p>
              </div>
            </>
          ) : (
            <EmptyState>Select a section to see its history.</EmptyState>
          )}
        </Tabs.Content>

        {/* Cost */}
        <Tabs.Content value="cost" className="p-3 space-y-4">
          {section ? (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Section Cost
              </h4>
              <Row label="Cost" value={`$${section.reasoning.costUsd.toFixed(4)}`} />
              <Row label="Input tokens" value={section.reasoning.inputTokens.toLocaleString()} />
              <Row label="Output tokens" value={section.reasoning.outputTokens.toLocaleString()} />
            </div>
          ) : (
            <EmptyState>Select a section to see its cost breakdown.</EmptyState>
          )}

          {prd && (
            <div className="space-y-2 pt-2 border-t">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                PRD Total
              </h4>
              <Row
                label="Total cost"
                value={`$${prd.generationMetadata.totalCostUsd.toFixed(4)}`}
              />
              <Row
                label="Generation time"
                value={`${(prd.generationMetadata.totalGenerationTimeMs / 1000).toFixed(1)}s`}
              />
              {Object.entries(prd.generationMetadata.providersSummary).map(([provider, count]) => (
                <Row key={provider} label={`${provider} sections`} value={String(count)} />
              ))}
              {prd.generationMetadata.templateUsed && (
                <Row label="Template" value={prd.generationMetadata.templateUsed} />
              )}
            </div>
          )}
        </Tabs.Content>

        {/* Quality */}
        <Tabs.Content value="quality" className="p-3">
          {prd?.qualitySignals ? (
            <QualityDashboardView
              qualitySignals={prd.qualitySignals}
              generationMetadata={prd.generationMetadata}
            />
          ) : (
            <EmptyState>Quality signals are computed after all sections are approved.</EmptyState>
          )}
        </Tabs.Content>
      </div>
    </Tabs.Root>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-mono text-foreground truncate max-w-[60%] text-right">
        {value}
      </span>
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground italic">{children}</p>;
}

function getStatusClass(status: ArtifactStatus): string {
  const map: Record<ArtifactStatus, string> = {
    approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    in_review: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    draft: 'bg-muted text-muted-foreground',
    rejected: 'bg-destructive/10 text-destructive',
    stale: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    archived: 'bg-muted text-muted-foreground/50',
  };
  return map[status];
}

/**
 * Extracts traceability refs from content in a display-only way.
 * Iterates known content shapes without importing all sub-types explicitly.
 */
function TraceabilityRefs({
  content,
  sectionType,
}: {
  content: PrdSectionContent;
  sectionType: PrdSectionType;
}) {
  // We extract refs by duck-typing the content shapes
  const refs: Array<{ fieldPath: string; artifactId: string; type: string }> = [];

  const extractFromArray = (items: unknown[]) => {
    for (const item of items) {
      if (
        typeof item === 'object' &&
        item !== null &&
        'tracesTo' in item &&
        Array.isArray((item as Record<string, unknown>)['tracesTo'])
      ) {
        const tracesTo = (item as Record<string, unknown>)['tracesTo'] as Array<{
          type: string;
          artifactId: string;
          fieldPath: string;
        }>;
        for (const ref of tracesTo) {
          refs.push({ type: ref.type, artifactId: ref.artifactId, fieldPath: ref.fieldPath });
        }
      }
    }
  };

  const c = content as unknown as Record<string, unknown>;
  if (Array.isArray(c['goals'])) extractFromArray(c['goals'] as unknown[]);
  if (Array.isArray(c['personas'])) extractFromArray(c['personas'] as unknown[]);
  if (Array.isArray(c['stories'])) extractFromArray(c['stories'] as unknown[]);
  if (Array.isArray(c['requirements'])) extractFromArray(c['requirements'] as unknown[]);
  if (Array.isArray(c['risks'])) extractFromArray(c['risks'] as unknown[]);

  void sectionType;

  if (refs.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">No traceability refs in this section.</p>
    );
  }

  return (
    <div className="space-y-1.5">
      {refs.map((ref, i) => (
        <div key={i} className="rounded border bg-muted/30 px-2.5 py-1.5 space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground capitalize">
              {ref.type}
            </span>
          </div>
          <p className="font-mono text-xs text-muted-foreground truncate">{ref.fieldPath}</p>
        </div>
      ))}
    </div>
  );
}
