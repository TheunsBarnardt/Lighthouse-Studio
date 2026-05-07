import { z } from 'zod';
import { definePrompt } from '../../define-prompt.js';

const ReasoningSchema = z.object({
  whyThisTestExists: z.string(),
  whatItVerifies: z.string(),
  designDecisions: z.array(z.string()),
});

export const testRegenerationPrompt = definePrompt({
  id: 'test-generation/regeneration',
  version: '1.0.0',
  description: 'Regenerate a test file incorporating user feedback',
  inputs: z.object({
    existingSource: z.string(),
    feedback: z.string().optional(),
  }),
  outputs: z.object({
    source: z.string(),
    reasoning: ReasoningSchema,
  }),
  modelConfig: { model: 'claude-opus-4-7', maxTokens: 3000, temperature: 0.1 },
  systemPrompt: `You are a senior test engineer regenerating a test file based on feedback.
Rules:
- Preserve the original test intent and Given/When/Then structure
- Apply all feedback precisely
- Do not change the test framework or import style
- Maintain or improve type safety
- Output ONLY valid JSON with 'source' and 'reasoning' fields`,
  userPromptTemplate: `Existing test source:
\`\`\`typescript
{{existingSource}}
\`\`\`

Feedback:
{{feedback}}

Regenerate the test file incorporating the feedback. Explain what changed in the reasoning.`,
  tests: [],
});
