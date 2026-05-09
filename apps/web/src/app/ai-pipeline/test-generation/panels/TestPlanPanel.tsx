'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';

interface TestCase {
  id: string;
  acId: string;
  testType: 'unit' | 'component' | 'integration' | 'e2e';
  description: string;
}

interface UncoveredAc {
  acId: string;
  reason: string;
}

const TEST_TYPE_BADGE: Record<string, string> = {
  unit: 'inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground',
  component:
    'inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  integration:
    'inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  e2e: 'inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};

const DEMO_TEST_CASES: TestCase[] = [
  {
    id: 'tc-ac001-unit-1',
    acId: 'AC-001',
    testType: 'unit',
    description: 'should register user with hashed password',
  },
  {
    id: 'tc-ac001-integration-1',
    acId: 'AC-001',
    testType: 'integration',
    description: 'POST /auth/register returns 201 with user object',
  },
  {
    id: 'tc-ac002-unit-1',
    acId: 'AC-002',
    testType: 'unit',
    description: 'should return JWT on valid credentials',
  },
  {
    id: 'tc-ac002-e2e-1',
    acId: 'AC-002',
    testType: 'e2e',
    description: 'user can log in and see dashboard',
  },
  {
    id: 'tc-ac003-component-1',
    acId: 'AC-003',
    testType: 'component',
    description: 'LoginForm shows error on invalid email',
  },
];

const DEMO_UNCOVERED: UncoveredAc[] = [
  { acId: 'AC-010', reason: 'Requires manual verification of payment flow' },
];

interface Props {
  onPlanReady: () => void;
}

export function TestPlanPanel({ onPlanReady: onPlanReadyProp }: Props) {
  const onPlanReady = () => {
    onPlanReadyProp();
  };
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  const handleGenerate = async () => {
    setIsGenerating(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsGenerating(false);
    setIsGenerated(true);
  };

  const filtered =
    filter === 'all' ? DEMO_TEST_CASES : DEMO_TEST_CASES.filter((tc) => tc.testType === filter);

  const counts = {
    unit: DEMO_TEST_CASES.filter((tc) => tc.testType === 'unit').length,
    component: DEMO_TEST_CASES.filter((tc) => tc.testType === 'component').length,
    integration: DEMO_TEST_CASES.filter((tc) => tc.testType === 'integration').length,
    e2e: DEMO_TEST_CASES.filter((tc) => tc.testType === 'e2e').length,
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
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Generate Test Plan</h2>
          <p style={{ fontSize: 13, marginBottom: 24 }}>
            The test plan analyses your PRD acceptance criteria and maps each AC to specific test
            cases, selecting the right test type for each scenario.
          </p>
          <Button
            type="button"
            onClick={() => {
              void handleGenerate();
            }}
            disabled={isGenerating}
          >
            {isGenerating ? 'Generating…' : 'Generate Test Plan'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>{DEMO_TEST_CASES.length} test cases</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['all', 'unit', 'component', 'integration', 'e2e'] as const).map((f) => (
              <Button
                key={f}
                onClick={() => {
                  setFilter(f);
                }}
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 12,
                  border: '1px solid var(--border-default)',
                  background: filter === f ? 'var(--accent-primary)' : 'transparent',
                  color: filter === f ? '#fff' : 'var(--fg-secondary)',
                  cursor: 'pointer',
                }}
              >
                {f === 'all'
                  ? `All (${String(DEMO_TEST_CASES.length)})`
                  : `${f} (${String(counts[f])})`}
              </Button>
            ))}
          </div>
        </div>
        <Button
          size="sm"
          type="button"
          onClick={() => {
            onPlanReady();
          }}
        >
          Approve &amp; Generate Suite →
        </Button>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {filtered.map((tc) => (
          <div
            key={tc.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: 12,
              borderRadius: 6,
              border: '1px solid var(--border-default)',
            }}
          >
            <span
              className="font-mono text-sm"
              style={{
                fontSize: 11,
                marginTop: 2,
                width: 64,
                flexShrink: 0,
              }}
            >
              {tc.acId}
            </span>
            <span className={TEST_TYPE_BADGE[tc.testType]} style={{ marginTop: 2 }}>
              {tc.testType}
            </span>
            <span style={{ fontSize: 13 }}>{tc.description}</span>
          </div>
        ))}

        {DEMO_UNCOVERED.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <p
              style={{
                fontSize: 11,
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 8,
              }}
            >
              Uncovered ACs ({DEMO_UNCOVERED.length})
            </p>
            {DEMO_UNCOVERED.map((uc) => (
              <div
                key={uc.acId}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: 12,
                  borderRadius: 6,
                  border: '1px solid var(--fg-warning)',
                  background: 'color-mix(in srgb, var(--fg-warning) 8%, transparent)',
                }}
              >
                <span
                  className="font-mono text-sm"
                  style={{ fontSize: 11, width: 64, flexShrink: 0 }}
                >
                  {uc.acId}
                </span>
                <span style={{ fontSize: 13 }}>{uc.reason}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
