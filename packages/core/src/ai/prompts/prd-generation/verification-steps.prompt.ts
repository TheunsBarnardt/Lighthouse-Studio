import { z } from 'zod';
import { definePrompt, registerPrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  componentSpecsSectionJson: z.string(),
  intentBriefJson: z.string(),
});

const OutputSchema = z.object({
  steps: z.array(z.object({
    step: z.number(),
    description: z.string(),
    expectedOutcome: z.string(),
    category: z.enum(['functional', 'performance', 'security', 'accessibility', 'cross-browser', 'other']),
  })).min(1),
  reasoning: z.string(),
});

export const verificationStepsPrompt = definePrompt({
  id: 'prd-generation/verification-steps',
  version: '1.0.0',
  description: 'Generate the Verification Steps section of a PRD — end-to-end testable checks consumed by Stage 8',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: {
    provider: 'anthropic',
    model: 'claude-opus-4-7',
    temperature: 0.2,
    maxTokens: 2048,
  },
  systemPrompt: `You are a QA architect. You write end-to-end verification steps that are:
- Numbered
- Stated in active voice ("User creates a task…")
- Testable: clear expected outcome per step
- Categorized so Stage 8 (Test Generation) can target them

Rules:
- Each step tests one meaningful user scenario
- Steps cover happy paths, edge cases, and error cases
- Performance steps have measurable thresholds
- Security steps test authentication, authorization, and input handling
- Aim for 10-20 steps; skip trivial CRUD steps unless they're on a critical path`,
  userPromptTemplate: ({ componentSpecsSectionJson, intentBriefJson }) => `
Write the Verification Steps section (Section 9 of 13) of the PRD.

Intent Brief:
${intentBriefJson}

Component Specifications:
${componentSpecsSectionJson}

Return JSON with:
- steps: array of { step, description, expectedOutcome, category }
- reasoning: your approach to coverage
`.trim(),
  tests: [
    {
      description: 'Produces steps with expected outcomes',
      input: {
        intentBriefJson: JSON.stringify({
          title: 'Task Manager',
          goals: [{ id: 'g1', description: 'Create tasks', priority: 'must_have', acceptanceCriteria: ['Task appears in list'] }],
        }),
        componentSpecsSectionJson: JSON.stringify({ components: [{ name: 'TaskService', type: 'service' }] }),
      },
      assertions: [
        (output: z.infer<typeof OutputSchema>) => output.steps.length >= 3,
        (output: z.infer<typeof OutputSchema>) => output.steps.every((s) => s.expectedOutcome.length > 0),
      ],
    },
  ],
});

registerPrompt(verificationStepsPrompt);
