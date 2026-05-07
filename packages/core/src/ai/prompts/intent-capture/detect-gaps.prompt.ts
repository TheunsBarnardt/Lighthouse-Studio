import { z } from 'zod';

import { definePrompt, registerPrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  conversationHistory: z.string(),
  briefDraftJson: z.string(),
});

const OutputSchema = z.object({
  gaps: z.array(z.string()),
  readyToGenerate: z.boolean(),
  missingFields: z.array(z.string()),
  reasoning: z.string(),
});

export const detectGapsPrompt = definePrompt({
  id: 'intent-capture/detect-gaps',
  version: '1.0.0',
  description:
    'Detects missing information in the brief draft and determines readiness to generate',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: {
    provider: 'anthropic',
    model: 'claude-opus-4-7',
    temperature: 0.2,
    maxTokens: 1024,
  },
  systemPrompt: `You are a requirements reviewer checking whether a project brief has enough information.

A brief is ready to generate when it has:
1. At least 1 clear goal with priority
2. At least 1 identified target user
3. A meaningful summary (not just a restatement of the title)
4. Some clarity on scope (what's included)

gaps: specific questions that need answering (e.g., "How many concurrent users are expected?")
missingFields: field names that are empty or insufficient (e.g., "goals", "targetUsers")
readyToGenerate: true if minimum requirements met

Be pragmatic — a brief doesn't need to be perfect to generate.`,
  userPromptTemplate: ({
    conversationHistory,
    briefDraftJson,
  }) => `Evaluate this brief draft for completeness:

CONVERSATION:
${conversationHistory}

CURRENT BRIEF DRAFT:
${briefDraftJson}

Return a JSON object with:
- gaps: array of specific unanswered questions
- readyToGenerate: boolean
- missingFields: array of field names that are incomplete
- reasoning: explanation of readiness assessment`,
  tests: [
    {
      description: 'detects missing target users',
      input: {
        conversationHistory: 'User: I want to build a project management tool.',
        briefDraftJson: JSON.stringify({
          title: 'Project Manager',
          summary: 'A project management tool',
          goals: [
            {
              id: '1',
              description: 'Track projects',
              priority: 'must_have',
              acceptanceCriteria: [],
            },
          ],
          targetUsers: [],
        }),
      },
      assertions: [
        { type: 'output_matches_schema' },
        {
          type: 'custom',
          message: 'should not be ready without users',
          check: (out: unknown) => !(out as { readyToGenerate: boolean }).readyToGenerate,
        },
        {
          type: 'custom',
          message: 'should flag targetUsers as missing',
          check: (out: unknown) =>
            (out as { missingFields: string[] }).missingFields.includes('targetUsers'),
        },
      ],
    },
    {
      description: 'marks ready when sufficient info present',
      input: {
        conversationHistory: 'User: I need a CRM for our 5-person sales team to track leads.',
        briefDraftJson: JSON.stringify({
          title: 'Sales CRM',
          summary: 'A CRM for a small sales team to track leads and deals.',
          goals: [
            { id: '1', description: 'Track leads', priority: 'must_have', acceptanceCriteria: [] },
          ],
          targetUsers: [
            {
              id: '1',
              persona: 'Sales Rep',
              description: 'Sales representative',
              needs: ['track leads'],
              painPoints: [],
            },
          ],
          inScope: ['lead tracking', 'deal pipeline'],
        }),
      },
      assertions: [
        { type: 'output_matches_schema' },
        {
          type: 'custom',
          message: 'should be ready',
          check: (out: unknown) => (out as { readyToGenerate: boolean }).readyToGenerate,
        },
      ],
    },
    {
      description: 'identifies vague summary as gap',
      input: {
        conversationHistory: 'User: A thing.',
        briefDraftJson: JSON.stringify({
          title: 'A thing',
          summary: 'A thing',
          goals: [],
          targetUsers: [],
        }),
      },
      assertions: [
        { type: 'output_matches_schema' },
        {
          type: 'custom',
          message: 'should list gaps',
          check: (out: unknown) => (out as { gaps: string[] }).gaps.length > 0,
        },
      ],
    },
  ],
});

registerPrompt(detectGapsPrompt);
