'use client';

import { useState } from 'react';
import { MappingCanvas } from '../components/MappingCanvas.js';
import { TransformationBuilder } from '../components/TransformationBuilder.js';
import type { ColumnMapping } from '../types.js';

interface MappingStepProps {
  sourceConnectionId: string;
  onPlanCreated: (planId: string) => void;
  onBack: () => void;
}

export function MappingStep({ sourceConnectionId, onPlanCreated, onBack }: MappingStepProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);
  const [selectedMapping, setSelectedMapping] = useState<ColumnMapping | null>(null);
  const [userNotes, setUserNotes] = useState('');

  async function generate() {
    setIsGenerating(true);
    await new Promise(r => setTimeout(r, 2500));
    setIsGenerating(false);
    setIsGenerated(true);
  }

  function handleSave() {
    onPlanCreated(crypto.randomUUID());
  }

  return (
    <div className="flex flex-col h-full">
      {!isGenerated ? (
        <div className="p-6 max-w-2xl mx-auto space-y-5">
          <div>
            <h2 className="text-base font-semibold text-foreground mb-1">Generate Mapping</h2>
            <p className="text-sm text-muted-foreground">
              The AI will analyze your source and target schemas to propose a column-level mapping.
            </p>
          </div>
          <label className="block">
            <span className="text-sm font-medium text-foreground">Notes for the AI (optional)</span>
            <textarea
              className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-md bg-background resize-none"
              rows={3}
              placeholder="e.g. The cust_id field in source becomes customer_id in target. Email column is the natural key for customer lookup."
              value={userNotes}
              onChange={e => setUserNotes(e.target.value)}
            />
          </label>
          <div className="flex gap-3">
            <button onClick={onBack} className="px-4 py-2 text-sm border border-border rounded-md">Back</button>
            <button
              onClick={generate}
              disabled={isGenerating}
              className="px-4 py-2 bg-primary text-primary-foreground text-sm rounded-md disabled:opacity-50"
            >
              {isGenerating ? 'Generating…' : 'Generate Mapping'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-auto">
            <MappingCanvas
              onMappingSelected={setSelectedMapping}
            />
          </div>
          {selectedMapping && (
            <div className="w-72 border-l border-border overflow-auto flex-shrink-0">
              <TransformationBuilder
                mapping={selectedMapping}
                onClose={() => setSelectedMapping(null)}
                onChange={() => {}}
              />
            </div>
          )}
        </div>
      )}

      {isGenerated && (
        <div className="border-t border-border px-6 py-3 flex items-center gap-3 bg-background">
          <div className="flex-1">
            <span className="text-xs text-muted-foreground">2 tables mapped · 8 columns · 0 warnings</span>
          </div>
          <button onClick={onBack} className="px-3 py-1.5 text-sm border border-border rounded-md">Back</button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 bg-primary text-primary-foreground text-sm rounded-md"
          >
            Continue to Preview →
          </button>
        </div>
      )}
    </div>
  );
}
