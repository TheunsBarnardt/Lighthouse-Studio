'use client';

import { X, Send, Users } from 'lucide-react';

interface SubmitForApprovalDialogProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export function SubmitForApprovalDialog({ onConfirm, onCancel }: SubmitForApprovalDialogProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Send className="w-5 h-5 text-green-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Submit for Approval
            </h2>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <Users className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Approval routing
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                This brief will be routed for approval based on your workspace configuration.
              </p>
            </div>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400">
            Once submitted, approvers will be notified. You won&apos;t be able to edit the brief
            while it&apos;s awaiting approval.
          </p>
        </div>

        <div className="flex gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onCancel}
            className="flex-1 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg"
          >
            Submit for Approval
          </button>
        </div>
      </div>
    </div>
  );
}
