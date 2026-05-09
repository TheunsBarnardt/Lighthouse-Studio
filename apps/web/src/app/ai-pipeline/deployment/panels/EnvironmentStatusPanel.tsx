'use client';

import { CheckCircle2, Clock, XCircle, ChevronRight } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

import { PromoteDialog } from '../dialogs/PromoteDialog';
import { RollbackDialog } from '../dialogs/RollbackDialog';

type EnvStatus = 'not_deployed' | 'deployed' | 'failed' | 'rolling_back';

interface EnvironmentState {
  name: string;
  status: EnvStatus;
  version?: string;
  deployedAt?: string;
  deployId?: string;
}

const STATUS_ICON: Record<EnvStatus, React.ReactNode> = {
  not_deployed: <Clock style={{ width: 16, height: 16 }} />,
  deployed: <CheckCircle2 style={{ width: 16, height: 16 }} />,
  failed: <XCircle style={{ width: 16, height: 16 }} />,
  rolling_back: <Clock style={{ width: 16, height: 16 }} />,
};

const STATUS_LABELS: Record<EnvStatus, string> = {
  not_deployed: 'Not deployed',
  deployed: 'Deployed',
  failed: 'Failed',
  rolling_back: 'Rolling back',
};

const DEMO_ENVIRONMENTS: EnvironmentState[] = [
  { name: 'dev', status: 'not_deployed' },
  { name: 'staging', status: 'not_deployed' },
  { name: 'prod', status: 'not_deployed' },
];

interface Props {
  onDeploy: (environment: string) => void;
}

export function EnvironmentStatusPanel({ onDeploy: onDeployProp }: Props) {
  const onDeploy = (environment: string) => {
    onDeployProp(environment);
  };
  const [environments, _setEnvironments] = useState<EnvironmentState[]>(DEMO_ENVIRONMENTS);
  const [promoteTarget, setPromoteTarget] = useState<string | null>(null);
  const [rollbackTarget, setRollbackTarget] = useState<string | null>(null);

  return (
    <div style={{ padding: 24, maxWidth: 640 }}>
      <h2 style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>Environment Status</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {environments.map((env, i) => {
          const prevEnv = i > 0 ? environments[i - 1] : null;
          const canDeploy = i === 0 || prevEnv?.status === 'deployed';

          return (
            <div key={env.name}>
              {i > 0 && (
                <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0' }}>
                  <ChevronRight
                    style={{
                      width: 16,
                      height: 16,
                      transform: 'rotate(90deg)',
                    }}
                  />
                </div>
              )}
              <div
                style={{
                  border: '1px solid var(--border-default)',
                  borderRadius: 6,
                  padding: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  opacity: canDeploy ? 1 : 0.5,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: 96 }}>
                  {STATUS_ICON[env.status]}
                  <span
                    style={{
                      fontWeight: 500,
                      fontSize: 13,
                      textTransform: 'capitalize',
                    }}
                  >
                    {env.name}
                  </span>
                </div>

                <div style={{ flex: 1 }}>
                  <span
                    className={`inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground ${env.status === 'deployed' ? 'inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground'}`}
                  >
                    {STATUS_LABELS[env.status]}
                  </span>
                  {env.version && (
                    <span style={{ fontSize: 11, marginLeft: 8 }}>
                      {env.version} · {env.deployedAt}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {env.status === 'not_deployed' && (
                    <Button
                      size="sm"
                      type="button"
                      disabled={!canDeploy}
                      onClick={() => {
                        onDeploy(env.name);
                      }}
                    >
                      {i === 0 ? 'Deploy' : `Promote to ${env.name}`}
                    </Button>
                  )}
                  {env.status === 'deployed' &&
                    i < environments.length - 1 &&
                    environments[i + 1]?.status !== 'deployed' && (
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={() => {
                          setPromoteTarget(environments[i + 1]?.name ?? '');
                        }}
                      >
                        Promote →
                      </Button>
                    )}
                  {env.status === 'deployed' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      onClick={() => {
                        setRollbackTarget(env.deployId ?? 'dep-1');
                      }}
                    >
                      Rollback
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {promoteTarget && (
        <PromoteDialog
          targetEnvironment={promoteTarget}
          onClose={() => {
            setPromoteTarget(null);
          }}
          onConfirm={() => {
            setPromoteTarget(null);
            onDeploy(promoteTarget);
          }}
        />
      )}

      {rollbackTarget && (
        <RollbackDialog
          deploymentId={rollbackTarget}
          onClose={() => {
            setRollbackTarget(null);
          }}
        />
      )}
    </div>
  );
}
