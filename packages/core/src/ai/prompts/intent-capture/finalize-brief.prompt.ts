import { z } from 'zod';

import { IntentBriefSchema } from '../../../services/ai/intent-capture/types.js';
import { definePrompt, registerPrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  conversationHistory: z.string(),
  briefDraftJson: z.string(),
});

const OutputSchema = z.object({
  brief: IntentBriefSchema,
  reasoning: z.string(),
  confidenceScore: z.number().min(0).max(1),
});

export const finalizeBriefPrompt = definePrompt({
  id: 'intent-capture/finalize-brief',
  version: '1.0.0',
  description: 'Generates the final structured IntentBrief from conversation history and draft',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: {
    provider: 'anthropic',
    model: 'claude-opus-4-7',
    temperature: 0.2,
    maxTokens: 4096,
  },
  systemPrompt: `You are a software requirements engineer finalizing a project brief. Synthesize the complete conversation into a polished, structured IntentBrief.

Rules:
- Preserve all explicitly stated requirements
- Use clear, professional language
- Every goal must have at least 1 acceptance criterion
- Every target user must have needs and pain points
- Include risks for any technical complexity, integration requirements, or scale concerns
- The summary should be 2-4 sentences: what the system does, who it's for, and the core value

confidenceScore: your confidence in the completeness of this brief (0.0-1.0).`,
  userPromptTemplate: ({
    conversationHistory,
    briefDraftJson,
  }) => `Generate the final IntentBrief from this conversation and draft:

CONVERSATION:
${conversationHistory}

CURRENT DRAFT:
${briefDraftJson}

Return a JSON object with:
- brief: complete IntentBrief object
- reasoning: explanation of key synthesis decisions
- confidenceScore: number between 0 and 1`,
  tests: [
    {
      description: 'generates complete brief from full conversation',
      input: {
        conversationHistory: `User: I want to build a CRM for our sales team.
Assistant: What features are most important?
User: Contact management, deal pipeline with stages, and email logging. We have 5 sales reps and 1 manager.`,
        briefDraftJson: JSON.stringify({
          title: 'Sales CRM',
          goals: [
            {
              id: '1',
              description: 'Contact management',
              priority: 'must_have',
              acceptanceCriteria: [],
            },
          ],
          targetUsers: [
            { id: '1', persona: 'Sales Rep', description: 'Sales rep', needs: [], painPoints: [] },
          ],
        }),
      },
      assertions: [
        { type: 'output_matches_schema' },
        {
          type: 'custom',
          message: 'brief should have title',
          check: (out: unknown) => !!(out as { brief: { title: string } }).brief.title,
        },
        {
          type: 'custom',
          message: 'brief should have goals',
          check: (out: unknown) => (out as { brief: { goals: unknown[] } }).brief.goals.length > 0,
        },
        {
          type: 'custom',
          message: 'brief should have users',
          check: (out: unknown) =>
            (out as { brief: { targetUsers: unknown[] } }).brief.targetUsers.length > 0,
        },
      ],
    },
    {
      description: 'includes risks for complex integrations',
      input: {
        conversationHistory:
          'User: We need to integrate with Salesforce, Stripe, and our legacy ERP that runs on Windows 2008.',
        briefDraftJson: '{}',
      },
      assertions: [
        { type: 'output_matches_schema' },
        {
          type: 'custom',
          message: 'should identify risks',
          check: (out: unknown) => (out as { brief: { risks: unknown[] } }).brief.risks.length > 0,
        },
      ],
    },
    {
      description: 'returns confidence score between 0 and 1',
      input: {
        conversationHistory: 'User: Something with data.',
        briefDraftJson: '{}',
      },
      assertions: [
        { type: 'output_matches_schema' },
        {
          type: 'custom',
          message: 'confidence should be in range',
          check: (out: unknown) => {
            const score = (out as { confidenceScore: number }).confidenceScore;
            return score >= 0 && score <= 1;
          },
        },
      ],
    },
  ],
});

registerPrompt(finalizeBriefPrompt);
