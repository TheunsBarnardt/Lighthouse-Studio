'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';

type RunStatus = 'running' | 'completed' | 'failed';

interface TestResult {
  name: string;
  filePath: string;
  status: 'passed' | 'failed' | 'skipped';
  durationMs: number;
  error?: string;
}

const STATUS_ICON: Record<RunStatus, React.ReactNode> = {
  running: <Clock className="h-4 w-4 text-amber-500 animate-spin" />,
  completed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  failed: <XCircle className="h-4 w-4 text-red-500" />,
};

const DEMO_RESULTS: TestResult[] = [
  { name: 'should hash the password before storing', filePath: 'unit/tc-ac001-unit-1.test.ts', status: 'passed', durationMs: 12 },
  { name: 'POST /auth/register returns 201', filePath: 'integration/tc-ac001-integration-1.test.ts', status: 'passed', durationMs: 340 },
  { name: 'should return JWT on valid credentials', filePath: 'unit/tc-ac002-unit-1.test.ts', status: 'passed', durationMs: 8 },
  { name: 'user can log in and see dashboard', filePath: 'e2e/tc-ac002-e2e-1.test.ts', status: 'failed', durationMs: 5200, error: 'Expected element to be visible: [data-testid="dashboard-header"]' },
  { name: 'LoginForm shows error on invalid email', filePath: 'component/tc-ac003-component-1.test.tsx', status: 'passed', durationMs: 55 },
];

export function TestRunPanel() {
  const [status, setStatus] = useState<RunStatus>('running');
  const [progress, setProgress] = useState(0);
  const [visibleResults, setVisibleResults] = useState<TestResult[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(p => {
        const next = Math.min(p + 20, 100);
        if (next >= 100) { clearInterval(interval); setStatus('failed'); }
        return next;
      });
    }, 600);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const idx = Math.floor((progress / 100) * DEMO_RESULTS.length);
    setVisibleResults(DEMO_RESULTS.slice(0, idx));
  }, [progress]);

  const passed = visibleResults.filter(r => r.status === 'passed').length;
  const failed = visibleResults.filter(r => r.status === 'failed').length;

  return (
    <div className="flex flex-col h-full p-6 gap-4">
      <div className="flex items-center gap-3">
        {STATUS_ICON[status]}
        <h2 className="font-semibold">
          {status === 'running' ? 'Running tests…' : status === 'completed' ? 'All tests passed' : 'Some tests failed'}
        </h2>
        <Badge variant={status === 'completed' ? 'default' : status === 'failed' ? 'destructive' : 'secondary'}>
          {status}
        </Badge>
      </div>

      {status === 'running' && (
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 max-w-md">
        <div className="border rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-green-600">{passed}</div>
          <div className="text-xs text-muted-foreground">Passed</div>
        </div>
        <div className="border rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-red-600">{failed}</div>
          <div className="text-xs text-muted-foreground">Failed</div>
        </div>
        <div className="border rounded-lg p-3 text-center">
          <div className="text-2xl font-bold">{visibleResults.length}</div>
          <div className="text-xs text-muted-foreground">Total</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1">
        {visibleResults.map((r, i) => (
          <div key={i} className={`flex items-start gap-3 p-2 rounded-lg text-sm ${r.status === 'failed' ? 'bg-red-50 border border-red-200' : ''}`}>
            {r.status === 'passed' ? (
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
            ) : r.status === 'failed' ? (
              <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{r.name}</div>
              <div className="text-xs text-muted-foreground">{r.filePath} · {r.durationMs}ms</div>
              {r.error && <div className="text-xs text-red-700 mt-1 font-mono">{r.error}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
