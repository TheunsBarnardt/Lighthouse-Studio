import { z } from 'zod';
import { definePrompt, registerPrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  componentSpecsSectionJson: z.string(),
  hardPartsSectionJson: z.string(),
});

const OutputSchema = z.object({
  steps: z.array(z.object({
    step: z.number(),
    title: z.string(),
    description: z.string(),
    dependsOnSteps: z.array(z.number()),
    estimatedComplexity: z.enum(['low', 'medium', 'high']).optional(),
  })).min(1),
  reasoning: z.string(),
});

export const implementationOrderPrompt = definePrompt({
  id: 'prd-generation/implementation-order',
  version: '1.0.0',
  description: 'Generate the Implementation Order section of a PRD',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: {
    provider: 'anthropic',
    model: 'claude-opus-4-7',
    temperature: 0.2,
    maxTokens: 2048,
  },
  systemPrompt: `You are an engineering lead. You order implementation steps to minimize risk and dependency conflicts.

Rules:
- Data models and core services come before UI and integration
- Hard parts from Section 5 are flagged with high complexity
- Each step builds on previous steps; dependsOnSteps lists step numbers that must complete first
- Stage 9 (Deployment) reads this order for release sequencing
- Typical sequence: schema → services → API → auth → UI → integrations → observability → testing`,
  userPromptTemplate: ({ componentSpecsSectionJson, hardPartsSectionJson }) => `
Write the Implementation Order section (Section 7 of 13) of the PRD.

Component Specifications:
${componentSpecsSectionJson}

Hard Parts:
${hardPartsSectionJson}

Return JSON with:
- steps: ordered array of { step, title, description, dependsOnSteps, estimatedComplexity }
- reasoning: the sequencing rationale
`.trim(),
  tests: [
    {
      description: 'Produces ordered steps with dependencies',
      input: {
        componentSpecsSectionJson: JSON.stringify({ components: [{ name: 'UserModel', type: 'model' }, { name: 'AuthService', type: 'service' }] }),
        hardPartsSectionJson: JSON.stringify({ items: [] }),
      },
      assertions: [
        (output: z.infer<typeof OutputSchema>) => output.steps.length >= 2,
        (output: z.infer<typeof OutputSchema>) => output.steps[0].step === 1,
      ],
    },
  ],
});

registerPrompt(implementationOrderPrompt);
