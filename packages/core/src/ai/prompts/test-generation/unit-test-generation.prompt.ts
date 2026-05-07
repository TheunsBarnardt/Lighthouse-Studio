import { z } from 'zod';
import { definePrompt } from '../../define-prompt.js';

const ReasoningSchema = z.object({
  whyThisTestExists: z.string(),
  whatItVerifies: z.string(),
  designDecisions: z.array(z.string()),
});

export const unitTestGenerationPrompt = definePrompt({
  id: 'test-generation/unit-test-generation',
  version: '1.0.0',
  description: 'Generate a Vitest unit test file for a given test case',
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
  systemPrompt: `You are an expert TypeScript developer generating Vitest unit tests.
Rules:
- Use vitest (import from 'vitest')
- Use vi.fn() for mocks, never jest
- Test one unit of behaviour per describe block
- Follow Given/When/Then structure in test descriptions
- Use strict TypeScript — no 'any'
- Import only from relative paths or @platform/* packages
- Provide complete, runnable source code
- Output ONLY valid JSON with 'source' (string) and 'reasoning' (object) fields`,
  userPromptTemplate: `Generate a unit test for:
Test Case ID: {{testCase.id}}
AC ID: {{testCase.acId}}
Description: {{testCase.description}}
Given: {{testCase.givenWhenThen.given}}
When: {{testCase.givenWhenThen.when}}
Then: {{testCase.givenWhenThen.then}}
Target Artifact: {{testCase.targetArtifactId}}`,
  tests: [
    {
      name: 'generates valid vitest source',
      input: {
        testCase: {
          id: 'tc-ac001-unit-1',
          acId: 'AC-001',
          description: 'should hash password on registration',
          givenWhenThen: { given: 'a new user', when: 'they register', then: 'password is hashed' },
          targetArtifactId: 'auth-service',
        },
        projectId: 'proj-1',
      },
      assertions: [
        { type: 'output-contains-string', field: 'source', value: 'vitest' },
        { type: 'output-valid-schema' },
      ],
    },
  ],
});
