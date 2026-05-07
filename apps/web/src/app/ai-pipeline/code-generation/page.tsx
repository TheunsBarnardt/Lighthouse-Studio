'use client';

import { useState } from 'react';
import { InventoryPanel } from './panels/InventoryPanel.js';
import { FunctionViewPanel } from './panels/FunctionViewPanel.js';
import { RegenerateFunctionDialog } from './dialogs/RegenerateFunctionDialog.js';
import { RollbackFunctionDialog } from './dialogs/RollbackFunctionDialog.js';

type ViewMode = 'inventory' | 'review';

interface MockFunction {
  id: string;
  name: string;
  triggerType: 'http' | 'schedule' | 'event' | 'manual';
  status: 'draft' | 'validated' | 'approved' | 'rejected';
  staticAnalysisPassed: boolean;
  typeCheckPassed: boolean;
}

const MOCK_FUNCTIONS: MockFunction[] = [
  { id: 'fn-1', name: 'update_contact_score', triggerType: 'http', status: 'approved', staticAnalysisPassed: true, typeCheckPassed: true },
  { id: 'fn-2', name: 'notify_high_value_contact', triggerType: 'event', status: 'draft', staticAnalysisPassed: true, typeCheckPassed: true },
  { id: 'fn-3', name: 'weekly_deal_summary', triggerType: 'schedule', status: 'draft', staticAnalysisPassed: true, typeCheckPassed: true },
  { id: 'fn-4', name: 'create_checkout_session', triggerType: 'http', status: 'validated', staticAnalysisPassed: true, typeCheckPassed: true },
  { id: 'fn-5', name: 'send_welcome_email', triggerType: 'event', status: 'draft', staticAnalysisPassed: false, typeCheckPassed: true },
];

export default function CodeGenerationPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('inventory');
  const [selectedFn, setSelectedFn] = useState<MockFunction | null>(null);
  const [showRegenerate, setShowRegenerate] = useState(false);
  const [showRollback, setShowRollback] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [functions, setFunctions] = useState<MockFunction[]>(MOCK_FUNCTIONS);

  const approvedCount = functions.filter(f => f.status === 'approved').length;
  const totalCount = functions.length;

  async function handleGenerate() {
    setIsGenerating(true);
    await new Promise(r => setTimeout(r, 3000));
    setIsGenerating(false);
    setGenerated(true);
    setSelectedFn(MOCK_FUNCTIONS[0]);
    setViewMode('review');
  }

  function handleApprove(fnId: string) {
    setFunctions(fns => fns.map(f => f.id === fnId ? { ...f, status: 'approved' } : f));
  }

  if (!generated) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="max-w-md text-center space-y-4 p-6">
          <div className="text-4xl">⚙</div>
          <h2 className="text-lg font-semibold text-foreground">Stage 7 — Code Generation</h2>
          <p className="text-sm text-muted-foreground">
            Generate custom server-side logic — edge functions, scheduled jobs, event handlers, and integration adapters.
          </p>
          <div className="text-xs text-muted-foreground bg-muted rounded-lg p-3 text-left space-y-1">
            <p>✓ PRD approved (13 sections)</p>
            <p>✓ Schema approved (8 tables)</p>
            <p>✓ UI Generation complete (12 components)</p>
            <p>⚡ Scanning for custom logic requirements…</p>
          </div>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="px-6 py-2 bg-primary text-primary-foreground text-sm rounded-md disabled:opacity-50"
          >
            {isGenerating ? 'Generating…' : 'Generate Server Code'}
          </button>
          {isGenerating && (
            <p className="text-xs text-muted-foreground">
              Extracting function inventory and generating {totalCount} functions.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border px-6 py-3 flex items-center justify-between bg-background">
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold text-foreground">Stage 7 — Code Generation</span>
          <span className="text-xs text-muted-foreground">{approvedCount}/{totalCount} approved</span>
          <div className="h-1.5 w-24 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary" style={{ width: `${(approvedCount / totalCount) * 100}%` }} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode(viewMode === 'inventory' ? 'review' : 'inventory')}
            className="px-3 py-1.5 text-xs border border-border rounded-md"
          >
            {viewMode === 'inventory' ? 'Code Review' : 'Inventory'}
          </button>
          <button className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md">
            Export
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-64 border-r border-border flex-shrink-0 overflow-auto">
          <InventoryPanel
            functions={functions}
            selectedId={selectedFn?.id}
            onSelect={fn => { setSelectedFn(fn); setViewMode('review'); }}
          />
        </div>

        <div className="flex-1 overflow-auto">
          {selectedFn ? (
            <FunctionViewPanel
              fn={selectedFn}
              onApprove={() => handleApprove(selectedFn.id)}
              onRegenerate={() => setShowRegenerate(true)}
              onRollback={() => setShowRollback(true)}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              Select a function to review
            </div>
          )}
        </div>
      </div>

      {showRegenerate && selectedFn && (
        <RegenerateFunctionDialog
          functionName={selectedFn.name}
          onClose={() => setShowRegenerate(false)}
          onRegenerate={() => setShowRegenerate(false)}
        />
      )}
      {showRollback && selectedFn && (
        <RollbackFunctionDialog
          functionName={selectedFn.name}
          onClose={() => setShowRollback(false)}
          onRollback={() => setShowRollback(false)}
        />
      )}
    </div>
  );
}
