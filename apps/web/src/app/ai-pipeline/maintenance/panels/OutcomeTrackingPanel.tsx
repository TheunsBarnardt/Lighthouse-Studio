'use client';

import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, CheckCircle2, XCircle } from 'lucide-react';

interface MetricDelta {
  name: string;
  before: number;
  after: number;
  unit: string;
  trend: 'improved' | 'degraded' | 'neutral';
}

interface OutcomeRecord {
  id: string;
  changeRequestId: string;
  changeRequestDescription: string;
  resolvedAt: string;
  regressionDetected: boolean;
  summary: string;
  metrics: MetricDelta[];
}

const DEMO_OUTCOMES: OutcomeRecord[] = [
  {
    id: 'out-1',
    changeRequestId: 'cr-resolved-1',
    changeRequestDescription: 'Fixed null error in ContactsList component',
    resolvedAt: '3 days ago',
    regressionDetected: false,
    summary: 'Fix resolved 47 error occurrences. No regressions detected. Error rate returned to baseline.',
    metrics: [
      { name: 'Error rate', before: 12.4, after: 0.1, unit: '/hr', trend: 'improved' },
      { name: 'p99 latency', before: 210, after: 198, unit: 'ms', trend: 'improved' },
      { name: 'User satisfaction', before: 72, after: 79, unit: '%', trend: 'improved' },
    ],
  },
];

const TREND_ICON = {
  improved: <TrendingUp className="h-4 w-4 text-green-500" />,
  degraded: <TrendingDown className="h-4 w-4 text-red-500" />,
  neutral: <Minus className="h-4 w-4 text-muted-foreground" />,
};

export function OutcomeTrackingPanel() {
  if (DEMO_OUTCOMES.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
        <CheckCircle2 className="h-8 w-8" />
        <p className="text-sm">No resolved change requests yet</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <h2 className="font-semibold">Outcome Tracking ({DEMO_OUTCOMES.length})</h2>

      <div className="space-y-4">
        {DEMO_OUTCOMES.map(outcome => (
          <div key={outcome.id} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {outcome.regressionDetected ? (
                    <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  )}
                  <p className="text-sm font-medium truncate">{outcome.changeRequestDescription}</p>
                </div>
                <p className="text-xs text-muted-foreground">Resolved {outcome.resolvedAt}</p>
              </div>
              {outcome.regressionDetected && (
                <Badge variant="destructive" className="text-xs shrink-0">Regression</Badge>
              )}
            </div>

            <p className="text-sm text-muted-foreground">{outcome.summary}</p>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Metrics</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {outcome.metrics.map(metric => (
                  <div key={metric.name} className="flex items-center gap-2 bg-muted/30 rounded p-2">
                    {TREND_ICON[metric.trend]}
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{metric.name}</p>
                      <p className="text-xs font-mono">
                        <span className="text-muted-foreground">{metric.before}{metric.unit}</span>
                        {' → '}
                        <span className={metric.trend === 'improved' ? 'text-green-700' : metric.trend === 'degraded' ? 'text-red-700' : ''}>
                          {metric.after}{metric.unit}
                        </span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
