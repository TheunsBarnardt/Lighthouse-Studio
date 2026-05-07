import { z } from 'zod';
import { definePrompt, registerPrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  componentSpecsSectionJson: z.string(),
  verificationStepsSectionJson: z.string(),
});

const OutputSchema = z.object({
  items: z.array(z.object({
    id: z.string(),
    category: z.string(),
    description: z.string(),
    stage: z.enum(['4', '5', '6', '7', '8', '9', 'any']).optional(),
  })).min(1),
  reasoning: z.string(),
});

export const definitionOfDonePrompt = definePrompt({
  id: 'prd-generation/definition-of-done',
  version: '1.0.0',
  description: 'Generate the Definition of Done section — categorized checkboxes consumed by downstream stages',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: {
    provider: 'anthropic',
    model: 'claude-opus-4-7',
    temperature: 0.2,
    maxTokens: 2048,
  },
  systemPrompt: `You are a delivery lead. You write Definition of Done checklists that are:
- Categorized by concern (Schema, Service Layer, UI, Permissions, Testing, Observability, Docs)
- Specific enough to be verifiable
- Assigned to the stage that will deliver them

Rules:
- stage field maps to AI pipeline stages: '4'=Schema, '5'=Migration, '6'=UI, '7'=Code, '8'=Testing, '9'=Deployment
- Use 'any' for non-stage-specific items (e.g., "code reviewed by a human")
- Each item is a complete, testable statement
- Typical list is 20-40 items across all categories`,
  userPromptTemplate: ({ componentSpecsSectionJson, verificationStepsSectionJson }) => `
Write the Definition of Done section (Section 10 of 13) of the PRD.

Component Specifications:
${componentSpecsSectionJson}

Verification Steps (already defined; DoD references but does not repeat them):
${verificationStepsSectionJson}

Return JSON with:
- items: array of { id, category, description, stage? }
- reasoning: your approach to coverage
`.trim(),
  tests: [
    {
      description: 'Covers multiple categories',
      input: {
        componentSpecsSectionJson: JSON.stringify({ components: [{ name: 'UserModel', type: 'model' }, { name: 'AuthService', type: 'service' }] }),
        verificationStepsSectionJson: JSON.stringify({ steps: [{ step: 1, description: 'User logs in', expectedOutcome: 'JWT returned', category: 'functional' }] }),
      },
      assertions: [
        (output: z.infer<typeof OutputSchema>) => output.items.length >= 5,
        (output: z.infer<typeof OutputSchema>) => new Set(output.items.map((i) => i.category)).size >= 3,
      ],
    },
  ],
});

registerPrompt(definitionOfDonePrompt);
