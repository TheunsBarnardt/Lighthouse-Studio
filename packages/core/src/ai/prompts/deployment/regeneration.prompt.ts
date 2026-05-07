import { z } from 'zod';
import { definePrompt } from '../../define-prompt.js';

export const deploymentRegenerationPrompt = definePrompt({
  id: 'deployment/regeneration',
  version: '1.0.0',
  description: 'Regenerate a deployment plan incorporating user feedback',
  inputs: z.object({
    existingPlan: z.record(z.unknown()),
    feedback: z.string(),
  }),
  outputs: z.object({
    environments: z.array(z.any()),
    schemaMigrations: z.array(z.any()),
    irreversibleOperations: z.array(z.any()),
    globalConfig: z.record(z.unknown()),
    reasoning: z.object({
      overallApproach: z.string(),
      environmentProgressionRationale: z.string(),
      schemaStrategyRationale: z.string(),
      riskAssessment: z.string(),
    }),
  }),
  modelConfig: { provider: 'anthropic',
 model: 'claude-haiku-4-5', maxTokens: 3000, temperature: 0.2 },
  systemPrompt: `Regenerate a deployment plan incorporating the user's feedback.
Preserve unchanged sections. Apply feedback precisely.
Output ONLY valid JSON matching the deployment plan schema.`,
  userPromptTemplate: `Existing plan:
{{existingPlan}}

User feedback:
{{feedback}}

Regenerate the plan applying the feedback.`,
  tests: [],
});
