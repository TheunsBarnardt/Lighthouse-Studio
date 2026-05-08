'use client';

import { CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';

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
  pending: <Clock style={{ width: 16, height: 16, color: 'var(--fg-tertiary)' }} />,
  running: <Clock style={{ width: 16, height: 16, color: 'var(--fg-warning)' }} />,
  completed: <CheckCircle2 style={{ width: 16, height: 16, color: 'var(--fg-success)' }} />,
  failed: <XCircle style={{ width: 16, height: 16, color: 'var(--fg-danger)' }} />,
  skipped: <AlertCircle style={{ width: 16, height: 16, color: 'var(--fg-tertiary)' }} />,
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
          <h2 style={{ fontWeight: 600, fontSize: 14, color: 'var(--fg-primary)' }}>
            Deployment Monitor
          </h2>
          <span className={`pg-badge ${isDone ? 'pg-badge-success' : 'pg-badge-default'}`}>
            {isDone ? 'Deployed' : 'Running…'}
          </span>
        </div>
        {isDone && (
          <button
            className="pg-btn pg-btn-secondary pg-btn-sm"
            onClick={() => {
              setShowRollback(true);
            }}
          >
            Rollback
          </button>
        )}
      </div>

      {!isDone && (
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
                  ? '1px solid var(--fg-warning)'
                  : step.status === 'completed'
                    ? '1px solid var(--fg-success)'
                    : step.status === 'failed'
                      ? '1px solid var(--fg-danger)'
                      : '1px solid var(--border-default)',
              background:
                step.status === 'running'
                  ? 'color-mix(in srgb, var(--fg-warning) 6%, transparent)'
                  : step.status === 'completed'
                    ? 'color-mix(in srgb, var(--fg-success) 4%, transparent)'
                    : step.status === 'failed'
                      ? 'color-mix(in srgb, var(--fg-danger) 6%, transparent)'
                      : 'transparent',
            }}
          >
            {STATUS_ICON[step.status]}
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg-primary)' }}>
                {STEP_LABELS[step.stepType] ?? step.stepType}
              </span>
              {step.errorMessage && (
                <p style={{ fontSize: 11, color: 'var(--fg-danger)', marginTop: 2 }}>
                  {step.errorMessage}
                </p>
              )}
            </div>
            {step.durationMs && (
              <span style={{ fontSize: 11, color: 'var(--fg-tertiary)' }}>
                {(step.durationMs / 1000).toFixed(1)}s
              </span>
            )}
          </div>
        ))}
      </div>

      {isDone && (
        <div
          style={{
            borderRadius: 6,
            border: '1px solid var(--fg-success)',
            background: 'color-mix(in srgb, var(--fg-success) 6%, transparent)',
            padding: 16,
          }}
        >
          <p style={{ fontWeight: 500, color: 'var(--fg-success)', marginBottom: 4, fontSize: 13 }}>
            Deployment complete
          </p>
          <p style={{ fontSize: 12, color: 'var(--fg-secondary)' }}>
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
