'use client';

import type { BriefDraft } from '@platform/core';

import { X, AlertCircle, FileText } from 'lucide-react';

interface GenerateBriefDialogProps {
  briefDraft: BriefDraft | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function GenerateBriefDialog({ briefDraft, onConfirm, onCancel }: GenerateBriefDialogProps) {
  const tentativeCount = briefDraft
    ? Object.values(briefDraft.fieldStates).filter((s) => s.status === 'tentative').length
    : 0;
  const hasWarnings = tentativeCount > 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Generate Brief
            </h2>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {hasWarnings && (
            <div className="flex items-start gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <AlertCircle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                  {tentativeCount} tentative {tentativeCount === 1 ? 'field' : 'fields'}
                </p>
                <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-0.5">
                  Some fields were captured with low confidence. The AI will do its best to fill
                  them in, but you can edit the brief afterward.
                </p>
              </div>
            </div>
          )}

          <p className="text-sm text-gray-600 dark:text-gray-400">
            This will generate a structured Intent Brief from your conversation. You&apos;ll be able
            to review and edit it before submitting for approval.
          </p>

          {briefDraft && (
            <div className="text-xs text-gray-500 space-y-1 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
              <div className="flex justify-between">
                <span>Goals captured</span>
                <span className="font-medium">{briefDraft.goals.length}</span>
              </div>
              <div className="flex justify-between">
                <span>User personas</span>
                <span className="font-medium">{briefDraft.targetUsers.length}</span>
              </div>
              <div className="flex justify-between">
                <span>In-scope items</span>
                <span className="font-medium">{briefDraft.inScope.length}</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onCancel}
            className="flex-1 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Continue Conversation
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
          >
            Generate Brief
          </button>
        </div>
      </div>
    </div>
  );
}
