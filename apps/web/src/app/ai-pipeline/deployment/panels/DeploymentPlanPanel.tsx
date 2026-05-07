'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react';

interface EnvironmentConfig {
  name: string;
  autoDeploy: boolean;
  testsRequired: boolean;
  deployMode: 'rolling' | 'blue_green';
  approvers: string[];
}

interface IrreversibleOp {
  description: string;
  warning: string;
}

const DEMO_ENVIRONMENTS: EnvironmentConfig[] = [
  { name: 'dev', autoDeploy: true, testsRequired: false, deployMode: 'rolling', approvers: [] },
  { name: 'staging', autoDeploy: false, testsRequired: true, deployMode: 'rolling', approvers: ['workspace_admin'] },
  { name: 'prod', autoDeploy: false, testsRequired: true, deployMode: 'blue_green', approvers: ['architect', 'workspace_owner'] },
];

const DEMO_MIGRATIONS = [
  { sequence: 1, description: 'Add deal_score column to contacts', reversible: true },
  { sequence: 2, description: 'Create activities index', reversible: true },
];

const DEMO_IRREVERSIBLE: IrreversibleOp[] = [];

const DEPLOY_MODE_BADGE: Record<string, string> = {
  rolling: 'bg-blue-100 text-blue-800',
  blue_green: 'bg-purple-100 text-purple-800',
};

interface Props {
  onApproved(): void;
}

export function DeploymentPlanPanel({ onApproved }: Props) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>('environments');

  const toggle = (s: string) => setExpandedSection(prev => prev === s ? null : s);

  const handleGenerate = async () => {
    setIsGenerating(true);
    await new Promise(r => setTimeout(r, 1500));
    setIsGenerating(false);
    setIsGenerated(true);
  };

  if (!isGenerated) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-semibold mb-2">Generate Deployment Plan</h2>
          <p className="text-muted-foreground text-sm mb-6">
            The deployment plan defines how your application will be deployed across dev, staging, and production environments, including schema migration sequencing and health checks.
          </p>
          <Button onClick={handleGenerate} disabled={isGenerating} size="lg">
            {isGenerating ? 'Generating…' : 'Generate Deployment Plan'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6 gap-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Deployment Plan v0.0.1</h2>
          <p className="text-sm text-muted-foreground">3 environments · {DEMO_MIGRATIONS.length} migrations · {DEMO_IRREVERSIBLE.length} irreversible operations</p>
        </div>
        <Button onClick={onApproved}>Approve Plan</Button>
      </div>

      {DEMO_IRREVERSIBLE.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span className="font-medium text-red-800">{DEMO_IRREVERSIBLE.length} irreversible operations</span>
          </div>
          {DEMO_IRREVERSIBLE.map((op, i) => (
            <p key={i} className="text-sm text-red-700">{op.description}: {op.warning}</p>
          ))}
        </div>
      )}

      {/* Environments */}
      <div className="border rounded-lg overflow-hidden">
        <button
          className="w-full flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/50 transition-colors"
          onClick={() => toggle('environments')}
        >
          <span className="font-medium">Environments ({DEMO_ENVIRONMENTS.length})</span>
          {expandedSection === 'environments' ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        {expandedSection === 'environments' && (
          <div className="divide-y">
            {DEMO_ENVIRONMENTS.map(env => (
              <div key={env.name} className="p-4 flex items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{env.name}</span>
                    {env.autoDeploy && <Badge variant="secondary" className="text-xs">auto-deploy</Badge>}
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${DEPLOY_MODE_BADGE[env.deployMode]}`}>{env.deployMode.replace('_', '/')}</span>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <p>Tests required: {env.testsRequired ? 'yes' : 'no'}</p>
                    <p>Approvers: {env.approvers.length > 0 ? env.approvers.join(', ') : 'none (auto)'}</p>
                  </div>
                </div>
                <CheckCircle2 className="h-4 w-4 text-muted-foreground mt-0.5" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Schema migrations */}
      <div className="border rounded-lg overflow-hidden">
        <button
          className="w-full flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/50 transition-colors"
          onClick={() => toggle('migrations')}
        >
          <span className="font-medium">Schema Migrations ({DEMO_MIGRATIONS.length})</span>
          {expandedSection === 'migrations' ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        {expandedSection === 'migrations' && (
          <div className="divide-y">
            {DEMO_MIGRATIONS.map(m => (
              <div key={m.sequence} className="p-4 flex items-center gap-3">
                <span className="text-xs font-mono text-muted-foreground w-6 text-right">{m.sequence}</span>
                <span className="text-sm flex-1">{m.description}</span>
                <Badge variant={m.reversible ? 'default' : 'destructive'} className="text-xs">
                  {m.reversible ? 'reversible' : 'irreversible'}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Global config */}
      <div className="border rounded-lg p-4 text-sm space-y-1.5">
        <p className="font-medium mb-2">Global Config</p>
        <p className="text-muted-foreground">Rollback retention: <span className="text-foreground">7 days</span></p>
        <p className="text-muted-foreground">Health check timeout: <span className="text-foreground">60 seconds</span></p>
        <p className="text-muted-foreground">Notification channels: <span className="text-foreground">in-app, email</span></p>
      </div>
    </div>
  );
}
