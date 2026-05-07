'use client';

import { AlertTriangle } from 'lucide-react';

interface CoverageRow {
  label: string;
  pct: number;
  threshold: number;
}

const DEMO_COVERAGE: CoverageRow[] = [
  { label: 'Lines', pct: 84, threshold: 80 },
  { label: 'Branches', pct: 68, threshold: 70 },
  { label: 'Functions', pct: 91, threshold: 80 },
  { label: 'Statements', pct: 83, threshold: 80 },
];

const AC_COVERAGE = { totalAcs: 10, acsWithTests: 9, acsWithoutTests: 1, pct: 90 };

function CoverageBar({ pct, threshold }: { pct: number; threshold: number }) {
  const met = pct >= threshold;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${met ? 'bg-green-500' : 'bg-red-500'}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className={`text-xs font-mono w-8 text-right ${met ? 'text-green-700' : 'text-red-700'}`}>
        {pct}%
      </span>
    </div>
  );
}

export function CoveragePanel() {
  const belowThreshold = DEMO_COVERAGE.filter(r => r.pct < r.threshold);

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b bg-muted/30">
        <span className="text-sm font-medium">Coverage</span>
      </div>

      <div className="p-4 space-y-6 overflow-y-auto flex-1">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">Code Coverage</p>
          <div className="space-y-3">
            {DEMO_COVERAGE.map(row => (
              <div key={row.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span>{row.label}</span>
                  <span className="text-muted-foreground">threshold {row.threshold}%</span>
                </div>
                <CoverageBar pct={row.pct} threshold={row.threshold} />
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">AC Coverage</p>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>ACs with tests</span>
              <span className="font-medium">{AC_COVERAGE.acsWithTests}/{AC_COVERAGE.totalAcs}</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full" style={{ width: `${AC_COVERAGE.pct}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">{AC_COVERAGE.pct}% coverage</p>
          </div>
        </div>

        {belowThreshold.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
              <span className="text-xs font-medium text-amber-800">Below threshold</span>
            </div>
            {belowThreshold.map(r => (
              <p key={r.label} className="text-xs text-amber-700">
                {r.label}: {r.pct}% (need {r.threshold}%)
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
