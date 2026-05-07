import { z } from 'zod';

import { TargetUserSchema } from '../../../services/ai/intent-capture/types.js';
import { definePrompt, registerPrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  conversationHistory: z.string(),
});

const OutputSchema = z.object({
  targetUsers: z.array(TargetUserSchema),
  reasoning: z.string(),
});

export const identifyUsersPrompt = definePrompt({
  id: 'intent-capture/identify-users',
  version: '1.0.0',
  description: 'Identifies target user personas from the conversation',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: {
    provider: 'anthropic',
    model: 'claude-opus-4-7',
    temperature: 0.2,
    maxTokens: 1536,
  },
  systemPrompt: `You are a UX researcher specializing in user persona development. Extract distinct user personas mentioned in project conversations.

For each persona:
- id: short slug (e.g., "sales-rep", "admin-user")
- persona: role name (e.g., "Sales Representative")
- description: who they are and their context
- needs: what they want to accomplish
- painPoints: current frustrations being solved

Consolidate similar roles. Don't invent personas not mentioned.`,
  userPromptTemplate: ({
    conversationHistory,
  }) => `Identify the target user personas from this conversation:

CONVERSATION:
${conversationHistory}

Return a JSON object with:
- targetUsers: array of TargetUser objects
- reasoning: explanation of persona identification decisions`,
  tests: [
    {
      description: 'identifies multiple user types from CRM discussion',
      input: {
        conversationHistory:
          'User: Sales reps will use it daily to update deals. Managers need to see the overall pipeline. Admins configure the system.',
      },
      assertions: [
        { type: 'output_matches_schema' },
        {
          type: 'custom',
          message: 'should find at least 2 personas',
          check: (out: unknown) => (out as { targetUsers: unknown[] }).targetUsers.length >= 2,
        },
      ],
    },
    {
      description: 'handles single-user system',
      input: {
        conversationHistory: 'User: This is just for me to track my personal projects.',
      },
      assertions: [
        { type: 'output_matches_schema' },
        {
          type: 'custom',
          message: 'should find exactly 1 persona',
          check: (out: unknown) => (out as { targetUsers: unknown[] }).targetUsers.length === 1,
        },
      ],
    },
    {
      description: 'includes needs and pain points',
      input: {
        conversationHistory:
          'User: Marketing team needs to create campaigns but they keep losing track of what has been sent to which customers. They waste time searching through emails.',
      },
      assertions: [
        { type: 'output_matches_schema' },
        {
          type: 'custom',
          message: 'persona should have pain points',
          check: (out: unknown) =>
            ((out as { targetUsers: Array<{ painPoints: string[] }> }).targetUsers[0]?.painPoints
              .length ?? 0) > 0,
        },
      ],
    },
  ],
});

registerPrompt(identifyUsersPrompt);
