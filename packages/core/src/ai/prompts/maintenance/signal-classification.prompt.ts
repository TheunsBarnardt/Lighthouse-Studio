import { z } from 'zod';
import { definePrompt } from '../../define-prompt.js';

export const signalClassificationPrompt = definePrompt({
  id: 'maintenance/signal-classification',
  version: '1.0.0',
  description: 'Classify a production signal to identify which pipeline stage(s) should re-engage',
  inputs: z.object({
    signal: z.record(z.unknown()),
    workspaceId: z.string(),
  }),
  outputs: z.object({
    suggestedStages: z.array(z.object({
      stageName: z.string(),
      confidence: z.number().min(0).max(1),
      reasoning: z.string(),
    })),
    affectedArtifactIds: z.array(z.string()),
  }),
  modelConfig: { model: 'claude-haiku-4-5', maxTokens: 1500, temperature: 0.2 },
  systemPrompt: `You are a senior engineer classifying production signals to route them to the correct pipeline stage.

Pipeline stages:
- prd (Stage 2): requirement misinterpretation; feature requests changing scope
- schema (Stage 4): missing columns, wrong types, constraint violations
- data_migration (Stage 5): data transformation errors
- ui_generation (Stage 6): UI component errors, rendering failures, accessibility issues
- code_generation (Stage 7): server function errors, API failures, business logic bugs
- test_generation (Stage 8): test infrastructure issues
- deployment (Stage 9): deployment failures, health check issues
- maintenance (Stage 10): dependency advisories, cross-cutting issues

Classify the most likely stage(s) with confidence 0–1. Multiple stages if the signal spans layers.
Output ONLY valid JSON.`,
  userPromptTemplate: `Signal:
{{signal}}

Workspace: {{workspaceId}}

Classify this signal. Which pipeline stage(s) should re-engage? Identify any affected artifact IDs if determinable from the signal.`,
  tests: [],
});
