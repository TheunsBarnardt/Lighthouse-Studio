'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TestPlanPanel } from './panels/TestPlanPanel';
import { TestTreePanel } from './panels/TestTreePanel';
import { TestViewPanel } from './panels/TestViewPanel';
import { TestRunPanel } from './panels/TestRunPanel';
import { CoveragePanel } from './panels/CoveragePanel';
import { RunTestsDialog } from './dialogs/RunTestsDialog';

type Stage = 'plan' | 'suite' | 'run';

const STAGE_LABELS: Record<Stage, string> = {
  plan: 'Test Plan',
  suite: 'Test Suite',
  run: 'Test Runs',
};

export default function TestGenerationPage() {
  const [stage, setStage] = useState<Stage>('plan');
  const [selectedTestFileId, setSelectedTestFileId] = useState<string | null>(null);
  const [showRunDialog, setShowRunDialog] = useState(false);

  const planReady = true;
  const suiteReady = false;

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-background px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold">Stage 8: Test Generation</h1>
          <div className="flex items-center gap-1">
            {(['plan', 'suite', 'run'] as Stage[]).map((s, i) => (
              <div key={s} className="flex items-center gap-1">
                <button
                  onClick={() => setStage(s)}
                  className={`text-sm px-3 py-1 rounded-full transition-colors ${
                    stage === s
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {i + 1}. {STAGE_LABELS[s]}
                </button>
                {i < 2 && <span className="text-muted-foreground">›</span>}
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {stage === 'suite' && (
            <Button onClick={() => setShowRunDialog(true)} size="sm">
              Run Tests
            </Button>
          )}
          {stage === 'plan' && planReady && (
            <Button onClick={() => setStage('suite')} size="sm">
              Generate Test Suite →
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {stage === 'plan' && (
          <div className="flex-1">
            <TestPlanPanel onPlanReady={() => setStage('suite')} />
          </div>
        )}

        {stage === 'suite' && (
          <>
            <div className="w-72 border-r flex flex-col">
              <div className="p-3 border-b bg-muted/30">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Test Files</span>
                  <Badge variant="secondary">0 files</Badge>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                <TestTreePanel
                  selectedId={selectedTestFileId}
                  onSelect={setSelectedTestFileId}
                />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              {selectedTestFileId ? (
                <TestViewPanel testFileId={selectedTestFileId} />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Select a test file to view its source
                </div>
              )}
            </div>
            <div className="w-80 border-l">
              <CoveragePanel />
            </div>
          </>
        )}

        {stage === 'run' && (
          <div className="flex-1">
            <TestRunPanel />
          </div>
        )}
      </div>

      {showRunDialog && (
        <RunTestsDialog
          onClose={() => setShowRunDialog(false)}
          onStarted={() => { setShowRunDialog(false); setStage('run'); }}
        />
      )}
    </div>
  );
}
