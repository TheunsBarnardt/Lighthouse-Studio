'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, XCircle, ChevronRight } from 'lucide-react';
import { PromoteDialog } from '../dialogs/PromoteDialog';
import { RollbackDialog } from '../dialogs/RollbackDialog';
import { useState } from 'react';

type EnvStatus = 'not_deployed' | 'deployed' | 'failed' | 'rolling_back';

interface EnvironmentState {
  name: string;
  status: EnvStatus;
  version?: string;
  deployedAt?: string;
  deployId?: string;
}

const STATUS_ICON: Record<EnvStatus, React.ReactNode> = {
  not_deployed: <Clock className="h-4 w-4 text-muted-foreground" />,
  deployed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  failed: <XCircle className="h-4 w-4 text-red-500" />,
  rolling_back: <Clock className="h-4 w-4 text-amber-500 animate-spin" />,
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
  onDeploy(environment: string): void;
}

export function EnvironmentStatusPanel({ onDeploy }: Props) {
  const [environments, setEnvironments] = useState<EnvironmentState[]>(DEMO_ENVIRONMENTS);
  const [promoteTarget, setPromoteTarget] = useState<string | null>(null);
  const [rollbackTarget, setRollbackTarget] = useState<string | null>(null);

  const devDeployed = environments.find(e => e.name === 'dev')?.status === 'deployed';
  const stagingDeployed = environments.find(e => e.name === 'staging')?.status === 'deployed';

  return (
    <div className="p-6 max-w-2xl">
      <h2 className="font-semibold mb-4">Environment Status</h2>

      <div className="space-y-3">
        {environments.map((env, i) => {
          const isFirst = i === 0;
          const prevEnv = i > 0 ? environments[i - 1] : null;
          const canDeploy = isFirst || prevEnv?.status === 'deployed';

          return (
            <div key={env.name}>
              {i > 0 && (
                <div className="flex justify-center my-1">
                  <ChevronRight className="h-4 w-4 text-muted-foreground rotate-90" />
                </div>
              )}
              <div className={`border rounded-lg p-4 flex items-center gap-4 ${!canDeploy ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-2 w-28">
                  {STATUS_ICON[env.status]}
                  <span className="font-medium capitalize">{env.name}</span>
                </div>

                <div className="flex-1">
                  <Badge variant={env.status === 'deployed' ? 'default' : 'secondary'}>
                    {STATUS_LABELS[env.status]}
                  </Badge>
                  {env.version && (
                    <span className="text-xs text-muted-foreground ml-2">{env.version} · {env.deployedAt}</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {env.status === 'not_deployed' && (
                    <Button
                      size="sm"
                      disabled={!canDeploy}
                      onClick={() => onDeploy(env.name)}
                    >
                      {i === 0 ? 'Deploy' : `Promote to ${env.name}`}
                    </Button>
                  )}
                  {env.status === 'deployed' && i < environments.length - 1 && !environments[i + 1]?.status?.startsWith('deployed') && (
                    <Button size="sm" variant="outline" onClick={() => setPromoteTarget(environments[i + 1]?.name ?? '')}>
                      Promote →
                    </Button>
                  )}
                  {env.status === 'deployed' && (
                    <Button size="sm" variant="ghost" onClick={() => setRollbackTarget(env.deployId ?? 'dep-1')}>
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
          onClose={() => setPromoteTarget(null)}
          onConfirm={() => { setPromoteTarget(null); onDeploy(promoteTarget); }}
        />
      )}

      {rollbackTarget && (
        <RollbackDialog
          deploymentId={rollbackTarget}
          onClose={() => setRollbackTarget(null)}
        />
      )}
    </div>
  );
}
