import { z } from 'zod';

import { GoalSchema } from '../../../services/ai/intent-capture/types.js';
import { definePrompt, registerPrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  conversationHistory: z.string(),
  partialBrief: z.string().optional(),
});

const OutputSchema = z.object({
  goals: z.array(GoalSchema),
  reasoning: z.string(),
});

export const extractGoalsPrompt = definePrompt({
  id: 'intent-capture/extract-goals',
  version: '1.0.0',
  description: 'Extracts structured goals from conversation history for the intent brief',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: {
    provider: 'anthropic',
    model: 'claude-opus-4-7',
    temperature: 0.2,
    maxTokens: 2048,
  },
  systemPrompt: `You are an expert software requirements analyst. Your job is to extract clearly structured goals from a conversation about a software project.

Each goal must have:
- id: a short slug (e.g., "core-crm", "contact-tracking")
- description: clear, actionable goal statement
- priority: "must_have", "should_have", or "nice_to_have"
- acceptanceCriteria: 1-3 measurable conditions for success

Prioritize clarity over completeness. Only extract goals that are explicitly mentioned or strongly implied. Do not invent goals.`,
  userPromptTemplate: ({
    conversationHistory,
    partialBrief,
  }) => `Analyze this conversation and extract the software project goals.

CONVERSATION:
${conversationHistory}

${partialBrief ? `CURRENT PARTIAL BRIEF:\n${partialBrief}\n` : ''}

Return a JSON object with:
- goals: array of Goal objects
- reasoning: brief explanation of your extraction decisions`,
  tests: [
    {
      description: 'extracts goals from CRM conversation',
      input: {
        conversationHistory:
          'User: I want to build a CRM to track leads and deals. I need to manage contacts, see the pipeline status, and get email notifications when deals move forward.',
      },
      assertions: [
        { type: 'output_matches_schema' },
        { type: 'field_not_empty', field: 'goals' },
        {
          type: 'custom',
          message: 'should extract at least 2 goals',
          check: (out: unknown) =>
            Array.isArray((out as { goals: unknown[] }).goals) &&
            (out as { goals: unknown[] }).goals.length >= 2,
        },
      ],
    },
    {
      description: 'marks essential features as must_have',
      input: {
        conversationHistory:
          'User: The absolute core thing we need is contact management. Pipeline views would be nice but we can add them later.',
      },
      assertions: [
        { type: 'output_matches_schema' },
        {
          type: 'custom',
          message: 'first goal should be must_have',
          check: (out: unknown) =>
            (out as { goals: Array<{ priority: string }> }).goals[0]?.priority === 'must_have',
        },
      ],
    },
    {
      description: 'returns empty goals for vague conversation',
      input: {
        conversationHistory: 'User: I want to build something with technology.',
      },
      assertions: [
        { type: 'output_matches_schema' },
        { type: 'field_not_empty', field: 'reasoning' },
      ],
    },
  ],
});

registerPrompt(extractGoalsPrompt);
