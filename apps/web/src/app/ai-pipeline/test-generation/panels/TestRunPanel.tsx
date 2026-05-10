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
  running: <Clock style={{ width: 16, height: 16 }} />,
  completed: <CheckCircle2 style={{ width: 16, height: 16 }} />,
  failed: <XCircle style={{ width: 16, height: 16 }} />,
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
        <h2 style={{ fontWeight: 600, fontSize: 14 }}>
          {status === 'running'
            ? 'Running testsâ€¦'
            : status === 'completed'
              ? 'All tests passed'
              : 'Some tests failed'}
        </h2>
        <span
          className={`inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground ${status === 'completed' ? 'inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : status === 'failed' ? 'inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive' : 'inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground'}`}
        >
          {status}
        </span>
      </div>

      {status === 'running' && (
        <div
          style={{
            height: 6,
            background: 'var(--border)',
            borderRadius: 4,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              background: 'var(--primary)',
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
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: 12,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 700 }}>{passed}</div>
          <div style={{ fontSize: 11 }}>Passed</div>
        </div>
        <div
          style={{
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: 12,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 700 }}>{failed}</div>
          <div style={{ fontSize: 11 }}>Failed</div>
        </div>
        <div
          style={{
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: 12,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 700 }}>{visibleResults.length}</div>
          <div style={{ fontSize: 11 }}>Total</div>
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
                r.status === 'failed' ? '1px solid var(--destructive)' : '1px solid transparent',
              background:
                r.status === 'failed'
                  ? 'color-mix(in srgb, var(--destructive) 6%, transparent)'
                  : 'transparent',
            }}
          >
            {r.status === 'passed' ? (
              <CheckCircle2
                style={{
                  width: 16,
                  height: 16,
                  marginTop: 2,
                  flexShrink: 0,
                }}
              />
            ) : r.status === 'failed' ? (
              <XCircle
                style={{
                  width: 16,
                  height: 16,
                  marginTop: 2,
                  flexShrink: 0,
                }}
              />
            ) : (
              <AlertCircle
                style={{
                  width: 16,
                  height: 16,
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
                }}
              >
                {r.name}
              </div>
              <div style={{ fontSize: 11 }}>
                {r.filePath} Â· {r.durationMs}ms
              </div>
              {r.error && (
                <div className="font-mono text-sm" style={{ fontSize: 11, marginTop: 4 }}>
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
