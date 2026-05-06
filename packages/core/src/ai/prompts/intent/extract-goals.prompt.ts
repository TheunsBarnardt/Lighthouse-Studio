import { z } from 'zod';

import { ReasoningSchema, definePrompt } from '../../define-prompt.js';

export const extractGoals = definePrompt({
  id: 'intent_capture.extract_goals',
  version: '1.0.0',
  stage: 'intent',
  description: 'Extracts user goals from a freeform conversation into a structured intent brief',

  inputs: z.object({
    conversation: z
      .array(
        z.object({
          role: z.enum(['user', 'assistant']),
          content: z.string().max(10000),
        }),
      )
      .min(1)
      .max(50),
    domainContext: z.string().max(2000).optional(),
  }),

  outputs: z.object({
    goals: z
      .array(
        z.object({
          goal: z.string().min(1),
          priority: z.enum(['must', 'should', 'could']),
          rationale: z.string(),
        }),
      )
      .min(1),
    constraints: z.array(z.string()),
    successCriteria: z.array(z.string()),
    targetPersonas: z.array(z.string()),
    reasoning: ReasoningSchema,
  }),

  modelConfig: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    temperature: 0.2,
    maxTokens: 4000,
  },

  tokenBudget: {
    inputTokens: 2000,
    outputTokens: 1500,
  },

  cacheable: false, // conversations vary; caching rarely useful here

  systemPrompt: `You are a senior business analyst helping extract structured goals from a product conversation.

Your output must be valid JSON matching the output schema. Every field is required.
The reasoning field is mandatory and must explain WHY you interpreted the conversation the way you did.

Rules:
- Extract only what is explicitly stated or strongly implied — do not invent goals
- Mark goals as "must" only when the user expressed clear necessity
- Constraints are hard limits the solution must not violate
- Success criteria are measurable outcomes that indicate the project succeeded
- Target personas describe the end users, not the development team`,

  userPromptTemplate: ({ conversation, domainContext }) => `
Analyze the following product conversation and extract structured goals.

${domainContext ? `Domain context: ${domainContext}\n` : ''}

Conversation:
${conversation.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n')}

Return a JSON object with the following structure:
{
  "goals": [{ "goal": "string", "priority": "must|should|could", "rationale": "string" }],
  "constraints": ["string"],
  "successCriteria": ["string"],
  "targetPersonas": ["string"],
  "reasoning": {
    "rationale": "string",
    "alternatives_considered": ["string"],
    "assumptions": ["string"],
    "uncertainties": ["string"],
    "source_artifacts": []
  }
}
`,

  examples: [
    {
      description: 'Simple e-commerce conversation',
      input: {
        conversation: [
          { role: 'user', content: 'I want to build an online store for handmade jewelry' },
          { role: 'assistant', content: 'Who are your customers?' },
          { role: 'user', content: 'Mostly women aged 25-45 who appreciate artisan work' },
        ],
      },
    },
  ],

  tests: [
    {
      name: 'extracts at least one must goal',
      input: {
        conversation: [
          {
            role: 'user',
            content: "I need a way to manage my team's tasks. It must support deadlines.",
          },
        ],
      },
      assertions: [{ type: 'output_matches_schema' }, { type: 'array_not_empty', field: 'goals' }],
    },
  ],
});
