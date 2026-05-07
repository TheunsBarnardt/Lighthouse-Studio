import { z } from 'zod';
import { definePrompt, registerPrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  spec: z.record(z.unknown()),
  existingSource: z.string(),
  feedback: z.string().optional(),
});

const OutputSchema = z.object({
  source: z.string(),
  manifestEntry: z.record(z.unknown()),
  reasoning: z.object({
    whyThisFunctionExists: z.string(),
    whyThisImplementation: z.string(),
    designDecisions: z.array(z.string()),
  }),
  changedSections: z.array(z.string()),
});

const prompt = definePrompt({
  id: 'code-generation/regeneration',
  version: '1.0.0',
  description: 'Regenerate a server function with optional user feedback.',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: { provider: 'anthropic',
 model: 'claude-opus-4-7',
    maxTokens: 3000,
    temperature: 0.1,
  },
  systemPrompt: `You regenerate TypeScript server functions incorporating user feedback.

Rules:
- Preserve the function's exported name and signature if unchanged by the feedback
- Preserve the manifest export structure
- Apply feedback changes minimally — only change what is needed
- List changed sections in changedSections
- Apply all sandbox rules from the original generation

Return JSON with: source, manifestEntry, reasoning, changedSections.`,
  userPromptTemplate: `Spec: {{spec | json}}

Existing source:
\`\`\`typescript
{{existingSource}}
\`\`\`

{{#if feedback}}
Feedback from reviewer:
{{feedback}}
{{/if}}

Regenerate the function with these changes. Return JSON only.`,
  tests: [],
});

registerPrompt(prompt);
export default prompt;
