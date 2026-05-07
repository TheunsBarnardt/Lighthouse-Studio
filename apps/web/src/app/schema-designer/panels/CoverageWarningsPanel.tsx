'use client';

import { AlertTriangle, CheckCircle } from 'lucide-react';

interface CoverageWarning {
  entityName: string;
  reason: string;
}

interface CoverageWarningsPanelProps {
  gaps: CoverageWarning[];
  coverageRate: number;
}

export function CoverageWarningsPanel({ gaps, coverageRate }: CoverageWarningsPanelProps) {
  if (gaps.length === 0) {
    return (
      <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-sm text-green-700">
        <CheckCircle className="w-4 h-4" />
        Full PRD coverage — all entities have tables ({Math.round(coverageRate * 100)}%)
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-gray-700">
        <AlertTriangle className="w-4 h-4 text-yellow-600" />
        Coverage gaps ({gaps.length}) — {Math.round(coverageRate * 100)}% covered
      </div>
      <div className="text-xs text-gray-500">
        These PRD entities have no corresponding table. Add them if the data needs to be stored.
      </div>
      {gaps.map((gap, i) => (
        <div key={i} className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="text-xs font-semibold text-gray-900">{gap.entityName}</div>
          <div className="text-xs text-gray-600 mt-0.5">{gap.reason}</div>
        </div>
      ))}
    </div>
  );
}
