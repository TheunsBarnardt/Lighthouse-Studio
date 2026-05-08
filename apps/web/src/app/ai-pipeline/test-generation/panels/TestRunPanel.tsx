'use client';

import { CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';

type RunStatus = 'running' | 'completed' | 'failed';

interface TestResult {
  name: string;
  filePath: string;
  status: 'passed' | 'failed' | 'skipped';
  durationMs: number;
  error?: string;
}

const STATUS_ICON: Record<RunStatus, React.ReactNode> = {
  running: <Clock style={{ width: 16, height: 16, color: 'var(--fg-warning)' }} />,
  completed: <CheckCircle2 style={{ width: 16, height: 16, color: 'var(--fg-success)' }} />,
  failed: <XCircle style={{ width: 16, height: 16, color: 'var(--fg-danger)' }} />,
};

const DEMO_RESULTS: TestResult[] = [
  {
    name: 'should hash the password before storing',
    filePath: 'unit/tc-ac001-unit-1.test.ts',
    status: 'passed',
    durationMs: 12,
  },
  {
    name: 'POST /auth/register returns 201',
    filePath: 'integration/tc-ac001-integration-1.test.ts',
    status: 'passed',
    durationMs: 340,
  },
  {
    name: 'should return JWT on valid credentials',
    filePath: 'unit/tc-ac002-unit-1.test.ts',
    status: 'passed',
    durationMs: 8,
  },
  {
    name: 'user can log in and see dashboard',
    filePath: 'e2e/tc-ac002-e2e-1.test.ts',
    status: 'failed',
    durationMs: 5200,
    error: 'Expected element to be visible: [data-testid="dashboard-header"]',
  },
  {
    name: 'LoginForm shows error on invalid email',
    filePath: 'component/tc-ac003-component-1.test.tsx',
    status: 'passed',
    durationMs: 55,
  },
];

export function TestRunPanel() {
  const [status, setStatus] = useState<RunStatus>('running');
  const [progress, setProgress] = useState(0);
  const [visibleResults, setVisibleResults] = useState<TestResult[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => {
        const next = Math.min(p + 20, 100);
        if (next >= 100) {
          clearInterval(interval);
          setStatus('failed');
        }
        return next;
      });
    }, 600);
    return () => {
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const idx = Math.floor((progress / 100) * DEMO_RESULTS.length);
    setVisibleResults(DEMO_RESULTS.slice(0, idx));
  }, [progress]);

  const passed = visibleResults.filter((r) => r.status === 'passed').length;
  const failed = visibleResults.filter((r) => r.status === 'failed').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 24, gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {STATUS_ICON[status]}
        <h2 style={{ fontWeight: 600, fontSize: 14, color: 'var(--fg-primary)' }}>
          {status === 'running'
            ? 'Running tests…'
            : status === 'completed'
              ? 'All tests passed'
              : 'Some tests failed'}
        </h2>
        <span
          className={`pg-badge ${status === 'completed' ? 'pg-badge-success' : status === 'failed' ? 'pg-badge-danger' : 'pg-badge-default'}`}
        >
          {status}
        </span>
      </div>

      {status === 'running' && (
        <div
          style={{
            height: 6,
            background: 'var(--border-default)',
            borderRadius: 4,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              background: 'var(--accent-primary)',
              transition: 'width 0.3s',
              width: `${String(progress)}%`,
            }}
          />
        </div>
      )}

      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, maxWidth: 400 }}
      >
        <div
          style={{
            border: '1px solid var(--border-default)',
            borderRadius: 6,
            padding: 12,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--fg-success)' }}>{passed}</div>
          <div style={{ fontSize: 11, color: 'var(--fg-tertiary)' }}>Passed</div>
        </div>
        <div
          style={{
            border: '1px solid var(--border-default)',
            borderRadius: 6,
            padding: 12,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--fg-danger)' }}>{failed}</div>
          <div style={{ fontSize: 11, color: 'var(--fg-tertiary)' }}>Failed</div>
        </div>
        <div
          style={{
            border: '1px solid var(--border-default)',
            borderRadius: 6,
            padding: 12,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--fg-primary)' }}>
            {visibleResults.length}
          </div>
          <div style={{ fontSize: 11, color: 'var(--fg-tertiary)' }}>Total</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {visibleResults.map((r, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: 8,
              borderRadius: 6,
              fontSize: 13,
              border:
                r.status === 'failed' ? '1px solid var(--fg-danger)' : '1px solid transparent',
              background:
                r.status === 'failed'
                  ? 'color-mix(in srgb, var(--fg-danger) 6%, transparent)'
                  : 'transparent',
            }}
          >
            {r.status === 'passed' ? (
              <CheckCircle2
                style={{
                  width: 16,
                  height: 16,
                  color: 'var(--fg-success)',
                  marginTop: 2,
                  flexShrink: 0,
                }}
              />
            ) : r.status === 'failed' ? (
              <XCircle
                style={{
                  width: 16,
                  height: 16,
                  color: 'var(--fg-danger)',
                  marginTop: 2,
                  flexShrink: 0,
                }}
              />
            ) : (
              <AlertCircle
                style={{
                  width: 16,
                  height: 16,
                  color: 'var(--fg-tertiary)',
                  marginTop: 2,
                  flexShrink: 0,
                }}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color: 'var(--fg-primary)',
                }}
              >
                {r.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--fg-tertiary)' }}>
                {r.filePath} · {r.durationMs}ms
              </div>
              {r.error && (
                <div
                  className="pg-mono"
                  style={{ fontSize: 11, color: 'var(--fg-danger)', marginTop: 4 }}
                >
                  {r.error}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
