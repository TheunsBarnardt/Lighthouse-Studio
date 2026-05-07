import { z } from 'zod';
import { definePrompt } from '../../define-prompt.js';

export const flakyDetectionPrompt = definePrompt({
  id: 'test-generation/flaky-detection',
  version: '1.0.0',
  description: 'Analyse test source code for patterns that cause flakiness and suggest fixes',
  inputs: z.object({
    testSource: z.string(),
    testType: z.enum(['unit', 'component', 'integration', 'e2e']),
    failureHistory: z.array(z.object({
      runId: z.string(),
      error: z.string(),
      passed: z.boolean(),
    })).optional(),
  }),
  outputs: z.object({
    flakyPatterns: z.array(z.object({
      pattern: z.string(),
      lineNumber: z.number().optional(),
      severity: z.enum(['high', 'medium', 'low']),
      fix: z.string(),
    })),
    fixedSource: z.string().optional(),
    confidence: z.number().min(0).max(1),
  }),
  modelConfig: { model: 'claude-haiku-4-5', maxTokens: 2000, temperature: 0.1 },
  systemPrompt: `You are a senior QA engineer identifying flaky test patterns.
Common flakiness causes:
- Hardcoded timeouts instead of proper await/retry
- Race conditions from unresolved async operations
- Date/time dependencies without mocking
- Random data without seeds
- Shared mutable state between tests
- Network calls without deterministic mocks
- File system state leaking between tests
Identify patterns, severity, and provide specific fixes. Output ONLY valid JSON.`,
  userPromptTemplate: `Test Type: {{testType}}

Test Source:
\`\`\`typescript
{{testSource}}
\`\`\`

{{#failureHistory}}
Failure History:
{{failureHistory}}
{{/failureHistory}}

Identify flaky patterns and provide fixes.`,
  tests: [],
});
