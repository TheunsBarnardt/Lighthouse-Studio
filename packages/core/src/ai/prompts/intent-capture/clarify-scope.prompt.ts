import { z } from 'zod';

import { definePrompt, registerPrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  conversationHistory: z.string(),
});

const OutputSchema = z.object({
  inScope: z.array(z.string()),
  outOfScope: z.array(z.string()),
  estimatedScope: z.enum(['small', 'medium', 'large', 'xl']).nullable(),
  reasoning: z.string(),
});

export const clarifyScopePrompt = definePrompt({
  id: 'intent-capture/clarify-scope',
  version: '1.0.0',
  description: 'Clarifies project scope boundaries from the conversation',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: {
    provider: 'anthropic',
    model: 'claude-opus-4-7',
    temperature: 0.2,
    maxTokens: 1536,
  },
  systemPrompt: `You are a software architect helping define project scope. Extract explicit and implied scope boundaries.

inScope: features/capabilities explicitly included
outOfScope: features explicitly excluded, or obvious omissions the user clarified
estimatedScope: rough size estimate:
  - small: 1-2 tables, basic CRUD, 1 user type, weeks
  - medium: 3-8 tables, multiple views, 2-3 user types, 1-3 months
  - large: 8+ tables, complex workflows, multiple integrations, 3-6 months
  - xl: platform-level, many integrations, 6+ months

Only set estimatedScope if you have enough information to estimate.`,
  userPromptTemplate: ({ conversationHistory }) => `Analyze this conversation and define the scope:

CONVERSATION:
${conversationHistory}

Return a JSON object with:
- inScope: array of in-scope items (plain strings)
- outOfScope: array of out-of-scope items
- estimatedScope: "small", "medium", "large", "xl", or null
- reasoning: explanation of scope decisions`,
  tests: [
    {
      description: 'extracts explicit exclusions',
      input: {
        conversationHistory:
          'User: We need contact management, deal pipeline, and email logging. No payment processing, no marketing automation — those are out of scope.',
      },
      assertions: [
        { type: 'output_matches_schema' },
        {
          type: 'custom',
          message: 'should have out-of-scope items',
          check: (out: unknown) => (out as { outOfScope: string[] }).outOfScope.length >= 2,
        },
      ],
    },
    {
      description: 'estimates scope for simple project',
      input: {
        conversationHistory:
          'User: Just a simple todo list app with tasks and due dates. One user, no team features.',
      },
      assertions: [
        { type: 'output_matches_schema' },
        {
          type: 'custom',
          message: 'should estimate small scope',
          check: (out: unknown) => (out as { estimatedScope: string }).estimatedScope === 'small',
        },
      ],
    },
    {
      description: 'handles no explicit exclusions',
      input: {
        conversationHistory: 'User: I want to build a platform for managing employee schedules.',
      },
      assertions: [
        { type: 'output_matches_schema' },
        { type: 'field_not_empty', field: 'inScope' },
      ],
    },
  ],
});

registerPrompt(clarifyScopePrompt);
