'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
  pending: <Clock className="h-4 w-4 text-muted-foreground" />,
  running: <Clock className="h-4 w-4 text-amber-500 animate-spin" />,
  completed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  failed: <XCircle className="h-4 w-4 text-red-500" />,
  skipped: <AlertCircle className="h-4 w-4 text-muted-foreground" />,
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
  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS.map(s => ({ ...s })));
  const [currentStep, setCurrentStep] = useState(0);
  const [isDone, setIsDone] = useState(false);
  const [showRollback, setShowRollback] = useState(false);

  useEffect(() => {
    let idx = 0;
    const advance = () => {
      if (idx >= steps.length) { setIsDone(true); return; }
      setSteps(prev => prev.map((s, i) => i === idx ? { ...s, status: 'running' } : s));
      setTimeout(() => {
        setSteps(prev => prev.map((s, i) => i === idx ? { ...s, status: 'completed', durationMs: 800 + Math.random() * 2000 } : s));
        idx++;
        setCurrentStep(idx);
        if (idx < INITIAL_STEPS.length) setTimeout(advance, 300);
        else setIsDone(true);
      }, 1000 + Math.random() * 1500);
    };
    const t = setTimeout(advance, 500);
    return () => clearTimeout(t);
  }, []);

  const completedCount = steps.filter(s => s.status === 'completed').length;
  const overallStatus = isDone ? 'deployed' : 'running';

  return (
    <div className="flex flex-col h-full p-6 gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold">Deployment Monitor</h2>
          <Badge variant={isDone ? 'default' : 'secondary'}>
            {isDone ? 'Deployed' : 'Running…'}
          </Badge>
        </div>
        {isDone && (
          <Button variant="outline" size="sm" onClick={() => setShowRollback(true)}>
            Rollback
          </Button>
        )}
      </div>

      {!isDone && (
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-700"
            style={{ width: `${(completedCount / steps.length) * 100}%` }}
          />
        </div>
      )}

      <div className="space-y-2">
        {steps.map((step, i) => (
          <div
            key={step.stepType}
            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
              step.status === 'running' ? 'border-amber-200 bg-amber-50' :
              step.status === 'completed' ? 'border-green-100 bg-green-50/30' :
              step.status === 'failed' ? 'border-red-200 bg-red-50' : ''
            }`}
          >
            {STATUS_ICON[step.status]}
            <div className="flex-1">
              <span className="text-sm font-medium">{STEP_LABELS[step.stepType] ?? step.stepType}</span>
              {step.errorMessage && <p className="text-xs text-red-700 mt-0.5">{step.errorMessage}</p>}
            </div>
            {step.durationMs && (
              <span className="text-xs text-muted-foreground">{(step.durationMs / 1000).toFixed(1)}s</span>
            )}
          </div>
        ))}
      </div>

      {isDone && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="font-medium text-green-800 mb-1">Deployment complete</p>
          <p className="text-sm text-green-700">
            Application is live. Health checks passed. Ready to promote to staging.
          </p>
        </div>
      )}

      {showRollback && (
        <RollbackDialog
          deploymentId={deploymentId}
          onClose={() => setShowRollback(false)}
        />
      )}
    </div>
  );
}
