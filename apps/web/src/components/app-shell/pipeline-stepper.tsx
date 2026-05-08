'use client';

import Link from 'next/link';

const PIPELINE_STAGES = [
  { key: 'intent-capture', label: 'Intent', href: '/ai-pipeline/intent-capture' },
  { key: 'prd-generation', label: 'PRD', href: '/ai-pipeline/prd-generation' },
  { key: 'design-tokens', label: 'Tokens', href: '/ai-pipeline/design-tokens' },
  { key: 'schema-synthesis', label: 'Schema', href: '/ai-pipeline/schema-synthesis' },
  { key: 'data-migration', label: 'Migrate', href: '/ai-pipeline/data-migration' },
  { key: 'ui-generation', label: 'UI', href: '/ai-pipeline/ui-generation' },
  { key: 'code-generation', label: 'Code', href: '/ai-pipeline/code-generation' },
  { key: 'test-generation', label: 'Tests', href: '/ai-pipeline/test-generation' },
  { key: 'deployment', label: 'Deploy', href: '/ai-pipeline/deployment' },
  { key: 'maintenance', label: 'Maintain', href: '/ai-pipeline/maintenance' },
];

// Ordered stage keys for determining completion
const STAGE_ORDER = PIPELINE_STAGES.map((s) => s.key);

interface PipelineStepperProps {
  activeStage: string;
}

export function PipelineStepper({ activeStage }: PipelineStepperProps) {
  const activeIdx = STAGE_ORDER.indexOf(activeStage);

  return (
    <div
      className="flex items-center gap-1 overflow-x-auto px-4 py-0 border-b"
      style={{
        height: '44px',
        borderColor: 'var(--border-default, #e5e7eb)',
        background: 'var(--bg-surface, #fff)',
        flexShrink: 0,
      }}
    >
      {PIPELINE_STAGES.map((stage, i) => {
        const isActive = i === activeIdx;
        const isComplete = i < activeIdx;
        return (
          <div key={stage.key} className="flex items-center gap-1">
            {i > 0 && (
              <span
                className="text-[10px] select-none"
                style={{ color: 'var(--fg-tertiary, #9ca3af)' }}
                aria-hidden="true"
              >
                ›
              </span>
            )}
            <Link
              href={stage.href}
              className="flex items-center gap-1.5 rounded px-2 py-1 text-[11px] no-underline whitespace-nowrap transition-colors hover:no-underline"
              style={{
                background: isActive ? 'var(--bg-selected, #e8edfd)' : 'transparent',
                color: isActive
                  ? 'var(--accent-primary, #3b6cf4)'
                  : isComplete
                    ? 'var(--fg-success, #16a34a)'
                    : 'var(--fg-secondary, #6b7280)',
                fontWeight: isActive ? 500 : 400,
              }}
            >
              {/* Dot indicator */}
              <span
                className="relative flex-shrink-0"
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  border: `1.5px solid currentColor`,
                  background: isActive ? 'currentColor' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                aria-hidden="true"
              >
                {isComplete && (
                  <span
                    style={{
                      position: 'absolute',
                      display: 'block',
                      width: '4px',
                      height: '6px',
                      borderRight: '1.5px solid white',
                      borderBottom: '1.5px solid white',
                      transform: 'rotate(45deg) translate(-1px, -1px)',
                    }}
                  />
                )}
              </span>
              {stage.label}
            </Link>
          </div>
        );
      })}
    </div>
  );
}
