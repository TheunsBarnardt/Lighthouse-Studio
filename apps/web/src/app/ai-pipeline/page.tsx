'use client';

import Link from 'next/link';

// Pipeline stepper — shared visual component used across all stage pages
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
    <div className="pg-pipeline-stepper">
      {steps.map((step, i) => (
        <span key={step.id} style={{ display: 'contents' }}>
          <Link
            href={step.href}
            className={`pg-pipeline-step${step.id === active ? ' active' : step.status === 'complete' ? ' complete' : ''}`}
          >
            <span className="step-dot" />
            {step.label}
          </Link>
          {i < steps.length - 1 && <span className="pg-pipeline-arrow">›</span>}
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
    detail: '5 turns · $0.34 · Approved by Joana',
    href: '/ai-pipeline/intent-capture',
  },
  {
    number: 2,
    name: 'Requirements (PRD)',
    status: 'approved',
    detail: '10 sections · $2.10 · Approved by Marcus',
    href: '/ai-pipeline/prd-generation',
  },
  {
    number: 3,
    name: 'Design tokens',
    status: 'approved',
    detail: 'Light + dark · WCAG AA · $0.85',
    href: '/ai-pipeline/design-tokens',
  },
  {
    number: 4,
    name: 'Schema synthesis',
    status: 'approved',
    detail: '8 tables · 47 columns · 12 PII flags · $1.20',
    href: '/ai-pipeline/schema-synthesis',
  },
  {
    number: 5,
    name: 'Data migration',
    status: 'pending',
    detail: 'Greenfield project — no migration needed',
    href: '/ai-pipeline/data-migration',
  },
  {
    number: 6,
    name: 'UI generation',
    status: 'in_review',
    detail: '14 components · 4 awaiting review · $18.50',
    href: '/ai-pipeline/ui-generation',
  },
  {
    number: 7,
    name: 'Code generation',
    status: 'pending',
    detail: '7 functions inventoried · 0 generated',
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
    return (
      <div style={{ ...base, background: 'var(--bg-success-subtle)', color: 'var(--fg-success)' }}>
        {number}
      </div>
    );
  }
  if (status === 'in_review') {
    return (
      <div style={{ ...base, background: 'var(--bg-warning-subtle)', color: 'var(--fg-warning)' }}>
        {number}
      </div>
    );
  }
  return (
    <div style={{ ...base, background: 'var(--bg-surface-3)', color: 'var(--fg-tertiary)' }}>
      {number}
    </div>
  );
}

function StatusBadge({ status }: { status: Stage['status'] }) {
  if (status === 'approved') return <span className="pg-badge pg-badge-success">Approved</span>;
  if (status === 'in_review') return <span className="pg-badge pg-badge-warning">In review</span>;
  return <span className="pg-badge pg-badge-default">Pending</span>;
}

export default function AiPipelineOverviewPage() {
  const stagesComplete = STAGES.filter((s) => s.status === 'approved').length;

  return (
    <div>
      <PipelineStepper active="intent" />
      <div className="pg-page" style={{ maxWidth: 1280 }}>
        <div className="pg-page-header">
          <div>
            <h1>Internal CRM</h1>
            <div className="subtitle">
              CRM to replace spreadsheet tracking for an 8-person sales team · Created Apr 15, 2026
            </div>
          </div>
          <div className="pg-page-header-actions">
            <button className="pg-btn pg-btn-secondary pg-btn-sm">Settings</button>
            <Link href="/ai-pipeline/ui-generation" className="pg-btn pg-btn-primary pg-btn-sm">
              Continue at UI generation
            </Link>
          </div>
        </div>

        <div className="pg-grid pg-grid-4 pg-mb-6">
          {[
            { label: 'Stages complete', value: `${String(stagesComplete)} / 10` },
            { label: 'Total cost', value: '$22.99' },
            { label: 'Components', value: '14' },
            { label: 'Tests passing', value: '87 / 87' },
          ].map((stat) => (
            <div key={stat.label} className="pg-stat-card">
              <div className="pg-stat-label">{stat.label}</div>
              <div className="pg-stat-value">{stat.value}</div>
            </div>
          ))}
        </div>

        <div className="pg-card">
          <div className="pg-card-header">
            <span className="pg-card-title">Stage progress</span>
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
                borderBottom: i < STAGES.length - 1 ? '1px solid var(--border-default)' : 'none',
                textDecoration: 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <StageIndicator status={stage.status} number={stage.number} />
                <div>
                  <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--fg-primary)' }}>
                    {stage.name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--fg-tertiary)', marginTop: 2 }}>
                    {stage.detail}
                  </div>
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
