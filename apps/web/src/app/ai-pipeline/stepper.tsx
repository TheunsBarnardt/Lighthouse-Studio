'use client';

import Link from 'next/link';

const STEPS = [
  { id: 'intent', label: 'Intent', href: '/ai-pipeline/intent-capture', status: 'complete' },
  { id: 'prd', label: 'Requirements', href: '/ai-pipeline/prd-generation', status: 'complete' },
  { id: 'ui-gen', label: 'UI gen', href: '/ai-pipeline/ui-generation', status: 'in_review' },
  {
    id: 'schema-synthesis',
    label: 'Schema',
    href: '/ai-pipeline/schema-synthesis',
    status: 'pending',
  },
  {
    id: 'data-migration',
    label: 'Migration',
    href: '/ai-pipeline/data-migration',
    status: 'pending',
  },
  { id: 'code-gen', label: 'Code gen', href: '/ai-pipeline/code-generation', status: 'pending' },
  { id: 'test-gen', label: 'Tests', href: '/ai-pipeline/test-generation', status: 'pending' },
  { id: 'deployment', label: 'Deployment', href: '/ai-pipeline/deployment', status: 'pending' },
];

export function PipelineStepper({ active }: { active: string }) {
  return (
    <div className="flex shrink-0 items-center overflow-x-auto border-b bg-card px-6 py-2.5">
      {STEPS.map((step, i) => (
        <span key={step.id} style={{ display: 'contents' }}>
          <Link
            href={step.href}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded transition-colors${step.id === active ? ' bg-primary/10 text-primary' : step.status === 'complete' ? ' text-muted-foreground hover:text-foreground' : ' text-muted-foreground/60'}`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${step.id === active ? 'bg-primary' : step.status === 'complete' ? 'bg-muted-foreground' : 'bg-muted-foreground/30'}`}
            />
            {step.label}
          </Link>
          {i < STEPS.length - 1 && <span className="mx-0.5 text-sm text-muted-foreground">›</span>}
        </span>
      ))}
    </div>
  );
}
