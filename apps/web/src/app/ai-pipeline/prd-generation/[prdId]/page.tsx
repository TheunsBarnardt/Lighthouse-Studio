'use client';

import { useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Download, ShieldAlert, CheckCheck } from 'lucide-react';

import type { PrdSectionType, SectionStatus, PrdSection, ConsistencyReport, TraceabilityReport, StalenessReport } from '@platform/core';
import { PRD_SECTION_TYPES } from '@platform/core';

import { PrdNavigationPanel } from './panels/PrdNavigationPanel';
import { SectionViewPanel } from './panels/SectionViewPanel';
import { MetadataPanel } from './panels/MetadataPanel';
import { ExportDialog } from './dialogs/ExportDialog';
import { StalenessDialog } from './dialogs/StalenessDialog';

type SectionMap = Partial<Record<PrdSectionType, PrdSection>>;

export default function PrdViewerPage() {
  const params = useParams<{ prdId: string }>();
  const prdId = params.prdId;

  const [sections, setSections] = useState<SectionMap>({});
  const [selectedSection, setSelectedSection] = useState<PrdSectionType>('purpose');
  const [consistencyReport, setConsistencyReport] = useState<ConsistencyReport | undefined>();
  const [traceabilityReport, setTraceabilityReport] = useState<TraceabilityReport | undefined>();
  const [stalenessReport, setStalenessReport] = useState<StalenessReport | undefined>();
  const [showExport, setShowExport] = useState(false);
  const [showStaleness, setShowStaleness] = useState(false);
  const [runningChecks, setRunningChecks] = useState(false);

  const sectionStatuses = Object.fromEntries(
    PRD_SECTION_TYPES.map((t) => [t, sections[t]?.status ?? 'pending']),
  ) as Record<PrdSectionType, SectionStatus>;

  const approvedCount = Object.values(sectionStatuses).filter((s) => s === 'approved').length;
  const currentSection = sections[selectedSection] ?? null;

  const handleApprove = useCallback(async () => {
    const res = await fetch(`/api/v1/prd/${prdId}/sections/${selectedSection}/approve`, { method: 'POST' });
    if (!res.ok) return;
    const updated = (await res.json()) as PrdSection;
    setSections((prev) => ({ ...prev, [selectedSection]: updated }));
  }, [prdId, selectedSection]);

  const handleRegenerate = useCallback(async (feedback?: string) => {
    const res = await fetch(`/api/v1/prd/${prdId}/sections/${selectedSection}/regenerate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedback }),
    });
    if (!res.ok) return;
    const updated = (await res.json()) as PrdSection;
    setSections((prev) => ({ ...prev, [selectedSection]: updated }));
  }, [prdId, selectedSection]);

  const handleRunChecks = async () => {
    setRunningChecks(true);
    try {
      const [cr, tr] = await Promise.all([
        fetch(`/api/v1/prd/${prdId}/consistency-check`, { method: 'POST' }).then((r) => r.json() as Promise<ConsistencyReport>),
        fetch(`/api/v1/prd/${prdId}/traceability-check`, { method: 'POST' }).then((r) => r.json() as Promise<TraceabilityReport>),
      ]);
      setConsistencyReport(cr);
      setTraceabilityReport(tr);
    } finally {
      setRunningChecks(false);
    }
  };

  const handleCheckStaleness = async () => {
    const res = await fetch(`/api/v1/prd/${prdId}/staleness`, { method: 'POST' });
    if (!res.ok) return;
    const report = (await res.json()) as StalenessReport;
    setStalenessReport(report);
    if (report.isStale) setShowStaleness(true);
  };

  const handleRegenerateAffected = async () => {
    const res = await fetch(`/api/v1/prd/${prdId}/regenerate-affected`, { method: 'POST' });
    if (!res.ok) return;
    const updated = (await res.json()) as PrdSection[];
    setSections((prev) => {
      const next = { ...prev };
      for (const s of updated) next[s.sectionType] = s;
      return next;
    });
  };

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-3 dark:border-neutral-800">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">PRD Review</h1>
          {approvedCount === 13 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
              <CheckCheck className="h-3 w-3" />
              Fully Approved
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRunChecks}
            disabled={runningChecks}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            {runningChecks ? 'Checking…' : 'Run Checks'}
          </button>
          <button
            onClick={() => setShowExport(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
        </div>
      </div>

      {/* Three-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        <PrdNavigationPanel
          sectionStatuses={sectionStatuses}
          selectedSection={selectedSection}
          onSelectSection={setSelectedSection}
          approvedCount={approvedCount}
        />
        <SectionViewPanel
          section={currentSection}
          sectionType={selectedSection}
          onApprove={handleApprove}
          onRegenerate={handleRegenerate}
        />
        <MetadataPanel
          consistencyReport={consistencyReport}
          traceabilityReport={traceabilityReport}
          sectionVersion={currentSection?.currentVersion}
        />
      </div>

      {showExport && <ExportDialog prdId={prdId} onClose={() => setShowExport(false)} />}
      {showStaleness && stalenessReport && (
        <StalenessDialog
          report={stalenessReport}
          onRegenerateAffected={handleRegenerateAffected}
          onClose={() => setShowStaleness(false)}
        />
      )}
    </div>
  );
}
