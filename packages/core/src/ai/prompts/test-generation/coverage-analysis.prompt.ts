import { z } from 'zod';
import { definePrompt } from '../../define-prompt.js';

export const coverageAnalysisPrompt = definePrompt({
  id: 'test-generation/coverage-analysis',
  version: '1.0.0',
  description: 'Analyse coverage gaps and suggest additional tests to improve coverage',
  inputs: z.object({
    coverageReport: z.object({
      overall: z.object({ line: z.number(), branch: z.number(), function: z.number(), statement: z.number() }),
      perFile: z.record(z.object({ line: z.number(), branch: z.number(), function: z.number(), statement: z.number() })),
      thresholdsMet: z.boolean(),
      lineThreshold: z.number(),
      branchThreshold: z.number(),
    }),
    acCoverageReport: z.object({
      totalAcs: z.number(),
      acsWithTests: z.number(),
      acsWithoutTests: z.number(),
      uncoveredMustAcs: z.array(z.string()),
    }),
  }),
  outputs: z.object({
    gaps: z.array(z.object({
      filePath: z.string(),
      missedLines: z.array(z.number()),
      suggestedTestDescription: z.string(),
      priority: z.enum(['high', 'medium', 'low']),
    })),
    uncoveredAcRecommendations: z.array(z.object({
      acId: z.string(),
      suggestedTestType: z.enum(['unit', 'component', 'integration', 'e2e']),
      rationale: z.string(),
    })),
    overallAssessment: z.string(),
  }),
  modelConfig: { model: 'claude-haiku-4-5', maxTokens: 2000, temperature: 0.2 },
  systemPrompt: `You are a QA engineer analysing test coverage gaps.
Given a coverage report and AC coverage data, identify:
1. Files with low coverage and suggest specific tests to improve them
2. Uncovered ACs with recommendations for test type and approach
3. Overall assessment and priority actions
Output ONLY valid JSON matching the schema.`,
  userPromptTemplate: `Coverage Report:
{{coverageReport}}

AC Coverage:
{{acCoverageReport}}

Identify coverage gaps and suggest improvements.`,
  tests: [],
});
