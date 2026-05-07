import { z } from 'zod';
import { definePrompt } from '../../define-prompt.js';

export const testPlanGenerationPrompt = definePrompt({
  id: 'test-generation/test-plan-generation',
  version: '1.0.0',
  description: 'Analyse PRD acceptance criteria and generate a structured test plan mapping ACs to test cases',
  inputs: z.object({
    prdContent: z.string(),
    schemaContent: z.string(),
    uiProjectSummary: z.string(),
    serverCodeSummary: z.string(),
  }),
  outputs: z.object({
    testCases: z.array(z.object({
      id: z.string(),
      acId: z.string(),
      testType: z.enum(['unit', 'component', 'integration', 'e2e']),
      description: z.string(),
      givenWhenThen: z.object({ given: z.string(), when: z.string(), then: z.string() }).optional(),
      targetArtifactId: z.string().optional(),
    })),
    uncoveredAcs: z.array(z.object({ acId: z.string(), reason: z.string() })),
    estimatedTotalCount: z.object({
      unit: z.number(),
      component: z.number(),
      integration: z.number(),
      e2e: z.number(),
    }),
  }),
  modelConfig: { model: 'claude-opus-4-7', maxTokens: 4000, temperature: 0.2 },
  systemPrompt: `You are a senior QA engineer analysing a PRD to produce a comprehensive test plan.
Your goal is to map every acceptance criterion (AC) to one or more test cases.
Rules:
- Prefer unit tests for business logic, component tests for UI, integration tests for API+DB flows, e2e for user journeys
- Each AC should have at least one test case; flag ACs that cannot be automatically tested
- Use Given/When/Then format for all test cases
- IDs must be stable slugs: tc-<acId>-<type>-<n>
- Output ONLY valid JSON matching the schema`,
  userPromptTemplate: `PRD Content:
{{prdContent}}

Database Schema:
{{schemaContent}}

UI Project Summary:
{{uiProjectSummary}}

Server Code Summary:
{{serverCodeSummary}}

Generate a complete test plan. Map every AC to test cases. Flag any ACs that cannot be automatically tested with a reason.`,
  tests: [
    {
      name: 'basic PRD produces test cases',
      inputs: {
        prdContent: 'AC-001: Users can register with email and password. AC-002: Login returns JWT.',
        schemaContent: 'users table: id, email, password_hash',
        uiProjectSummary: 'Registration and login forms',
        serverCodeSummary: 'POST /auth/register, POST /auth/login',
      },
      assertions: [
        { type: 'output-contains', field: 'testCases', check: (v: unknown[]) => v.length >= 2 },
        { type: 'output-valid-schema' },
      ],
    },
  ],
});
