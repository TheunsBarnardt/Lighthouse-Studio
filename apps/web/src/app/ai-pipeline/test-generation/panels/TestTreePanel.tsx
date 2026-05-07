'use client';

import { ChevronRight, ChevronDown, FileCode2 } from 'lucide-react';
import { useState } from 'react';

interface TestFile {
  id: string;
  filePath: string;
  testType: 'unit' | 'component' | 'integration' | 'e2e';
  status: 'draft' | 'approved' | 'stale';
}

interface Props {
  selectedId: string | null;
  onSelect(id: string): void;
}

const TEST_TYPE_COLORS: Record<string, string> = {
  unit: 'text-blue-600',
  component: 'text-purple-600',
  integration: 'text-amber-600',
  e2e: 'text-green-600',
};

const STATUS_DOT: Record<string, string> = {
  draft: 'bg-muted-foreground',
  approved: 'bg-green-500',
  stale: 'bg-amber-500',
};

const DEMO_FILES: TestFile[] = [
  { id: 'tf-tc-ac001-unit-1', filePath: 'src/__tests__/unit/tc-ac001-unit-1.test.ts', testType: 'unit', status: 'draft' },
  { id: 'tf-tc-ac001-integration-1', filePath: 'src/__tests__/integration/tc-ac001-integration-1.test.ts', testType: 'integration', status: 'draft' },
  { id: 'tf-tc-ac002-unit-1', filePath: 'src/__tests__/unit/tc-ac002-unit-1.test.ts', testType: 'unit', status: 'approved' },
  { id: 'tf-tc-ac002-e2e-1', filePath: 'src/__tests__/e2e/tc-ac002-e2e-1.test.ts', testType: 'e2e', status: 'draft' },
  { id: 'tf-tc-ac003-component-1', filePath: 'src/__tests__/component/tc-ac003-component-1.test.tsx', testType: 'component', status: 'draft' },
];

export function TestTreePanel({ selectedId, onSelect }: Props) {
  const groups = DEMO_FILES.reduce<Record<string, TestFile[]>>((acc, f) => {
    if (!acc[f.testType]) acc[f.testType] = [];
    acc[f.testType].push(f);
    return acc;
  }, {});

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggle = (group: string) => setCollapsed(prev => ({ ...prev, [group]: !prev[group] }));

  if (DEMO_FILES.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm p-4 text-center">
        No test files yet. Generate the test suite to create them.
      </div>
    );
  }

  return (
    <div className="py-2">
      {(['unit', 'component', 'integration', 'e2e'] as const).map(type => {
        const files = groups[type] ?? [];
        if (files.length === 0) return null;
        const isCollapsed = collapsed[type];
        return (
          <div key={type}>
            <button
              onClick={() => toggle(type)}
              className="w-full flex items-center gap-1 px-3 py-1 hover:bg-muted/40 text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              <span className={TEST_TYPE_COLORS[type]}>{type}</span>
              <span className="ml-auto">{files.length}</span>
            </button>
            {!isCollapsed && files.map(f => (
              <button
                key={f.id}
                onClick={() => onSelect(f.id)}
                className={`w-full flex items-center gap-2 px-4 py-1.5 text-sm hover:bg-muted/40 transition-colors ${
                  selectedId === f.id ? 'bg-muted' : ''
                }`}
              >
                <FileCode2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate text-left flex-1">{f.filePath.split('/').pop()}</span>
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${STATUS_DOT[f.status]}`} />
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}
