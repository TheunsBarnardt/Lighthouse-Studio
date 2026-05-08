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

const DEMO_OUTCOMES: OutcomeRecord[] = [
  {
    id: 'out-1',
    changeRequestId: 'cr-resolved-1',
    changeRequestDescription: 'Fixed null error in ContactsList component',
    resolvedAt: '3 days ago',
    regressionDetected: false,
    summary:
      'Fix resolved 47 error occurrences. No regressions detected. Error rate returned to baseline.',
    metrics: [
      { name: 'Error rate', before: 12.4, after: 0.1, unit: '/hr', trend: 'improved' },
      { name: 'p99 latency', before: 210, after: 198, unit: 'ms', trend: 'improved' },
      { name: 'User satisfaction', before: 72, after: 79, unit: '%', trend: 'improved' },
    ],
  },
];

const TREND_ICON = {
  improved: <TrendingUp style={{ width: 16, height: 16, color: 'var(--fg-success)' }} />,
  degraded: <TrendingDown style={{ width: 16, height: 16, color: 'var(--fg-danger)' }} />,
  neutral: <Minus style={{ width: 16, height: 16, color: 'var(--fg-tertiary)' }} />,
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
          color: 'var(--fg-tertiary)',
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
      <h2 style={{ fontWeight: 600, fontSize: 14, color: 'var(--fg-primary)' }}>
        Outcome Tracking ({DEMO_OUTCOMES.length})
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {DEMO_OUTCOMES.map((outcome) => (
          <div
            key={outcome.id}
            style={{
              border: '1px solid var(--border-default)',
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
                    <XCircle
                      style={{ width: 16, height: 16, color: 'var(--fg-danger)', flexShrink: 0 }}
                    />
                  ) : (
                    <CheckCircle2
                      style={{ width: 16, height: 16, color: 'var(--fg-success)', flexShrink: 0 }}
                    />
                  )}
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: 'var(--fg-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {outcome.changeRequestDescription}
                  </p>
                </div>
                <p style={{ fontSize: 11, color: 'var(--fg-tertiary)' }}>
                  Resolved {outcome.resolvedAt}
                </p>
              </div>
              {outcome.regressionDetected && (
                <span className="pg-badge pg-badge-danger" style={{ flexShrink: 0 }}>
                  Regression
                </span>
              )}
            </div>

            <p style={{ fontSize: 13, color: 'var(--fg-secondary)' }}>{outcome.summary}</p>

            <div>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: 'var(--fg-tertiary)',
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
                      background: 'var(--bg-surface)',
                      borderRadius: 4,
                      padding: 8,
                    }}
                  >
                    {TREND_ICON[metric.trend]}
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 11, color: 'var(--fg-tertiary)' }}>{metric.name}</p>
                      <p className="pg-mono" style={{ fontSize: 11 }}>
                        <span style={{ color: 'var(--fg-tertiary)' }}>
                          {metric.before}
                          {metric.unit}
                        </span>
                        {' → '}
                        <span
                          style={{
                            color:
                              metric.trend === 'improved'
                                ? 'var(--fg-success)'
                                : metric.trend === 'degraded'
                                  ? 'var(--fg-danger)'
                                  : 'var(--fg-primary)',
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
