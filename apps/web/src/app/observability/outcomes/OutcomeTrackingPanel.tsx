'use client';

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

const DEMO_OUTCOMES: OutcomeRecord[] = [];

const TREND_ICON = {
  improved: <TrendingUp style={{ width: 16, height: 16 }} />,
  degraded: <TrendingDown style={{ width: 16, height: 16 }} />,
  neutral: <Minus style={{ width: 16, height: 16 }} />,
};

export function OutcomeTrackingPanel() {
  if (DEMO_OUTCOMES.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: 192,
          gap: 8,
        }}
      >
        <CheckCircle2 style={{ width: 32, height: 32 }} />
        <p style={{ fontSize: 13 }}>No resolved change requests yet</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ fontWeight: 600, fontSize: 14 }}>Outcome Tracking ({DEMO_OUTCOMES.length})</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {DEMO_OUTCOMES.map((outcome) => (
          <div
            key={outcome.id}
            style={{
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  {outcome.regressionDetected ? (
                    <XCircle style={{ width: 16, height: 16, flexShrink: 0 }} />
                  ) : (
                    <CheckCircle2 style={{ width: 16, height: 16, flexShrink: 0 }} />
                  )}
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {outcome.changeRequestDescription}
                  </p>
                </div>
                <p style={{ fontSize: 11 }}>Resolved {outcome.resolvedAt}</p>
              </div>
              {outcome.regressionDetected && (
                <span
                  className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive"
                  style={{ flexShrink: 0 }}
                >
                  Regression
                </span>
              )}
            </div>

            <p style={{ fontSize: 13 }}>{outcome.summary}</p>

            <div>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: 8,
                }}
              >
                Metrics
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {outcome.metrics.map((metric) => (
                  <div
                    key={metric.name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      borderRadius: 4,
                      padding: 8,
                    }}
                  >
                    {TREND_ICON[metric.trend]}
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 11 }}>{metric.name}</p>
                      <p className="font-mono text-sm" style={{ fontSize: 11 }}>
                        <span>
                          {metric.before}
                          {metric.unit}
                        </span>
                        {' â†’ '}
                        <span
                          style={{
                            color:
                              metric.trend === 'improved'
                                ? 'oklch(0.40 0.14 145)'
                                : metric.trend === 'degraded'
                                  ? 'var(--destructive)'
                                  : 'var(--foreground)',
                          }}
                        >
                          {metric.after}
                          {metric.unit}
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
