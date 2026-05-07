'use client';

import { useState } from 'react';
import { CheckCircle, RefreshCw, Edit2, Send, X } from 'lucide-react';
import type { PrdSection, PrdSectionType, SectionStatus } from '@platform/core';

const SECTION_TITLES: Record<PrdSectionType, string> = {
  purpose: 'Purpose',
  scope: 'Scope',
  locked_decisions: 'Locked Decisions',
  architectural_overview: 'Architectural Overview',
  hard_parts: 'The Hard Parts',
  component_specifications: 'Component Specifications',
  implementation_order: 'Implementation Order',
  adrs_to_write: 'ADRs to Write',
  verification_steps: 'Verification Steps',
  definition_of_done: 'Definition of Done',
  anti_patterns: 'Anti-Patterns to Refuse',
  open_questions: 'Open Questions',
  what_comes_next: 'What Comes Next',
};

interface Props {
  section: PrdSection | null;
  sectionType: PrdSectionType;
  onApprove: () => Promise<void>;
  onRegenerate: (feedback?: string) => Promise<void>;
}

function StatusBar({ status }: { status: SectionStatus }) {
  const labels: Record<SectionStatus, { label: string; cls: string }> = {
    pending: { label: 'Pending', cls: 'text-neutral-500' },
    generating: { label: 'Generating…', cls: 'text-blue-500' },
    draft: { label: 'Draft', cls: 'text-yellow-600 dark:text-yellow-400' },
    awaiting_approval: { label: 'Awaiting Approval', cls: 'text-orange-600' },
    approved: { label: 'Approved', cls: 'text-green-600 dark:text-green-400' },
    rejected: { label: 'Rejected', cls: 'text-red-600' },
  };
  const { label, cls } = labels[status] ?? labels.pending;
  return <span className={`text-xs font-medium ${cls}`}>{label}</span>;
}

export function SectionViewPanel({ section, sectionType, onApprove, onRegenerate }: Props) {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);

  const handleApprove = async () => {
    setLoading(true);
    try { await onApprove(); } finally { setLoading(false); }
  };

  const handleRegenerate = async () => {
    setLoading(true);
    try {
      await onRegenerate(feedback.trim() || undefined);
      setFeedback('');
      setFeedbackOpen(false);
    } finally { setLoading(false); }
  };

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      {/* Section header */}
      <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4 dark:border-neutral-800">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            {SECTION_TITLES[sectionType]}
          </h2>
          {section && <StatusBar status={section.status} />}
        </div>
        {section && section.status !== 'approved' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFeedbackOpen((o) => !o)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Regenerate
            </button>
            <button
              onClick={handleApprove}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              <CheckCircle className="h-3.5 w-3.5" />
              Approve
            </button>
          </div>
        )}
        {section?.status === 'approved' && (
          <div className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
            <CheckCircle className="h-4 w-4" />
            Approved
          </div>
        )}
      </div>

      {/* Feedback input */}
      {feedbackOpen && (
        <div className="border-b border-neutral-200 bg-neutral-50 px-6 py-3 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                Feedback for regeneration (optional)
              </label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={2}
                placeholder="e.g. Make the tone more formal, add more detail about X…"
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setFeedbackOpen(false); setFeedback(''); }}
                className="rounded-lg border border-neutral-200 p-2 text-neutral-500 hover:bg-neutral-100 dark:border-neutral-700"
              >
                <X className="h-4 w-4" />
              </button>
              <button
                onClick={handleRegenerate}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                Regenerate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Section content */}
      <div className="flex-1 overflow-y-auto p-6">
        {!section ? (
          <div className="flex items-center justify-center py-20 text-center text-neutral-500">
            <p className="text-sm">This section has not been generated yet.</p>
          </div>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <pre className="overflow-x-auto rounded-lg bg-neutral-50 p-4 text-xs dark:bg-neutral-900">
              {JSON.stringify(section.content, null, 2)}
            </pre>
            {section.reasoning && (
              <details className="mt-4">
                <summary className="cursor-pointer text-xs font-medium text-neutral-500">AI Reasoning</summary>
                <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">{section.reasoning}</p>
              </details>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
