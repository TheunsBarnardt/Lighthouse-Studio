import { z } from 'zod';
import { definePrompt } from '../../define-prompt.js';

export const outcomeAssessmentPrompt = definePrompt({
  id: 'maintenance/outcome-assessment',
  version: '1.0.0',
  description: 'Assess whether a deployed change actually resolved the signals that triggered it',
  inputs: z.object({
    changeRequest: z.record(z.unknown()),
    preDeployMetrics: z.record(z.number()),
    postDeployMetrics: z.record(z.number()),
    workspaceId: z.string(),
  }),
  outputs: z.object({
    resolved: z.boolean(),
    confidence: z.number().min(0).max(1),
    assessment: z.string(),
    regressionDetected: z.boolean(),
    regressionDescription: z.string().optional(),
    recommendedAction: z.string().optional(),
  }),
  modelConfig: { model: 'claude-haiku-4-5', maxTokens: 800, temperature: 0.2 },
  systemPrompt: `Assess whether a deployed change resolved the signals that triggered it.
Compare pre/post deployment metrics. A fix is resolved if the signal-driving metric improved significantly.
Flag any regressions (new metrics that got worse after the change).
Be conservative: if metrics are ambiguous, mark as unresolved with a note.
Output ONLY valid JSON.`,
  userPromptTemplate: `Change request:
{{changeRequest}}

Pre-deploy metrics: {{preDeployMetrics}}
Post-deploy metrics: {{postDeployMetrics}}

Was the change request resolved by this deployment? Did any regressions appear?`,
  tests: [],
});
