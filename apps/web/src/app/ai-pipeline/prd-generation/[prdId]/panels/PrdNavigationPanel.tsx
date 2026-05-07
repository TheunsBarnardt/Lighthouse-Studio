'use client';

import { CheckCircle, Clock, AlertCircle, Loader2, ChevronRight } from 'lucide-react';
import type { PrdSectionType, SectionStatus } from '@platform/core';

const SECTION_LABELS: Record<PrdSectionType, string> = {
  purpose: '1. Purpose',
  scope: '2. Scope',
  locked_decisions: '3. Locked Decisions',
  architectural_overview: '4. Architectural Overview',
  hard_parts: '5. The Hard Parts',
  component_specifications: '6. Component Specifications',
  implementation_order: '7. Implementation Order',
  adrs_to_write: '8. ADRs to Write',
  verification_steps: '9. Verification Steps',
  definition_of_done: '10. Definition of Done',
  anti_patterns: '11. Anti-Patterns',
  open_questions: '12. Open Questions',
  what_comes_next: '13. What Comes Next',
};

const SECTION_ORDER: PrdSectionType[] = [
  'purpose', 'scope', 'locked_decisions', 'architectural_overview', 'hard_parts',
  'component_specifications', 'implementation_order', 'adrs_to_write', 'verification_steps',
  'definition_of_done', 'anti_patterns', 'open_questions', 'what_comes_next',
];

function StatusIcon({ status }: { status: SectionStatus | 'pending' }) {
  switch (status) {
    case 'approved':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'generating':
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    case 'awaiting_approval':
      return <Clock className="h-4 w-4 text-yellow-500" />;
    case 'rejected':
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    default:
      return <div className="h-4 w-4 rounded-full border-2 border-neutral-300 dark:border-neutral-600" />;
  }
}

interface Props {
  sectionStatuses: Partial<Record<PrdSectionType, SectionStatus>>;
  selectedSection: PrdSectionType;
  onSelectSection: (section: PrdSectionType) => void;
  approvedCount: number;
}

export function PrdNavigationPanel({ sectionStatuses, selectedSection, onSelectSection, approvedCount }: Props) {
  return (
    <aside className="flex w-64 flex-shrink-0 flex-col border-r border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950">
      {/* Progress header */}
      <div className="border-b border-neutral-200 p-4 dark:border-neutral-800">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Progress
        </p>
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
            <div
              className="h-1.5 rounded-full bg-green-500 transition-all"
              style={{ width: `${Math.round((approvedCount / 13) * 100)}%` }}
            />
          </div>
          <span className="text-xs text-neutral-500">{approvedCount}/13</span>
        </div>
      </div>

      {/* Section list */}
      <nav className="flex-1 overflow-y-auto py-2">
        {SECTION_ORDER.map((sectionType) => {
          const status = sectionStatuses[sectionType] ?? 'pending';
          const isSelected = sectionType === selectedSection;

          return (
            <button
              key={sectionType}
              onClick={() => onSelectSection(sectionType)}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                isSelected
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                  : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-900'
              }`}
            >
              <StatusIcon status={status} />
              <span className="flex-1 truncate">{SECTION_LABELS[sectionType]}</span>
              {isSelected && <ChevronRight className="h-3 w-3 flex-shrink-0 opacity-50" />}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
