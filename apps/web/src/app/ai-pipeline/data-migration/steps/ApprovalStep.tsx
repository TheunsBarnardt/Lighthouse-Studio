'use client';

import { useState } from 'react';

interface ApprovalStepProps {
  planId: string;
  onApproved: () => void;
  onBack: () => void;
}

export function ApprovalStep({ planId, onApproved, onBack }: ApprovalStepProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [irreversibleAcknowledged, setIrreversibleAcknowledged] = useState(false);

  async function submit() {
    setIsSubmitting(true);
    await new Promise(r => setTimeout(r, 600));
    setIsSubmitting(false);
    setSubmitted(true);
    setTimeout(onApproved, 800);
  }

  return (
    <div className="p-6 max-w-xl mx-auto space-y-5">
      <div>
        <h2 className="text-base font-semibold text-foreground mb-1">Submit for Approval</h2>
        <p className="text-sm text-muted-foreground">
          Your migration plan requires approval before execution. In team workspaces, configured approvers receive a notification.
        </p>
      </div>

      <div className="border border-border rounded-lg divide-y divide-border">
        <div className="px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-foreground">Plan ID</span>
          <span className="text-xs font-mono text-muted-foreground">{planId.slice(0, 12)}…</span>
        </div>
        <div className="px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-foreground">Tables</span>
          <span className="text-sm text-muted-foreground">2</span>
        </div>
        <div className="px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-foreground">Estimated rows</span>
          <span className="text-sm text-muted-foreground">60,650</span>
        </div>
        <div className="px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-foreground">Tolerance mode</span>
          <span className="text-sm text-muted-foreground">Fail on batch error (5%)</span>
        </div>
      </div>

      <div className="border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 rounded-lg p-4 space-y-3">
        <p className="text-sm font-medium text-amber-900 dark:text-amber-200">Irreversible Operations</p>
        <p className="text-xs text-amber-700 dark:text-amber-300">
          This migration splits the <code>full_name</code> column into <code>first_name</code> + <code>last_name</code>.
          This split may be lossy if some names cannot be unambiguously parsed. After the 24-hour snapshot window,
          the original data cannot be recovered from this platform.
        </p>
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={irreversibleAcknowledged}
            onChange={e => setIrreversibleAcknowledged(e.target.checked)}
            className="mt-0.5"
          />
          <span className="text-xs text-amber-800 dark:text-amber-200">
            I understand these operations cannot be reversed after the snapshot retention window
          </span>
        </label>
      </div>

      {submitted ? (
        <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-md">
          <span className="text-sm text-green-800 dark:text-green-200 font-medium">
            Approved. Proceeding to execution…
          </span>
        </div>
      ) : (
        <div className="flex gap-3">
          <button onClick={onBack} className="px-4 py-2 text-sm border border-border rounded-md">Back</button>
          <button
            onClick={submit}
            disabled={isSubmitting || !irreversibleAcknowledged}
            className="px-4 py-2 bg-primary text-primary-foreground text-sm rounded-md disabled:opacity-50"
          >
            {isSubmitting ? 'Submitting…' : 'Submit for Approval'}
          </button>
        </div>
      )}
    </div>
  );
}
