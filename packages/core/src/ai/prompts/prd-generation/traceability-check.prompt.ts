import { z } from 'zod';
import { definePrompt, registerPrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  intentBriefJson: z.string(),
  prdSectionsJson: z.string(),
});

const OutputSchema = z.object({
  coveredGoals: z.number(),
  totalGoals: z.number(),
  gaps: z.array(z.object({
    intentField: z.string(),
    intentItemId: z.string(),
    description: z.string(),
  })),
  reasoning: z.string(),
});

export const traceabilityCheckPrompt = definePrompt({
  id: 'prd-generation/traceability-check',
  version: '1.0.0',
  description: 'Verify that every intent brief goal has at least one supporting PRD element',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: {
    provider: 'anthropic',
    model: 'claude-opus-4-7',
    temperature: 0.1,
    maxTokens: 2000,
  },
  systemPrompt: `You are a requirements analyst. You check that every goal in the intent brief is addressed somewhere in the PRD.

A goal is "covered" if:
- It appears explicitly in the Purpose section, OR
- It is addressed by at least one item in the Component Specifications, OR
- It drives at least one Verification Step, OR
- It is referenced by the Implementation Order

Rules:
- Check all intent goals, target user needs, and success criteria
- A gap is a goal/need with no corresponding PRD element
- Report coveredGoals / totalGoals ratio
- gaps list each unaddressed intent item with which field and id it came from`,
  userPromptTemplate: ({ intentBriefJson, prdSectionsJson }) => `
Check traceability from the intent brief to the PRD.

Intent Brief:
${intentBriefJson}

PRD Sections:
${prdSectionsJson}

Return JSON with:
- coveredGoals: number of intent goals addressed in the PRD
- totalGoals: total number of intent goals
- gaps: array of { intentField, intentItemId, description } for uncovered goals
- reasoning: your analysis
`.trim(),
  tests: [
    {
      description: 'Counts goals and identifies gaps',
      input: {
        intentBriefJson: JSON.stringify({ goals: [{ id: 'g1', description: 'User login' }], targetUsers: [] }),
        prdSectionsJson: JSON.stringify({ purpose: { narrative: 'Users can log in.' } }),
      },
      assertions: [
        (output: z.infer<typeof OutputSchema>) => typeof output.coveredGoals === 'number',
        (output: z.infer<typeof OutputSchema>) => typeof output.totalGoals === 'number',
        (output: z.infer<typeof OutputSchema>) => Array.isArray(output.gaps),
      ],
    },
  ],
});

registerPrompt(traceabilityCheckPrompt);
