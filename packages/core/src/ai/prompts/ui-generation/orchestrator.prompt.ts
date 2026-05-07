import { z } from 'zod';
import { definePrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  prdSummary: z.string(),
  entityCount: z.number(),
  pageCount: z.number(),
  hasWorkflows: z.boolean(),
  hasDashboard: z.boolean(),
});

const OutputSchema = z.object({
  generationStrategy: z.string(),
  parallelGroups: z.array(z.array(z.string())),
  specialConsiderations: z.array(z.string()),
  estimatedCostUsd: z.object({ min: z.number(), max: z.number() }),
  estimatedMinutes: z.number(),
  reasoning: z.string(),
});

export const orchestratorPrompt = definePrompt({
  id: 'ui-generation.orchestrator',
  version: '1.0.0',
  description: 'Plan the UI generation strategy: component ordering, parallelism, cost estimate',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: { provider: 'anthropic',
 model: 'claude-haiku-4-5-20251001', maxTokens: 1500, temperature: 0.2 },
  systemPrompt: `You plan the UI generation strategy for a project.

Determine:
- Generation strategy (description)
- Parallel generation groups (components that can be generated simultaneously)
- Special considerations (complex workflows, many entities, real-time requirements)
- Cost estimate ($5-$30 typical)
- Time estimate in minutes

App shell and auth pages generate first (dependencies). CRUD components for each entity generate after.
Workflow and dashboard pages generate last (depend on CRUD components).`,
  userPromptTemplate: `PRD: {{prdSummary}}
Entities: {{entityCount}}
Pages: {{pageCount}}
Has workflows: {{hasWorkflows}}
Has dashboard: {{hasDashboard}}

Plan the generation.`,
  tests: [
    {
      description: 'Plans simple app generation',
      input: { prdSummary: 'CRM app', entityCount: 3, pageCount: 12, hasWorkflows: false, hasDashboard: true },
      assertions: [
        { path: 'parallelGroups.length', gte: 1 },
      ],
    },
  ],
});
