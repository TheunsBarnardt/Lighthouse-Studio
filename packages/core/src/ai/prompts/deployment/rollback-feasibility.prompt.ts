import { z } from 'zod';
import { definePrompt } from '../../define-prompt.js';

export const rollbackFeasibilityPrompt = definePrompt({
  id: 'deployment/rollback-feasibility',
  version: '1.0.0',
  description: 'Assess whether a deployment can be fully rolled back given its schema migrations',
  inputs: z.object({
    schemaMigrations: z.array(z.object({
      sequence: z.number(),
      description: z.string(),
      reversible: z.boolean(),
    })),
    deployMode: z.enum(['rolling', 'blue_green']),
  }),
  outputs: z.object({
    fullyReversible: z.boolean(),
    partiallyReversible: z.boolean(),
    irreversibleItems: z.array(z.object({
      migrationSequence: z.number(),
      description: z.string(),
      riskIfRolledBack: z.string(),
    })),
    recommendedAction: z.string(),
    warning: z.string().optional(),
  }),
  modelConfig: { model: 'claude-haiku-4-5', maxTokens: 1000, temperature: 0.1 },
  systemPrompt: `Assess rollback feasibility for a deployment.
If all migrations are reversible: fullyReversible = true.
If any migration is irreversible: partiallyReversible = true; describe what happens if code is rolled back but schema cannot be.
Provide a clear recommendation for the operator.
Output ONLY valid JSON.`,
  userPromptTemplate: `Schema migrations:
{{schemaMigrations}}

Deploy mode: {{deployMode}}

Assess rollback feasibility. Identify any irreversible items and their risk.`,
  tests: [],
});
