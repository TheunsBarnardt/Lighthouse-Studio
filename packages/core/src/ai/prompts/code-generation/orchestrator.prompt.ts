import { z } from 'zod';
import { definePrompt, registerPrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  prdContent: z.string(),
  schemaContent: z.string(),
  uiProjectSummary: z.string().optional(),
  availableIntegrations: z.array(z.string()),
});

const OutputSchema = z.object({
  plan: z.object({
    phases: z.array(z.object({
      phase: z.number(),
      description: z.string(),
      functionNames: z.array(z.string()),
      canParallelize: z.boolean(),
    })),
    estimatedDurationMinutes: z.number(),
    estimatedCostUsd: z.number(),
    totalFunctions: z.number(),
  }),
  reasoning: z.string(),
});

const prompt = definePrompt({
  id: 'code-generation/orchestrator',
  version: '1.0.0',
  description: 'Plan the server code generation sequence (phases, parallelism, cost estimate).',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: {
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 1500,
    temperature: 0.1,
  },
  systemPrompt: `You plan the generation sequence for a server code project.

Group functions into phases based on dependencies. Functions with no dependencies can be generated in parallel.
Estimate: 45 seconds per function for generation + validation. Cost: ~$0.50 per function (opus).
Return JSON only.`,
  userPromptTemplate: `PRD: {{prdContent}}
Schema: {{schemaContent}}
UI summary: {{uiProjectSummary}}
Integrations: {{availableIntegrations | json}}
Plan the generation. Return JSON only.`,
  tests: [],
});

registerPrompt(prompt);
export default prompt;
