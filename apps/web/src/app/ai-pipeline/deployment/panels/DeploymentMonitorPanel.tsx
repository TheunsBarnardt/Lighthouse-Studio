'use client';

import { CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';

import { RollbackDialog } from '../dialogs/RollbackDialog';

type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

interface Step {
  stepType: string;
  label: string;
  status: StepStatus;
  durationMs?: number;
  errorMessage?: string;
}

const STEP_LABELS: Record<string, string> = {
  pre_flight: 'Pre-flight check',
  tests: 'Run tests',
  schema: 'Apply schema migrations',
  server: 'Deploy server functions',
  ui: 'Deploy UI bundle',
  health_check: 'Health check',
  cleanup: 'Cleanup',
};

const STATUS_ICON: Record<StepStatus, React.ReactNode> = {
  pending: <Clock style={{ width: 16, height: 16 }} />,
  running: <Clock style={{ width: 16, height: 16 }} />,
  completed: <CheckCircle2 style={{ width: 16, height: 16 }} />,
  failed: <XCircle style={{ width: 16, height: 16 }} />,
  skipped: <AlertCircle style={{ width: 16, height: 16 }} />,
};

interface Props {
  deploymentId: string;
}

const INITIAL_STEPS: Step[] = [
  { stepType: 'pre_flight', label: 'Pre-flight check', status: 'pending' },
  { stepType: 'schema', label: 'Apply schema migrations', status: 'pending' },
  { stepType: 'server', label: 'Deploy server functions', status: 'pending' },
  { stepType: 'ui', label: 'Deploy UI bundle', status: 'pending' },
  { stepType: 'health_check', label: 'Health check', status: 'pending' },
  { stepType: 'cleanup', label: 'Cleanup', status: 'pending' },
];

export function DeploymentMonitorPanel({ deploymentId }: Props) {
  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS.map((s) => ({ ...s })));
  const [isDone, setIsDone] = useState(false);
  const [showRollback, setShowRollback] = useState(false);

  useEffect(() => {
    let idx = 0;
    const advance = () => {
      if (idx >= INITIAL_STEPS.length) {
        setIsDone(true);
        return;
      }
      setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, status: 'running' } : s)));
      setTimeout(
        () => {
          setSteps((prev) =>
            prev.map((s, i) =>
              i === idx ? { ...s, status: 'completed', durationMs: 800 + Math.random() * 2000 } : s,
            ),
          );
          idx++;
          if (idx < INITIAL_STEPS.length) setTimeout(advance, 300);
          else setIsDone(true);
        },
        1000 + Math.random() * 1500,
      );
    };
    const t = setTimeout(advance, 500);
    return () => {
      clearTimeout(t);
    };
  }, []);

  const completedCount = steps.filter((s) => s.status === 'completed').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 24, gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ fontWeight: 600, fontSize: 14 }}>Deployment Monitor</h2>
          <span
            className={`inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground ${isDone ? 'inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground'}`}
          >
            {isDone ? 'Deployed' : 'Runningâ€¦'}
          </span>
        </div>
        {isDone && (
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => {
              setShowRollback(true);
            }}
          >
            Rollback
          </Button>
        )}
      </div>

      {!isDone && (
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
              transition: 'width 0.7s',
              width: `${String((completedCount / steps.length) * 100)}%`,
            }}
          />
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {steps.map((step) => (
          <div
            key={step.stepType}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: 12,
              borderRadius: 6,
              border:
                step.status === 'running'
                  ? '1px solid oklch(0.45 0.14 75)'
                  : step.status === 'completed'
                    ? '1px solid oklch(0.40 0.14 145)'
                    : step.status === 'failed'
                      ? '1px solid var(--destructive)'
                      : '1px solid var(--border)',
              background:
                step.status === 'running'
                  ? 'color-mix(in srgb, oklch(0.45 0.14 75) 6%, transparent)'
                  : step.status === 'completed'
                    ? 'color-mix(in srgb, oklch(0.40 0.14 145) 4%, transparent)'
                    : step.status === 'failed'
                      ? 'color-mix(in srgb, var(--destructive) 6%, transparent)'
                      : 'transparent',
            }}
          >
            {STATUS_ICON[step.status]}
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>
                {STEP_LABELS[step.stepType] ?? step.stepType}
              </span>
              {step.errorMessage && (
                <p style={{ fontSize: 11, marginTop: 2 }}>{step.errorMessage}</p>
              )}
            </div>
            {step.durationMs && (
              <span style={{ fontSize: 11 }}>{(step.durationMs / 1000).toFixed(1)}s</span>
            )}
          </div>
        ))}
      </div>

      {isDone && (
        <div
          style={{
            borderRadius: 6,
            border: '1px solid oklch(0.40 0.14 145)',
            background: 'color-mix(in srgb, oklch(0.40 0.14 145) 6%, transparent)',
            padding: 16,
          }}
        >
          <p style={{ fontWeight: 500, marginBottom: 4, fontSize: 13 }}>Deployment complete</p>
          <p style={{ fontSize: 12 }}>
            Application is live. Health checks passed. Ready to promote to staging.
          </p>
        </div>
      )}

      {showRollback && (
        <RollbackDialog
          deploymentId={deploymentId}
          onClose={() => {
            setShowRollback(false);
          }}
        />
      )}
    </div>
  );
}
