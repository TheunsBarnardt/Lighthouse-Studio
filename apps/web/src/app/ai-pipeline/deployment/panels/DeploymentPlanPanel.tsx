'use client';

import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

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
  {
    name: 'staging',
    autoDeploy: false,
    testsRequired: true,
    deployMode: 'rolling',
    approvers: ['workspace_admin'],
  },
  {
    name: 'prod',
    autoDeploy: false,
    testsRequired: true,
    deployMode: 'blue_green',
    approvers: ['architect', 'workspace_owner'],
  },
];

const DEMO_MIGRATIONS = [
  { sequence: 1, description: 'Add deal_score column to contacts', reversible: true },
  { sequence: 2, description: 'Create activities index', reversible: true },
];

const DEMO_IRREVERSIBLE: IrreversibleOp[] = [];

interface Props {
  onApproved: () => void;
}

export function DeploymentPlanPanel({ onApproved: onApprovedProp }: Props) {
  const onApproved = () => {
    onApprovedProp();
  };
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>('environments');

  const toggle = (s: string) => {
    setExpandedSection((prev) => (prev === s ? null : s));
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsGenerating(false);
    setIsGenerated(true);
  };

  if (!isGenerated) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: 16,
          padding: 32,
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: 440 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
            Generate Deployment Plan
          </h2>
          <p style={{ fontSize: 13, marginBottom: 24 }}>
            The deployment plan defines how your application will be deployed across dev, staging,
            and production environments, including schema migration sequencing and health checks.
          </p>
          <Button
            type="button"
            onClick={() => {
              void handleGenerate();
            }}
            disabled={isGenerating}
          >
            {isGenerating ? 'Generating…' : 'Generate Deployment Plan'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflowY: 'auto',
        padding: 24,
        gap: 16,
        maxWidth: 720,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontWeight: 600, fontSize: 14 }}>Deployment Plan v0.0.1</h2>
          <p style={{ fontSize: 12, marginTop: 2 }}>
            3 environments · {DEMO_MIGRATIONS.length} migrations · {DEMO_IRREVERSIBLE.length}{' '}
            irreversible operations
          </p>
        </div>
        <Button
          size="sm"
          type="button"
          onClick={() => {
            onApproved();
          }}
        >
          Approve Plan
        </Button>
      </div>

      {DEMO_IRREVERSIBLE.length > 0 && (
        <div
          style={{
            borderRadius: 6,
            border: '1px solid var(--fg-danger)',
            background: 'color-mix(in srgb, var(--fg-danger) 6%, transparent)',
            padding: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <AlertTriangle style={{ width: 16, height: 16 }} />
            <span style={{ fontWeight: 500 }}>
              {DEMO_IRREVERSIBLE.length} irreversible operations
            </span>
          </div>
          {DEMO_IRREVERSIBLE.map((op, i) => (
            <p key={i} style={{ fontSize: 13 }}>
              {op.description}: {op.warning}
            </p>
          ))}
        </div>
      )}

      {/* Environments */}
      <div
        style={{ border: '1px solid var(--border-default)', borderRadius: 6, overflow: 'hidden' }}
      >
        <Button
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 16,
            border: 'none',
            cursor: 'pointer',
          }}
          onClick={() => {
            toggle('environments');
          }}
        >
          <span style={{ fontWeight: 500, fontSize: 13 }}>
            Environments ({DEMO_ENVIRONMENTS.length})
          </span>
          {expandedSection === 'environments' ? (
            <ChevronDown style={{ width: 16, height: 16 }} />
          ) : (
            <ChevronRight style={{ width: 16, height: 16 }} />
          )}
        </Button>
        {expandedSection === 'environments' && (
          <div>
            {DEMO_ENVIRONMENTS.map((env, idx) => (
              <div
                key={env.name}
                style={{
                  padding: 16,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 16,
                  borderTop: idx > 0 ? '1px solid var(--border-default)' : undefined,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 500, fontSize: 13 }}>{env.name}</span>
                    {env.autoDeploy && (
                      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        auto-deploy
                      </span>
                    )}
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {env.deployMode.replace('_', '/')}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                    }}
                  >
                    <p>Tests required: {env.testsRequired ? 'yes' : 'no'}</p>
                    <p>
                      Approvers:{' '}
                      {env.approvers.length > 0 ? env.approvers.join(', ') : 'none (auto)'}
                    </p>
                  </div>
                </div>
                <CheckCircle2 style={{ width: 16, height: 16, marginTop: 2 }} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Schema migrations */}
      <div
        style={{ border: '1px solid var(--border-default)', borderRadius: 6, overflow: 'hidden' }}
      >
        <Button
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 16,
            border: 'none',
            cursor: 'pointer',
          }}
          onClick={() => {
            toggle('migrations');
          }}
        >
          <span style={{ fontWeight: 500, fontSize: 13 }}>
            Schema Migrations ({DEMO_MIGRATIONS.length})
          </span>
          {expandedSection === 'migrations' ? (
            <ChevronDown style={{ width: 16, height: 16 }} />
          ) : (
            <ChevronRight style={{ width: 16, height: 16 }} />
          )}
        </Button>
        {expandedSection === 'migrations' && (
          <div>
            {DEMO_MIGRATIONS.map((m, idx) => (
              <div
                key={m.sequence}
                style={{
                  padding: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  borderTop: idx > 0 ? '1px solid var(--border-default)' : undefined,
                }}
              >
                <span
                  className="font-mono text-sm"
                  style={{
                    fontSize: 11,
                    width: 24,
                    textAlign: 'right',
                  }}
                >
                  {m.sequence}
                </span>
                <span style={{ fontSize: 13, flex: 1 }}>{m.description}</span>
                <span
                  className={`inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground ${m.reversible ? 'inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive'}`}
                >
                  {m.reversible ? 'reversible' : 'irreversible'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Global config */}
      <div
        style={{
          border: '1px solid var(--border-default)',
          borderRadius: 6,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <p style={{ fontWeight: 500, fontSize: 13, marginBottom: 4 }}>Global Config</p>
        <p style={{ fontSize: 12 }}>
          Rollback retention: <span>7 days</span>
        </p>
        <p style={{ fontSize: 12 }}>
          Health check timeout: <span>60 seconds</span>
        </p>
        <p style={{ fontSize: 12 }}>
          Notification channels: <span>in-app, email</span>
        </p>
      </div>
    </div>
  );
}
