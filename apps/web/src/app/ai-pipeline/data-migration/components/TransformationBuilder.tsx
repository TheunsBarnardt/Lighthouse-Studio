'use client';

import { useState } from 'react';
import type { ColumnMapping, TransformationStep } from '../types.js';

interface TransformationBuilderProps {
  mapping: ColumnMapping;
  onClose: () => void;
  onChange: (updated: ColumnMapping) => void;
}

const TRANSFORMATION_TYPES = [
  'trim', 'lowercase', 'uppercase', 'parse_date', 'parse_bool',
  'parse_int', 'parse_float', 'split', 'regex_replace', 'if_null',
  'mask', 'resolve_by_natural_key', 'js_expression',
];

export function TransformationBuilder({ mapping, onClose, onChange }: TransformationBuilderProps) {
  const [steps, setSteps] = useState<TransformationStep[]>(mapping.transformations);
  const [newType, setNewType] = useState('trim');
  const [showJsEditor, setShowJsEditor] = useState(false);
  const [jsExpression, setJsExpression] = useState('');

  function addStep() {
    const step: TransformationStep = { type: newType, parameters: {} };
    if (newType === 'js_expression') {
      step.customExpression = jsExpression;
    }
    const updated = [...steps, step];
    setSteps(updated);
    onChange({ ...mapping, transformations: updated });
  }

  function removeStep(index: number) {
    const updated = steps.filter((_, i) => i !== index);
    setSteps(updated);
    onChange({ ...mapping, transformations: updated });
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Transformation Pipeline</p>
          <p className="text-xs text-muted-foreground">{mapping.sourceColumn} → {mapping.targetColumn}</p>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg">×</button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        <div className="space-y-2">
          {steps.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No transformations — direct copy</p>
          ) : (
            steps.map((step, i) => (
              <div key={i} className="flex items-center gap-2 p-2 border border-border rounded-md bg-card">
                <div className="flex-1">
                  <span className="text-xs font-mono font-medium text-foreground">{step.type}</span>
                  {step.customExpression && (
                    <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">{step.customExpression}</p>
                  )}
                </div>
                <button
                  onClick={() => removeStep(i)}
                  className="text-muted-foreground hover:text-destructive text-xs"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Add transformation</p>
          <select
            className="w-full text-xs border border-border rounded px-2 py-1.5 bg-background"
            value={newType}
            onChange={e => { setNewType(e.target.value); setShowJsEditor(e.target.value === 'js_expression'); }}
          >
            {TRANSFORMATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          {showJsEditor && (
            <textarea
              className="w-full text-xs border border-border rounded px-2 py-1.5 bg-background font-mono resize-none"
              rows={4}
              placeholder="// value = current column value&#10;// row = full source row&#10;return value.trim().toLowerCase();"
              value={jsExpression}
              onChange={e => setJsExpression(e.target.value)}
            />
          )}
          <button
            onClick={addStep}
            className="w-full px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md"
          >
            + Add Step
          </button>
        </div>

        {steps.length > 0 && (
          <div className="border border-border rounded-md p-3 bg-muted/50">
            <p className="text-xs font-medium text-foreground mb-1">Preview</p>
            <div className="text-xs font-mono text-muted-foreground">
              <span>in: </span><span className="text-foreground">"  Alice Smith  "</span>
              <br />
              {steps.map((s, i) => (
                <span key={i}>→ {s.type}: </span>
              ))}
              <span className="text-green-500">"alice smith"</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
