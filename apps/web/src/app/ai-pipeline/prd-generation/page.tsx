'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FileText, Plus, ChevronRight, CheckCircle, Clock, AlertCircle } from 'lucide-react';

interface PrdListItem {
  id: string;
  intentBriefId: string;
  intentBriefTitle: string;
  totalSections: number;
  approvedSections: number;
  isFullyApproved: boolean;
  createdAt: string;
}

function statusBadge(item: PrdListItem) {
  if (item.isFullyApproved) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300">
        <CheckCircle className="h-3 w-3" />
        Approved
      </span>
    );
  }
  if (item.approvedSections === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
        <Clock className="h-3 w-3" />
        In review
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
      <AlertCircle className="h-3 w-3" />
      {item.approvedSections}/{item.totalSections} sections
    </span>
  );
}

export default function PrdGenerationListPage() {
  const [prds] = useState<PrdListItem[]>([]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4 dark:border-neutral-800">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
            PRD Generation
          </h1>
          <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
            Stage 2 · Generate product requirements documents from approved intent briefs
          </p>
        </div>
        <Link
          href="/ai-pipeline/intent-capture"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Generate PRD
        </Link>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {prds.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-neutral-200 py-20 text-center dark:border-neutral-700">
            <FileText className="mb-4 h-10 w-10 text-neutral-400" />
            <p className="text-base font-medium text-neutral-700 dark:text-neutral-300">No PRDs yet</p>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Approve an intent brief, then generate a PRD from it.
            </p>
            <Link
              href="/ai-pipeline/intent-capture"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Go to Intent Capture
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {prds.map((prd) => (
              <Link
                key={prd.id}
                href={`/ai-pipeline/prd-generation/${prd.id}`}
                className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-4 hover:border-blue-300 hover:bg-blue-50/50 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-blue-700"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 flex-shrink-0 text-neutral-400" />
                  <div>
                    <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      {prd.intentBriefTitle}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {new Date(prd.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {statusBadge(prd)}
                  <ChevronRight className="h-4 w-4 text-neutral-400" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
