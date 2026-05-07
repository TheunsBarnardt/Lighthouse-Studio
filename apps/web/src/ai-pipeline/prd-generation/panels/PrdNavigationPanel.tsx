'use client';

import type { PrdSectionType, ArtifactStatus } from '@platform/core';

import { CheckCircle, Clock, Pencil, XCircle, AlertTriangle } from 'lucide-react';

// ArtifactStatus is imported from the AI types file; we re-export the type alias here
// to avoid the need for importing from the core package in every consumer.
type Status = ArtifactStatus;

import { SECTION_DISPLAY_NAMES, PRD_SECTION_TYPES } from '../utils/sectionMeta.js';

interface PrdSectionSummary {
  id: string;
  sectionType: PrdSectionType;
  status: Status;
  version: number;
}

interface PrdNavigationPanelProps {
  sections: PrdSectionSummary[];
  activeSectionType: PrdSectionType | null;
  onSelect: (s: PrdSectionType) => void;
}

function StatusIcon({ status }: { status: Status }) {
  switch (status) {
    case 'approved':
      return <CheckCircle className="h-4 w-4 text-green-500" aria-label="Approved" />;
    case 'in_review':
      return <Clock className="h-4 w-4 text-amber-500" aria-label="In review" />;
    case 'draft':
      return <Pencil className="h-4 w-4 text-muted-foreground" aria-label="Draft" />;
    case 'rejected':
      return <XCircle className="h-4 w-4 text-destructive" aria-label="Rejected" />;
    case 'stale':
      return <AlertTriangle className="h-4 w-4 text-yellow-500" aria-label="Stale" />;
    case 'archived':
      return <XCircle className="h-4 w-4 text-muted-foreground/50" aria-label="Archived" />;
    default:
      return <Pencil className="h-4 w-4 text-muted-foreground" aria-label="Unknown status" />;
  }
}

export function PrdNavigationPanel({
  sections,
  activeSectionType,
  onSelect,
}: PrdNavigationPanelProps) {
  const sectionMap = new Map(sections.map((s) => [s.sectionType, s]));
  const approvedCount = sections.filter((s) => s.status === 'approved').length;

  return (
    <nav className="flex h-full flex-col" aria-label="PRD sections">
      <div className="border-b px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Sections
        </h2>
      </div>

      <ul className="flex-1 overflow-y-auto py-1" role="listbox" aria-label="PRD section list">
        {PRD_SECTION_TYPES.map((sectionType) => {
          const section = sectionMap.get(sectionType);
          const isActive = activeSectionType === sectionType;
          const status: Status = section?.status ?? 'draft';

          return (
            <li key={sectionType} role="option" aria-selected={isActive}>
              <button
                type="button"
                className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                  isActive ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'
                }`}
                onClick={() => {
                  onSelect(sectionType);
                }}
                aria-current={isActive ? 'page' : undefined}
              >
                <StatusIcon status={status} />
                <span className="flex-1 truncate text-sm">
                  {SECTION_DISPLAY_NAMES[sectionType]}
                </span>
                {section && (
                  <span className="shrink-0 text-xs text-muted-foreground">v{section.version}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {/* Progress footer */}
      <div className="border-t px-3 py-3">
        <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
          <span>Approved</span>
          <span className="font-medium text-foreground">
            {approvedCount} / {PRD_SECTION_TYPES.length}
          </span>
        </div>
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={approvedCount}
          aria-valuemin={0}
          aria-valuemax={PRD_SECTION_TYPES.length}
          aria-label={`${approvedCount.toString()} of ${PRD_SECTION_TYPES.length.toString()} sections approved`}
        >
          <div
            className="h-full bg-green-500 transition-all duration-500"
            style={{
              width: `${((approvedCount / PRD_SECTION_TYPES.length) * 100).toString()}%`,
            }}
          />
        </div>
      </div>
    </nav>
  );
}
