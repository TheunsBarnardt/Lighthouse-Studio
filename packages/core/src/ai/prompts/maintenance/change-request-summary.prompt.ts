import { z } from 'zod';
import { definePrompt } from '../../define-prompt.js';

export const changeRequestSummaryPrompt = definePrompt({
  id: 'maintenance/change-request-summary',
  version: '1.0.0',
  description: 'Summarize multiple signals into a single coherent change request description',
  inputs: z.object({
    signals: z.array(z.record(z.unknown())),
    workspaceId: z.string(),
  }),
  outputs: z.object({
    description: z.string(),
    suggestedTitle: z.string(),
    rootCause: z.string(),
    proposedFix: z.string(),
    affectedAreas: z.array(z.string()),
  }),
  modelConfig: { model: 'claude-haiku-4-5', maxTokens: 1000, temperature: 0.2 },
  systemPrompt: `You are a senior engineer writing a change request from production signals.
The description should be clear, actionable, and include: what's happening, where it's happening, and what the fix likely is.
Keep it concise (3–5 sentences). The root cause should be a hypothesis, not a certainty.
Output ONLY valid JSON.`,
  userPromptTemplate: `Signals ({{signals.length}} total):
{{signals}}

Workspace: {{workspaceId}}

Write a change request description that summarizes these signals into a single actionable request.`,
  tests: [],
});
