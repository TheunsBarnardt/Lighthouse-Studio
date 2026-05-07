'use client';

import React, { useState } from 'react';
import { SourceStep } from './steps/SourceStep.js';
import { IntrospectionStep } from './steps/IntrospectionStep.js';
import { MappingStep } from './steps/MappingStep.js';
import { PreviewStep } from './steps/PreviewStep.js';
import { ApprovalStep } from './steps/ApprovalStep.js';
import { ExecutionStep } from './steps/ExecutionStep.js';
import { ValidationStep } from './steps/ValidationStep.js';

type Step = 'source' | 'introspection' | 'mapping' | 'preview' | 'approval' | 'execution' | 'validation';

const STEPS: { id: Step; label: string }[] = [
  { id: 'source', label: 'Source' },
  { id: 'introspection', label: 'Introspection' },
  { id: 'mapping', label: 'Mapping' },
  { id: 'preview', label: 'Preview' },
  { id: 'approval', label: 'Approval' },
  { id: 'execution', label: 'Execution' },
  { id: 'validation', label: 'Validation' },
];

export default function DataMigrationPage() {
  const [currentStep, setCurrentStep] = useState<Step>('source');
  const [sourceConnectionId, setSourceConnectionId] = useState<string | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [executionId, setExecutionId] = useState<string | null>(null);

  const currentIndex = STEPS.findIndex(s => s.id === currentStep);

  function advance(to: Step) {
    setCurrentStep(to);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border px-6 py-4 bg-background">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold text-foreground">Stage 5 — Data Migration</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Map existing data to your new schema and run a validated migration.
        </p>
      </div>

      {/* Step indicator */}
      <div className="border-b border-border px-6 py-3">
        <ol className="flex items-center gap-1">
          {STEPS.map((step, idx) => {
            const isCurrent = step.id === currentStep;
            const isPast = idx < currentIndex;
            return (
              <React.Fragment key={step.id}>
                <li className="flex items-center gap-1">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium ${
                      isCurrent
                        ? 'bg-primary text-primary-foreground'
                        : isPast
                        ? 'bg-green-500 text-white'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {isPast ? '✓' : idx + 1}
                  </div>
                  <span className={`text-xs ${isCurrent ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                    {step.label}
                  </span>
                </li>
                {idx < STEPS.length - 1 && <div className="w-6 h-px bg-border mx-1" />}
              </React.Fragment>
            );
          })}
        </ol>
      </div>

      <div className="flex-1 overflow-auto">
        {currentStep === 'source' && (
          <SourceStep
            onConnected={(id) => { setSourceConnectionId(id); advance('introspection'); }}
          />
        )}
        {currentStep === 'introspection' && sourceConnectionId && (
          <IntrospectionStep
            sourceConnectionId={sourceConnectionId}
            onContinue={() => advance('mapping')}
            onBack={() => advance('source')}
          />
        )}
        {currentStep === 'mapping' && sourceConnectionId && (
          <MappingStep
            sourceConnectionId={sourceConnectionId}
            onPlanCreated={(id) => { setPlanId(id); advance('preview'); }}
            onBack={() => advance('introspection')}
          />
        )}
        {currentStep === 'preview' && planId && (
          <PreviewStep
            planId={planId}
            onContinue={() => advance('approval')}
            onBack={() => advance('mapping')}
          />
        )}
        {currentStep === 'approval' && planId && (
          <ApprovalStep
            planId={planId}
            onApproved={() => advance('execution')}
            onBack={() => advance('preview')}
          />
        )}
        {currentStep === 'execution' && planId && (
          <ExecutionStep
            planId={planId}
            onStarted={(id) => setExecutionId(id)}
            onCompleted={() => advance('validation')}
            onBack={() => advance('approval')}
          />
        )}
        {currentStep === 'validation' && executionId && (
          <ValidationStep
            executionId={executionId}
            onBack={() => advance('execution')}
          />
        )}
      </div>
    </div>
  );
}
