import { z } from 'zod';
import { definePrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  currentCode: z.string(),
  componentSpec: z.any(),
  feedback: z.string(),
  otherComponentNames: z.array(z.string()),
});

const OutputSchema = z.object({
  updatedCode: z.string(),
  changes: z.array(z.string()),
  reasoning: z.string(),
});

export const regenerationPrompt = definePrompt({
  id: 'ui-generation.regeneration',
  version: '1.0.0',
  description: 'Regenerate a UI component with user feedback, preserving consistency with the project',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: { provider: 'anthropic',
 model: 'claude-opus-4-7', maxTokens: 5000, temperature: 0.2 },
  systemPrompt: `You regenerate a React component based on user feedback.

Apply the feedback precisely. Preserve everything not mentioned.
Maintain consistency with the project (import patterns, naming, prop styles).
List all changes made.`,
  userPromptTemplate: `Feedback: {{feedback}}

Other components in project: {{otherComponentNames.join ", "}}

Current component code:
{{currentCode}}

Apply the feedback.`,
  tests: [
    {
      description: 'Applies layout feedback to component',
      input: {
        currentCode: `export function List() { return <div>...</div>; }`,
        componentSpec: {},
        feedback: 'Use more compact rows',
        otherComponentNames: ['ContactDetail', 'ContactForm'],
      },
      assertions: [
        { path: 'changes.length', gte: 1 },
      ],
    },
  ],
});
