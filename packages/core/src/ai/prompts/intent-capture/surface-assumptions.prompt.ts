import { z } from 'zod';

import { AssumptionSchema, RiskSchema } from '../../../services/ai/intent-capture/types.js';
import { definePrompt, registerPrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  conversationHistory: z.string(),
});

const OutputSchema = z.object({
  assumptions: z.array(AssumptionSchema),
  risks: z.array(RiskSchema),
  reasoning: z.string(),
});

export const surfaceAssumptionsPrompt = definePrompt({
  id: 'intent-capture/surface-assumptions',
  version: '1.0.0',
  description: 'Surfaces implicit assumptions and risks from the conversation',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: {
    provider: 'anthropic',
    model: 'claude-opus-4-7',
    temperature: 0.2,
    maxTokens: 2048,
  },
  systemPrompt: `You are a risk analyst reviewing software project plans. Surface hidden assumptions and potential risks.

Assumptions: things taken for granted that, if wrong, would invalidate the plan
- confidence: 0.0–1.0 (how certain is this assumption?)
- impact: high/medium/low (what happens if wrong?)

Risks: potential problems that could derail the project
- likelihood: high/medium/low
- impact: high/medium/low
- mitigationIdea: brief suggestion to reduce the risk

Focus on project-specific risks, not generic ones. Don't list obvious truisms.`,
  userPromptTemplate: ({
    conversationHistory,
  }) => `Analyze this conversation and surface hidden assumptions and risks:

CONVERSATION:
${conversationHistory}

Return a JSON object with:
- assumptions: array of Assumption objects
- risks: array of Risk objects
- reasoning: explanation of what led to these findings`,
  tests: [
    {
      description: 'surfaces technical assumptions',
      input: {
        conversationHistory:
          'User: We want to build a real-time collaboration tool. We have 10,000 active users expected.',
      },
      assertions: [
        { type: 'output_matches_schema' },
        {
          type: 'custom',
          message: 'should surface at least 1 assumption',
          check: (out: unknown) => (out as { assumptions: unknown[] }).assumptions.length >= 1,
        },
      ],
    },
    {
      description: 'identifies integration risks',
      input: {
        conversationHistory:
          'User: We need to integrate with Salesforce and our custom ERP system that nobody has documented.',
      },
      assertions: [
        { type: 'output_matches_schema' },
        {
          type: 'custom',
          message: 'should identify risks',
          check: (out: unknown) => (out as { risks: unknown[] }).risks.length >= 1,
        },
      ],
    },
    {
      description: 'finds scope creep risk in vague projects',
      input: {
        conversationHistory:
          'User: I want a platform that does everything related to HR — leave management, payroll, performance reviews, hiring, and maybe more.',
      },
      assertions: [
        { type: 'output_matches_schema' },
        {
          type: 'custom',
          message: 'should find risks',
          check: (out: unknown) => (out as { risks: unknown[] }).risks.length > 0,
        },
      ],
    },
  ],
});

registerPrompt(surfaceAssumptionsPrompt);
