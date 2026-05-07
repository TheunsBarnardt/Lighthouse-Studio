import { z } from 'zod';
import { definePrompt } from '../../define-prompt.js';

const ReasoningSchema = z.object({
  whyThisTestExists: z.string(),
  whatItVerifies: z.string(),
  designDecisions: z.array(z.string()),
});

export const componentTestGenerationPrompt = definePrompt({
  id: 'test-generation/component-test-generation',
  version: '1.0.0',
  description: 'Generate a Vitest + React Testing Library component test file',
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
  systemPrompt: `You are an expert React developer generating component tests with Vitest and React Testing Library.
Rules:
- Use @testing-library/react for rendering, @testing-library/user-event for interactions
- Query by accessible roles first (getByRole), text second, testids last resort
- Test user-visible behaviour, not implementation details
- Include axe-core accessibility check: await expect(container).toHaveNoViolations()
- Mock external API calls with vi.fn()
- Use strict TypeScript — no 'any'
- Output ONLY valid JSON with 'source' and 'reasoning' fields`,
  userPromptTemplate: `Generate a component test for:
Test Case ID: {{testCase.id}}
AC ID: {{testCase.acId}}
Description: {{testCase.description}}
Given: {{testCase.givenWhenThen.given}}
When: {{testCase.givenWhenThen.when}}
Then: {{testCase.givenWhenThen.then}}
Target Component: {{testCase.targetArtifactId}}`,
  tests: [],
});
