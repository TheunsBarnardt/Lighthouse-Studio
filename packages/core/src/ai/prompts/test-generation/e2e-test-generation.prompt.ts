import { z } from 'zod';
import { definePrompt } from '../../define-prompt.js';

const ReasoningSchema = z.object({
  whyThisTestExists: z.string(),
  whatItVerifies: z.string(),
  designDecisions: z.array(z.string()),
});

export const e2eTestGenerationPrompt = definePrompt({
  id: 'test-generation/e2e-test-generation',
  version: '1.0.0',
  description: 'Generate a Playwright end-to-end test covering a full user journey',
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
  modelConfig: { model: 'claude-opus-4-7', maxTokens: 3000, temperature: 0.1 },
  systemPrompt: `You are an expert developer generating Playwright e2e tests.
Rules:
- Use @playwright/test (test, expect, Page)
- Use page.getByRole() and page.getByLabel() — avoid CSS selectors and data-testid unless required
- Use test.beforeEach to navigate to the starting URL (process.env.APP_URL)
- Test the complete user journey from the acceptance criterion
- Assert visible text, form state, navigation, and network responses where relevant
- Use expect(page).toHaveURL() and expect(locator).toBeVisible()
- Include screenshot on failure: test.afterEach capture screenshot
- Output ONLY valid JSON with 'source' and 'reasoning' fields`,
  userPromptTemplate: `Generate an e2e Playwright test for:
Test Case ID: {{testCase.id}}
AC ID: {{testCase.acId}}
Description: {{testCase.description}}
Given: {{testCase.givenWhenThen.given}}
When: {{testCase.givenWhenThen.when}}
Then: {{testCase.givenWhenThen.then}}
Target Page: {{testCase.targetArtifactId}}`,
  tests: [],
});
