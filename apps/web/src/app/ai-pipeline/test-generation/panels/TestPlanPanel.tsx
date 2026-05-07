'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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

const TEST_TYPE_COLORS: Record<string, string> = {
  unit: 'bg-blue-100 text-blue-800',
  component: 'bg-purple-100 text-purple-800',
  integration: 'bg-amber-100 text-amber-800',
  e2e: 'bg-green-100 text-green-800',
};

const DEMO_TEST_CASES: TestCase[] = [
  { id: 'tc-ac001-unit-1', acId: 'AC-001', testType: 'unit', description: 'should register user with hashed password' },
  { id: 'tc-ac001-integration-1', acId: 'AC-001', testType: 'integration', description: 'POST /auth/register returns 201 with user object' },
  { id: 'tc-ac002-unit-1', acId: 'AC-002', testType: 'unit', description: 'should return JWT on valid credentials' },
  { id: 'tc-ac002-e2e-1', acId: 'AC-002', testType: 'e2e', description: 'user can log in and see dashboard' },
  { id: 'tc-ac003-component-1', acId: 'AC-003', testType: 'component', description: 'LoginForm shows error on invalid email' },
];

const DEMO_UNCOVERED: UncoveredAc[] = [
  { acId: 'AC-010', reason: 'Requires manual verification of payment flow' },
];

interface Props {
  onPlanReady(): void;
}

export function TestPlanPanel({ onPlanReady }: Props) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  const handleGenerate = async () => {
    setIsGenerating(true);
    await new Promise(r => setTimeout(r, 2000));
    setIsGenerating(false);
    setIsGenerated(true);
  };

  const filtered = filter === 'all'
    ? DEMO_TEST_CASES
    : DEMO_TEST_CASES.filter(tc => tc.testType === filter);

  const counts = {
    unit: DEMO_TEST_CASES.filter(tc => tc.testType === 'unit').length,
    component: DEMO_TEST_CASES.filter(tc => tc.testType === 'component').length,
    integration: DEMO_TEST_CASES.filter(tc => tc.testType === 'integration').length,
    e2e: DEMO_TEST_CASES.filter(tc => tc.testType === 'e2e').length,
  };

  if (!isGenerated) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-semibold mb-2">Generate Test Plan</h2>
          <p className="text-muted-foreground text-sm mb-6">
            The test plan analyses your PRD acceptance criteria and maps each AC to specific test cases,
            selecting the right test type for each scenario.
          </p>
          <Button onClick={handleGenerate} disabled={isGenerating} size="lg">
            {isGenerating ? 'Generating…' : 'Generate Test Plan'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">{DEMO_TEST_CASES.length} test cases</span>
          <div className="flex gap-1">
            {(['all', 'unit', 'component', 'integration', 'e2e'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                  filter === f ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
                }`}
              >
                {f === 'all' ? `All (${DEMO_TEST_CASES.length})` : `${f} (${counts[f as keyof typeof counts]})`}
              </button>
            ))}
          </div>
        </div>
        <Button size="sm" onClick={onPlanReady}>Approve & Generate Suite →</Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {filtered.map(tc => (
          <div key={tc.id} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/30">
            <span className="text-xs text-muted-foreground font-mono mt-0.5 w-20 shrink-0">{tc.acId}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium mt-0.5 ${TEST_TYPE_COLORS[tc.testType]}`}>
              {tc.testType}
            </span>
            <span className="text-sm">{tc.description}</span>
          </div>
        ))}

        {DEMO_UNCOVERED.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Uncovered ACs ({DEMO_UNCOVERED.length})
            </p>
            {DEMO_UNCOVERED.map(uc => (
              <div key={uc.acId} className="flex items-start gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50">
                <span className="text-xs font-mono text-amber-700 w-20 shrink-0">{uc.acId}</span>
                <span className="text-sm text-amber-800">{uc.reason}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
