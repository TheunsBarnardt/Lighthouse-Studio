'use client';

import { ShieldAlert, Check, X } from 'lucide-react';

interface PiiDetection {
  tableId: string;
  columnId: string;
  columnName: string;
  categories: string[];
  reasoning: string;
  confidence: 'high' | 'medium' | 'low';
}

interface PiiConfirmationPanelProps {
  detections: PiiDetection[];
  confirmations: { tableId: string; columnId: string; accepted: boolean }[];
  onConfirm: (tableId: string, columnId: string, accepted: boolean) => void;
}

export function PiiConfirmationPanel({ detections, confirmations, onConfirm }: PiiConfirmationPanelProps) {
  const pending = detections.filter(d =>
    !confirmations.some(c => c.tableId === d.tableId && c.columnId === d.columnId)
  );

  if (pending.length === 0) {
    return (
      <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-sm text-green-700">
        <Check className="w-4 h-4" /> All PII detections confirmed
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-gray-700">
        <ShieldAlert className="w-4 h-4 text-yellow-600" />
        PII Confirmation Required ({pending.length})
      </div>
      {pending.map(d => (
        <div key={`${d.tableId}-${d.columnId}`} className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs font-semibold text-gray-900">{d.columnName}</div>
              <div className="text-xs text-gray-500 mt-0.5">{d.categories.join(', ')}</div>
              <div className="text-xs text-gray-600 mt-1">{d.reasoning}</div>
              <div className={`mt-1 text-xs font-medium ${d.confidence === 'high' ? 'text-red-600' : d.confidence === 'medium' ? 'text-yellow-600' : 'text-gray-500'}`}>
                Confidence: {d.confidence}
              </div>
            </div>
            <div className="flex gap-1.5 flex-shrink-0">
              <button
                onClick={() => onConfirm(d.tableId, d.columnId, true)}
                className="p-1.5 rounded bg-green-100 text-green-700 hover:bg-green-200"
                title="Accept PII flag"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onConfirm(d.tableId, d.columnId, false)}
                className="p-1.5 rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
                title="Reject PII flag"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
