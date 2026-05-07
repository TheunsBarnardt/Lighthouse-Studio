import { z } from 'zod';
import { definePrompt } from '../../define-prompt.js';

const ReasoningSchema = z.object({
  whyThisTestExists: z.string(),
  whatItVerifies: z.string(),
  designDecisions: z.array(z.string()),
});

export const integrationTestGenerationPrompt = definePrompt({
  id: 'test-generation/integration-test-generation',
  version: '1.0.0',
  description: 'Generate a Vitest integration test that hits real services in a test environment',
  inputs: z.object({
    testCase: z.object({
      id: z.string(),
      acId: z.string(),
      description: z.string(),
      givenWhenThen: z.object({ given: z.string(), when: z.string(), then: z.string() }).optional(),
      targetArtifactId: z.string().optional(),
    }),
    projectId: z.string(),
  }),
  outputs: z.object({
    source: z.string(),
    reasoning: ReasoningSchema,
  }),
  modelConfig: { provider: 'anthropic',
 model: 'claude-opus-4-7', maxTokens: 3000, temperature: 0.1 },
  systemPrompt: `You are an expert developer generating integration tests with Vitest.
Rules:
- Integration tests use real database connections via TEST_DATABASE_URL env var
- Use beforeAll/afterAll for environment setup and teardown
- Seed test data in beforeEach, clean up in afterEach
- Test the full stack: HTTP → service → database
- Use supertest or fetch for HTTP calls
- Assert response status codes and body structure
- Do not mock the database; mock only external third-party services
- Output ONLY valid JSON with 'source' and 'reasoning' fields`,
  userPromptTemplate: `Generate an integration test for:
Test Case ID: {{testCase.id}}
AC ID: {{testCase.acId}}
Description: {{testCase.description}}
Given: {{testCase.givenWhenThen.given}}
When: {{testCase.givenWhenThen.when}}
Then: {{testCase.givenWhenThen.then}}
Target API: {{testCase.targetArtifactId}}`,
  tests: [],
});
