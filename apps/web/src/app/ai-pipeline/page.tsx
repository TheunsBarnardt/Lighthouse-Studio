'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button';

// Pipeline stepper â€” shared visual component used across all stage pages
function PipelineStepper({ active }: { active: string }) {
  const steps = [
    { id: 'intent', label: 'Intent', href: '/ai-pipeline/intent-capture', status: 'complete' },
    { id: 'prd', label: 'Requirements', href: '/ai-pipeline/prd-generation', status: 'complete' },
    {
      id: 'design-tokens',
      label: 'Design tokens',
      href: '/ai-pipeline/design-tokens',
      status: 'complete',
    },
    {
      id: 'schema-synthesis',
      label: 'Schema',
      href: '/ai-pipeline/schema-synthesis',
      status: 'complete',
    },
    {
      id: 'data-migration',
      label: 'Migration',
      href: '/ai-pipeline/data-migration',
      status: 'pending',
    },
    { id: 'ui-gen', label: 'UI gen', href: '/ai-pipeline/ui-generation', status: 'in_review' },
    { id: 'code-gen', label: 'Code gen', href: '/ai-pipeline/code-generation', status: 'pending' },
    { id: 'test-gen', label: 'Tests', href: '/ai-pipeline/test-generation', status: 'pending' },
    { id: 'deployment', label: 'Deployment', href: '/ai-pipeline/deployment', status: 'pending' },
    {
      id: 'maintenance',
      label: 'Maintenance',
      href: '/ai-pipeline/maintenance',
      status: 'pending',
    },
  ];

  return (
    <div className="flex shrink-0 items-center overflow-x-auto border-b bg-card px-6 py-2.5">
      {steps.map((step, i) => (
        <span key={step.id} style={{ display: 'contents' }}>
          <Link
            href={step.href}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded transition-colors${step.id === active ? ' bg-primary/10 text-primary' : step.status === 'complete' ? ' text-muted-foreground hover:text-foreground' : ' text-muted-foreground/60'}`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
            {step.label}
          </Link>
          {i < steps.length - 1 && <span className="mx-0.5 text-sm text-muted-foreground">â€º</span>}
        </span>
      ))}
    </div>
  );
}

interface Stage {
  number: number;
  name: string;
  status: 'approved' | 'in_review' | 'pending';
  detail: string;
  href: string;
}

const STAGES: Stage[] = [
  {
    number: 1,
    name: 'Intent capture',
    status: 'approved',
    detail: '5 turns Â· $0.34 Â· Approved by Joana',
    href: '/ai-pipeline/intent-capture',
  },
  {
    number: 2,
    name: 'Requirements (PRD)',
    status: 'approved',
    detail: '10 sections Â· $2.10 Â· Approved by Marcus',
    href: '/ai-pipeline/prd-generation',
  },
  {
    number: 3,
    name: 'Design tokens',
    status: 'approved',
    detail: 'Light + dark Â· WCAG AA Â· $0.85',
    href: '/ai-pipeline/design-tokens',
  },
  {
    number: 4,
    name: 'Schema synthesis',
    status: 'approved',
    detail: '8 tables Â· 47 columns Â· 12 PII flags Â· $1.20',
    href: '/ai-pipeline/schema-synthesis',
  },
  {
    number: 5,
    name: 'Data migration',
    status: 'pending',
    detail: 'Greenfield project â€” no migration needed',
    href: '/ai-pipeline/data-migration',
  },
  {
    number: 6,
    name: 'UI generation',
    status: 'in_review',
    detail: '14 components Â· 4 awaiting review Â· $18.50',
    href: '/ai-pipeline/ui-generation',
  },
  {
    number: 7,
    name: 'Code generation',
    status: 'pending',
    detail: '7 functions inventoried Â· 0 generated',
    href: '/ai-pipeline/code-generation',
  },
  {
    number: 8,
    name: 'Tests',
    status: 'pending',
    detail: 'Not started',
    href: '/ai-pipeline/test-generation',
  },
  {
    number: 9,
    name: 'Deployment',
    status: 'pending',
    detail: 'Not started',
    href: '/ai-pipeline/deployment',
  },
  {
    number: 10,
    name: 'Maintenance',
    status: 'pending',
    detail: 'Not started',
    href: '/ai-pipeline/maintenance',
  },
];

function StageIndicator({ status, number }: { status: Stage['status']; number: number }) {
  const base: React.CSSProperties = {
    width: 28,
    height: 28,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 600,
    flexShrink: 0,
  };
  if (status === 'approved') {
    return <div style={{ ...base, background: 'oklch(0.96 0.04 145)' }}>{number}</div>;
  }
  if (status === 'in_review') {
    return <div style={{ ...base, background: 'oklch(0.97 0.05 75)' }}>{number}</div>;
  }
  return <div style={{ ...base, background: 'var(--muted)' }}>{number}</div>;
}

function StatusBadge({ status }: { status: Stage['status'] }) {
  if (status === 'approved')
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
        Approved
      </span>
    );
  if (status === 'in_review')
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
        In review
      </span>
    );
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      Pending
    </span>
  );
}

export default function AiPipelineOverviewPage() {
  const stagesComplete = STAGES.filter((s) => s.status === 'approved').length;

  return (
    <div>
      <PipelineStepper active="intent" />
      <div className="mx-auto max-w-[1440px] p-6" style={{ maxWidth: 1280 }}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h1>Internal CRM</h1>
            <div className="subtitle">
              CRM to replace spreadsheet tracking for an 8-person sales team Â· Created Apr 15, 2026
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" type="button">
              Settings
            </Button>
            <Link
              href="/ai-pipeline/ui-generation"
              className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Continue at UI generation
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Stages complete', value: `${String(stagesComplete)} / 10` },
            { label: 'Total cost', value: '$22.99' },
            { label: 'Components', value: '14' },
            { label: 'Tests passing', value: '87 / 87' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-md border bg-card p-4">
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                {stat.label}
              </div>
              <div className="text-[22px] font-semibold tabular-nums">{stat.value}</div>
            </div>
          ))}
        </div>

        <div className="rounded-md border bg-card text-card-foreground p-4">
          <div className="mb-3 flex items-center justify-between border-b pb-3">
            <span className="text-sm font-semibold">Stage progress</span>
          </div>
          {STAGES.map((stage, i) => (
            <Link
              key={stage.number}
              href={stage.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 0',
                borderBottom: i < STAGES.length - 1 ? '1px solid var(--border)' : 'none',
                textDecoration: 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <StageIndicator status={stage.status} number={stage.number} />
                <div>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{stage.name}</div>
                  <div style={{ fontSize: 12, marginTop: 2 }}>{stage.detail}</div>
                </div>
              </div>
              <StatusBadge status={stage.status} />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
