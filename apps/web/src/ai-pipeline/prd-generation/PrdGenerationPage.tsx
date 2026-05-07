'use client';

import type {
  PrdSectionType,
  PrdSectionContent,
  ConsistencyReport,
  TraceabilityReport,
  StalenessIndicator,
  PrdGenerationMetadata,
  ConsistencyIssue,
  ArtifactStatus,
  ReasoningRecord,
  IntentBrief,
} from '@platform/core';

import { PRD_SECTION_TYPES } from '@platform/core';
import * as Progress from '@radix-ui/react-progress';
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  Download,
  GitBranch,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { ConflictResolutionDialog } from './dialogs/ConflictResolutionDialog.js';
import { ExportDialog } from './dialogs/ExportDialog.js';
import { RegenerateAllDialog } from './dialogs/RegenerateAllDialog.js';
import { StalenessDialog } from './dialogs/StalenessDialog.js';
import { MetadataPanel } from './panels/MetadataPanel.js';
import { PrdNavigationPanel } from './panels/PrdNavigationPanel.js';
import { SectionViewPanel } from './panels/SectionViewPanel.js';
import { SECTION_DISPLAY_NAMES } from './utils/sectionMeta.js';

// ── Page-level data types ──────────────────────────────────────────────────────

export interface PrdSectionSummary {
  id: string;
  sectionType: PrdSectionType;
  status: ArtifactStatus;
  version: number;
  content: PrdSectionContent;
  reasoning: ReasoningRecord;
  updatedAt: string;
}

export interface PrdData {
  id: string;
  intentBriefId: string;
  sections: PrdSectionSummary[];
  consistencyReport?: ConsistencyReport;
  traceabilityReport?: TraceabilityReport;
  stalenessIndicators?: StalenessIndicator[];
  generationMetadata: PrdGenerationMetadata;
}

// ── Status utilities ────────────────────────────────────────────────────────────

type OverallStatus = 'all_approved' | 'in_progress' | 'needs_attention';

function computeOverallStatus(sections: PrdSectionSummary[]): OverallStatus {
  if (sections.length === 0) return 'in_progress';
  const allApproved = sections.every((s) => s.status === 'approved');
  if (allApproved) return 'all_approved';
  const hasIssues = sections.some((s) => s.status === 'rejected' || s.status === 'stale');
  if (hasIssues) return 'needs_attention';
  return 'in_progress';
}

const OVERALL_STATUS_CONFIG: Record<
  OverallStatus,
  { label: string; className: string; Icon: React.ElementType }
> = {
  all_approved: {
    label: 'All Approved',
    className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    Icon: CheckCircle,
  },
  in_progress: {
    label: 'In Progress',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    Icon: Clock,
  },
  needs_attention: {
    label: 'Needs Attention',
    className: 'bg-destructive/10 text-destructive',
    Icon: AlertTriangle,
  },
};

// ── Component ──────────────────────────────────────────────────────────────────

interface PrdGenerationPageProps {
  prdId: string;
}

export function PrdGenerationPage({ prdId }: PrdGenerationPageProps) {
  const [prd, setPrd] = useState<PrdData | null>(null);
  const [intentBrief, setIntentBrief] = useState<IntentBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatingSection, setGeneratingSection] = useState<{
    current: number;
    total: number;
    name: string;
  } | null>(null);
  const [activeSectionType, setActiveSectionType] = useState<PrdSectionType | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Dialog state
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [regenAllDialogOpen, setRegenAllDialogOpen] = useState(false);
  const [stalenessDialogOpen, setStalenessDialogOpen] = useState(false);
  const [conflictIssue, setConflictIssue] = useState<ConsistencyIssue | null>(null);

  // ── Data fetching ─────────────────────────────────────────────────────────

  const fetchPrd = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/ai/prd/${prdId}`);
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setError(body.error ?? `Failed to load PRD (${res.status.toString()})`);
        return;
      }
      const data = (await res.json()) as PrdData;
      setPrd(data);

      // Auto-select first section if nothing is selected
      if (!activeSectionType && data.sections.length > 0) {
        setActiveSectionType(data.sections[0]?.sectionType ?? null);
      }

      // Open staleness dialog if there are indicators
      if (data.stalenessIndicators && data.stalenessIndicators.length > 0) {
        setStalenessDialogOpen(true);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [prdId, activeSectionType]);

  const fetchIntentBrief = useCallback(async (intentBriefId: string) => {
    try {
      const res = await fetch(`/api/v1/ai/intent-brief/${intentBriefId}`);
      if (res.ok) {
        const data = (await res.json()) as IntentBrief;
        setIntentBrief(data);
      }
    } catch {
      // Non-fatal; traceability panel degrades gracefully
    }
  }, []);

  useEffect(() => {
    void fetchPrd();
  }, [fetchPrd]);

  useEffect(() => {
    if (prd?.intentBriefId) {
      void fetchIntentBrief(prd.intentBriefId);
    }
  }, [prd?.intentBriefId, fetchIntentBrief]);

  // ── Derived state ──────────────────────────────────────────────────────────

  const activeSection = prd?.sections.find((s) => s.sectionType === activeSectionType) ?? null;

  const approvedCount = prd?.sections.filter((s) => s.status === 'approved').length ?? 0;

  const overallStatus = prd ? computeOverallStatus(prd.sections) : 'in_progress';
  const statusConfig = OVERALL_STATUS_CONFIG[overallStatus];

  const prdTitle = intentBrief?.title ?? `PRD ${prdId}`;

  // ── Section actions ────────────────────────────────────────────────────────

  const patchSection = useCallback(
    async (sectionId: string, patch: Record<string, unknown>) => {
      const res = await fetch(`/api/v1/ai/prd/${prdId}/sections/${sectionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setError(body.error ?? 'Action failed');
      }
      await fetchPrd();
    },
    [prdId, fetchPrd],
  );

  const handleApprove = useCallback(async () => {
    if (!activeSection) return;
    await patchSection(activeSection.id, { action: 'approve' });
  }, [activeSection, patchSection]);

  const handleReject = useCallback(
    async (feedback: string) => {
      if (!activeSection) return;
      await patchSection(activeSection.id, { action: 'reject', feedback });
    },
    [activeSection, patchSection],
  );

  const handleRegenerate = useCallback(
    async (feedback?: string) => {
      if (!activeSection) return;
      setGenerating(true);
      setGeneratingSection({
        current: 1,
        total: 1,
        name: SECTION_DISPLAY_NAMES[activeSection.sectionType],
      });
      try {
        const res = await fetch(`/api/v1/ai/prd/${prdId}/sections/${activeSection.id}/regenerate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ feedback }),
        });
        if (!res.ok) {
          const body = (await res.json()) as { error?: string };
          setError(body.error ?? 'Regeneration failed');
        }
      } finally {
        setGenerating(false);
        setGeneratingSection(null);
        await fetchPrd();
      }
    },
    [activeSection, prdId, fetchPrd],
  );

  const handleEdit = useCallback(
    async (content: PrdSectionContent) => {
      if (!activeSection) return;
      await patchSection(activeSection.id, { action: 'edit', content });
    },
    [activeSection, patchSection],
  );

  const handleRegenerateAll = useCallback(async () => {
    setRegenAllDialogOpen(false);
    setGenerating(true);
    const total = PRD_SECTION_TYPES.length;
    try {
      let current = 0;
      for (const sectionType of PRD_SECTION_TYPES) {
        current += 1;
        setGeneratingSection({
          current,
          total,
          name: SECTION_DISPLAY_NAMES[sectionType],
        });
        await fetch(`/api/v1/ai/prd/${prdId}/regenerate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sections: [sectionType] }),
        });
      }
    } finally {
      setGenerating(false);
      setGeneratingSection(null);
      await fetchPrd();
    }
  }, [prdId, fetchPrd]);

  const handleRegenerateAffected = useCallback(async () => {
    setStalenessDialogOpen(false);
    if (!prd?.stalenessIndicators?.length) return;
    setGenerating(true);
    const affected = prd.stalenessIndicators.map((i) => i.sectionType);
    const total = affected.length;
    try {
      let current = 0;
      for (const sectionType of affected) {
        current += 1;
        setGeneratingSection({
          current,
          total,
          name: SECTION_DISPLAY_NAMES[sectionType],
        });
        await fetch(`/api/v1/ai/prd/${prdId}/regenerate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sections: [sectionType] }),
        });
      }
    } finally {
      setGenerating(false);
      setGeneratingSection(null);
      await fetchPrd();
    }
  }, [prd, prdId, fetchPrd]);

  const handleCheckConsistency = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/v1/ai/prd/${prdId}/check-consistency`, { method: 'POST' });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setError(body.error ?? 'Consistency check failed');
        return;
      }
      await fetchPrd();
    } catch (e) {
      setError(String(e));
    }
  }, [prdId, fetchPrd]);

  const handleCheckTraceability = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/v1/ai/prd/${prdId}/check-traceability`, { method: 'POST' });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setError(body.error ?? 'Traceability check failed');
        return;
      }
      await fetchPrd();
    } catch (e) {
      setError(String(e));
    }
  }, [prdId, fetchPrd]);

  const handleExport = useCallback(
    async (format: 'markdown' | 'pdf') => {
      setExportDialogOpen(false);
      try {
        const res = await fetch(`/api/v1/ai/prd/${prdId}/export`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ format }),
        });
        if (!res.ok) {
          const body = (await res.json()) as { error?: string };
          setError(body.error ?? 'Export failed');
          return;
        }
        const blob = await res.blob();
        const ext = format === 'pdf' ? 'pdf' : 'md';
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${prdTitle.replace(/\s+/g, '-').toLowerCase()}.${ext}`;
        anchor.click();
        URL.revokeObjectURL(url);
      } catch (e) {
        setError(String(e));
      }
    },
    [prdId, prdTitle],
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        <span className="text-sm">Loading PRD…</span>
      </div>
    );
  }

  if (error && !prd) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="rounded-lg border border-destructive bg-destructive/10 p-6 text-center">
          <p className="font-medium text-destructive">{error}</p>
          <button
            type="button"
            className="mt-3 rounded border px-3 py-1.5 text-sm hover:bg-muted"
            onClick={() => void fetchPrd()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const generatingProgressPercent = generatingSection
    ? Math.round((generatingSection.current / generatingSection.total) * 100)
    : 0;

  return (
    <div
      className="flex h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-lg border bg-card"
      aria-label="PRD Generation workspace"
    >
      {/* ── Top toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-3 border-b px-4 py-2.5">
        {/* Title + status */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <h1 className="truncate text-base font-semibold text-foreground" title={prdTitle}>
            {prdTitle}
          </h1>
          {prd && (
            <div
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusConfig.className}`}
            >
              <statusConfig.Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {statusConfig.label}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-2">
          {prd?.consistencyReport && !prd.consistencyReport.clean && (
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400"
              onClick={() => {
                const firstIssue = prd.consistencyReport?.issues.find((issue) => !issue.resolved);
                if (firstIssue) setConflictIssue(firstIssue);
              }}
              aria-label="View consistency issues"
            >
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
              {prd.consistencyReport.issues.filter((issue) => !issue.resolved).length} issue
              {prd.consistencyReport.issues.filter((issue) => !issue.resolved).length !== 1
                ? 's'
                : ''}
            </button>
          )}

          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs hover:bg-muted"
            onClick={() => void handleCheckConsistency()}
            aria-label="Check consistency"
          >
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            Check Consistency
          </button>

          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs hover:bg-muted"
            onClick={() => void handleCheckTraceability()}
            aria-label="Check traceability"
          >
            <GitBranch className="h-3.5 w-3.5" aria-hidden="true" />
            Check Traceability
          </button>

          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs hover:bg-muted"
            onClick={() => {
              setRegenAllDialogOpen(true);
            }}
            disabled={generating}
            aria-label="Regenerate all sections"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Regenerate All
          </button>

          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            onClick={() => {
              setExportDialogOpen(true);
            }}
            aria-label="Export PRD"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Export
          </button>
        </div>
      </div>

      {/* ── Generation progress bar ──────────────────────────────────────────── */}
      {generating && generatingSection && (
        <div
          className="flex shrink-0 items-center gap-3 border-b bg-primary/5 px-4 py-2"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden="true" />
          <div className="flex-1">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium text-primary">
                Section {generatingSection.current.toString()} of{' '}
                {generatingSection.total.toString()} generating…{' '}
                <span className="font-normal text-muted-foreground">{generatingSection.name}</span>
              </span>
              <span className="text-muted-foreground">{generatingProgressPercent.toString()}%</span>
            </div>
            <Progress.Root
              className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted"
              value={generatingProgressPercent}
              aria-label={`Generation progress: ${generatingProgressPercent.toString()}%`}
            >
              <Progress.Indicator
                className="h-full bg-primary transition-transform duration-300"
                style={{
                  transform: `translateX(-${(100 - generatingProgressPercent).toString()}%)`,
                }}
              />
            </Progress.Root>
          </div>
        </div>
      )}

      {/* ── Error banner ─────────────────────────────────────────────────────── */}
      {error && (
        <div
          className="flex shrink-0 items-center gap-2 border-b bg-destructive/10 px-4 py-2"
          role="alert"
        >
          <span className="text-xs text-destructive">{error}</span>
          <button
            type="button"
            className="ml-auto text-xs text-destructive hover:underline"
            onClick={() => {
              setError(null);
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Three-pane layout ─────────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left: navigation (20%) */}
        <aside
          className="w-[20%] min-w-[180px] shrink-0 overflow-hidden border-r"
          aria-label="Section navigation"
        >
          <PrdNavigationPanel
            sections={prd?.sections ?? []}
            activeSectionType={activeSectionType}
            onSelect={setActiveSectionType}
          />
        </aside>

        {/* Center: section view (55%) */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden" aria-label="Section content">
          <SectionViewPanel
            section={activeSection}
            onApprove={() => void handleApprove()}
            onReject={(feedback) => void handleReject(feedback)}
            onRegenerate={(feedback) => void handleRegenerate(feedback)}
            onEdit={(content) => void handleEdit(content)}
          />
        </main>

        {/* Right: metadata panel (25%) */}
        <aside
          className="w-[25%] min-w-[200px] shrink-0 overflow-hidden border-l"
          aria-label="Section metadata"
        >
          <MetadataPanel section={activeSection} prd={prd} />
        </aside>
      </div>

      {/* ── Dialogs ───────────────────────────────────────────────────────────── */}
      <ExportDialog
        open={exportDialogOpen}
        prdTitle={prdTitle}
        onExport={(format) => void handleExport(format)}
        onCancel={() => {
          setExportDialogOpen(false);
        }}
      />

      <RegenerateAllDialog
        open={regenAllDialogOpen}
        approvedCount={approvedCount}
        onConfirm={() => void handleRegenerateAll()}
        onCancel={() => {
          setRegenAllDialogOpen(false);
        }}
      />

      {prd?.stalenessIndicators && prd.stalenessIndicators.length > 0 && (
        <StalenessDialog
          open={stalenessDialogOpen}
          indicators={prd.stalenessIndicators}
          onRegenerateAffected={() => void handleRegenerateAffected()}
          onDismiss={() => {
            setStalenessDialogOpen(false);
          }}
        />
      )}

      {conflictIssue && (
        <ConflictResolutionDialog
          open={true}
          issue={conflictIssue}
          onResolve={(sectionType) => {
            setActiveSectionType(sectionType);
            setConflictIssue(null);
          }}
          onDismiss={() => {
            setConflictIssue(null);
          }}
        />
      )}
    </div>
  );
}
