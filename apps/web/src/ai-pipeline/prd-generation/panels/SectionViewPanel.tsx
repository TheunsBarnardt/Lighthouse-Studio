'use client';

import type { PrdSectionType, PrdSectionContent, ArtifactStatus } from '@platform/core';
import type { ReasoningRecord } from '@platform/core';

import { CheckCircle, XCircle, RefreshCw, Pencil, Lock, AlertTriangle } from 'lucide-react';
import { useState } from 'react';

import { RegenerateSectionDialog } from '../dialogs/RegenerateSectionDialog.js';
import { SECTION_DISPLAY_NAMES } from '../utils/sectionMeta.js';
import { SectionMarkdownView } from '../views/SectionMarkdownView.js';
import { SectionStructuredView } from '../views/SectionStructuredView.js';

interface PrdSectionSummary {
  id: string;
  sectionType: PrdSectionType;
  status: ArtifactStatus;
  version: number;
  content: PrdSectionContent;
  reasoning: ReasoningRecord;
  updatedAt: string;
}

interface SectionViewPanelProps {
  section: PrdSectionSummary | null;
  onApprove: () => void;
  onReject: (feedback: string) => void;
  onRegenerate: (feedback?: string) => void;
  onEdit: (content: PrdSectionContent) => void;
}

const STATUS_BADGE: Record<ArtifactStatus, { label: string; className: string }> = {
  approved: {
    label: 'Approved',
    className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  in_review: {
    label: 'In Review',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  },
  draft: {
    label: 'Draft',
    className: 'bg-muted text-muted-foreground',
  },
  rejected: {
    label: 'Rejected',
    className: 'bg-destructive/10 text-destructive',
  },
  stale: {
    label: 'Stale',
    className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  archived: {
    label: 'Archived',
    className: 'bg-muted text-muted-foreground/50',
  },
};

function StatusBadge({ status }: { status: ArtifactStatus }) {
  const { label, className } = STATUS_BADGE[status];
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>{label}</span>
  );
}

export function SectionViewPanel({
  section,
  onApprove,
  onReject,
  onRegenerate,
  onEdit,
}: SectionViewPanelProps) {
  const [viewMode, setViewMode] = useState<'structured' | 'markdown'>('structured');
  const [editing, setEditing] = useState(false);
  const [rejectFeedback, setRejectFeedback] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [regenDialogOpen, setRegenDialogOpen] = useState(false);
  const [editContent, setEditContent] = useState<PrdSectionContent | null>(null);
  const [editApproveWarning, setEditApproveWarning] = useState(false);

  if (!section) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <div className="rounded-full bg-muted p-4">
          <Pencil className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        </div>
        <div>
          <p className="font-medium text-foreground">No section selected</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Select a section from the navigation panel to view and edit its content.
          </p>
        </div>
      </div>
    );
  }

  const isApproved = section.status === 'approved';
  const effectiveContent = editContent ?? section.content;

  const handleEditToggle = () => {
    if (editing) {
      // Save
      if (editContent) {
        onEdit(editContent);
      }
      setEditing(false);
      setEditContent(null);
      setEditApproveWarning(false);
    } else {
      if (isApproved) {
        setEditApproveWarning(true);
      } else {
        setEditing(true);
        setEditContent(section.content);
        setEditApproveWarning(false);
      }
    }
  };

  const handleConfirmEditApproved = () => {
    setEditing(true);
    setEditContent(section.content);
    setEditApproveWarning(false);
  };

  const handleApprove = () => {
    if (editing) {
      if (editContent) onEdit(editContent);
      setEditing(false);
      setEditContent(null);
    }
    onApprove();
  };

  const handleReject = () => {
    if (!showRejectInput) {
      setShowRejectInput(true);
    } else {
      onReject(rejectFeedback);
      setRejectFeedback('');
      setShowRejectInput(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Section header */}
      <div className="border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-foreground">
            {SECTION_DISPLAY_NAMES[section.sectionType]}
          </h2>
          <StatusBadge status={section.status} />
          <span className="text-xs text-muted-foreground">v{section.version}</span>
          <span className="ml-auto text-xs text-muted-foreground">
            Updated {new Date(section.updatedAt).toLocaleString()}
          </span>
        </div>

        {/* View toggle */}
        <div className="mt-2 flex gap-1">
          <button
            type="button"
            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${viewMode === 'structured' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}
            onClick={() => {
              setViewMode('structured');
            }}
            aria-pressed={viewMode === 'structured'}
          >
            Structured
          </button>
          <button
            type="button"
            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${viewMode === 'markdown' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}
            onClick={() => {
              setViewMode('markdown');
            }}
            aria-pressed={viewMode === 'markdown'}
          >
            Markdown
          </button>
        </div>
      </div>

      {/* Approved-edit warning */}
      {editApproveWarning && (
        <div className="flex items-center gap-2 border-b bg-amber-50 px-4 py-2 dark:bg-amber-900/20">
          <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />
          <p className="flex-1 text-sm text-amber-700 dark:text-amber-400">
            This section is approved. Editing will require re-approval.
          </p>
          <button
            type="button"
            className="rounded border border-amber-400 px-2 py-0.5 text-xs text-amber-700 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-900/30"
            onClick={handleConfirmEditApproved}
          >
            Edit anyway
          </button>
          <button
            type="button"
            className="rounded px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              setEditApproveWarning(false);
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Editing banner */}
      {editing && (
        <div className="flex items-center gap-2 border-b bg-primary/5 px-4 py-1.5">
          <Pencil className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          <span className="text-xs font-medium text-primary">Editing — unsaved changes</span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {viewMode === 'structured' ? (
          <SectionStructuredView
            sectionType={section.sectionType}
            content={effectiveContent}
            editable={editing}
            onChange={(c) => {
              setEditContent(c);
            }}
          />
        ) : (
          <SectionMarkdownView
            content={effectiveContent}
            sectionType={section.sectionType}
            editable={editing}
            onChange={() => {
              // Markdown-to-struct parsing is out of scope; keep as-is for now
            }}
          />
        )}
      </div>

      {/* Reject feedback input */}
      {showRejectInput && (
        <div className="border-t px-4 py-2 space-y-2">
          <label htmlFor="reject-feedback" className="text-xs font-medium text-muted-foreground">
            Rejection feedback (optional)
          </label>
          <textarea
            id="reject-feedback"
            className="w-full rounded border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            rows={2}
            placeholder="Describe what needs to change…"
            value={rejectFeedback}
            onChange={(e) => {
              setRejectFeedback(e.target.value);
            }}
          />
        </div>
      )}

      {/* Action toolbar */}
      <div className="flex items-center gap-2 border-t px-4 py-2.5">
        {/* Approve */}
        <button
          type="button"
          className="flex items-center gap-1.5 rounded bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          onClick={handleApprove}
          disabled={section.status === 'approved' && !editing}
          aria-label="Approve section"
        >
          <CheckCircle className="h-4 w-4" aria-hidden="true" />
          {section.status === 'approved' ? 'Re-approve' : 'Approve'}
        </button>

        {/* Reject */}
        <button
          type="button"
          className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors ${showRejectInput ? 'bg-destructive text-white hover:bg-destructive/90' : 'border border-destructive text-destructive hover:bg-destructive/10'}`}
          onClick={handleReject}
          aria-label={showRejectInput ? 'Confirm rejection' : 'Reject section'}
        >
          <XCircle className="h-4 w-4" aria-hidden="true" />
          {showRejectInput ? 'Confirm Reject' : 'Reject'}
        </button>

        {showRejectInput && (
          <button
            type="button"
            className="rounded border px-3 py-1.5 text-sm hover:bg-muted"
            onClick={() => {
              setShowRejectInput(false);
              setRejectFeedback('');
            }}
          >
            Cancel
          </button>
        )}

        {/* Regenerate */}
        <button
          type="button"
          className="flex items-center gap-1.5 rounded border px-3 py-1.5 text-sm hover:bg-muted"
          onClick={() => {
            setRegenDialogOpen(true);
          }}
          aria-label="Regenerate section"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Regenerate
        </button>

        {/* Edit */}
        <button
          type="button"
          className={`ml-auto flex items-center gap-1.5 rounded border px-3 py-1.5 text-sm transition-colors ${
            editing
              ? 'border-primary bg-primary/10 text-primary hover:bg-primary/20'
              : 'hover:bg-muted'
          }`}
          onClick={handleEditToggle}
          aria-label={editing ? 'Save edit' : 'Edit section'}
          aria-pressed={editing}
        >
          {isApproved && !editing ? (
            <Lock className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Pencil className="h-4 w-4" aria-hidden="true" />
          )}
          {editing ? 'Save' : 'Edit'}
        </button>
      </div>

      {/* Regenerate dialog */}
      <RegenerateSectionDialog
        open={regenDialogOpen}
        sectionType={section.sectionType}
        onConfirm={(feedback) => {
          setRegenDialogOpen(false);
          onRegenerate(feedback || undefined);
        }}
        onCancel={() => {
          setRegenDialogOpen(false);
        }}
      />
    </div>
  );
}
