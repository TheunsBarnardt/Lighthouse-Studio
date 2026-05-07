/**
 * Traceability Check prompt — auxiliary prompt 2 of 5.
 *
 * Verifies that every IntentGoal has at least one supporting FunctionalRequirement.
 * Returns a TraceabilityReport that is stored on the PRD artifact.
 */

import type { AiGenerationPort } from '@platform/ports-ai';

import { z } from 'zod';

import type { IntentBrief } from '../../intent-capture/types.js';
import type { PromptDefinition } from '../../types.js';
import type { FunctionalRequirementsContent } from '../types.js';

import { definePrompt } from '../../define-prompt.js';

// ── Zod schema for the output ─────────────────────────────────────────────────

const TraceabilityGapSchema = z.object({
  intentGoalId: z.string(),
  intentGoalDescription: z.string(),
  requirementCount: z.number().int().nonnegative(),
});

const TraceabilityReportOutputSchema = z.object({
  totalIntentGoals: z.number().int().nonnegative(),
  coveredGoals: z.number().int().nonnegative(),
  gaps: z.array(TraceabilityGapSchema),
  fullyCovered: z.boolean(),
});

type TraceabilityReportOutput = z.infer<typeof TraceabilityReportOutputSchema>;

// ── Input ─────────────────────────────────────────────────────────────────────

interface TraceabilityCheckInput {
  intentBrief: IntentBrief;
  functionalRequirements: FunctionalRequirementsContent;
}

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a requirements traceability analyst. Your job is to verify that every stated business goal from an Intent Brief is addressed by at least one Functional Requirement in the PRD.

You will receive an Intent Brief (containing a goals array) and the Functional Requirements section.

For each IntentGoal, check whether it is covered by one or more FunctionalRequirements:
- A requirement covers a goal if:
  a) The requirement's tracesTo array contains a ref whose fieldPath includes the goal's id (e.g., "goals.goal-1"), OR
  b) The requirement's description, title, or acceptance criteria clearly address the goal's intent (semantic match).

Compute:
- totalIntentGoals: The total number of goals in the intent brief.
- coveredGoals: The number of goals with at least one covering requirement.
- gaps: An array of TraceabilityGap for each goal with requirementCount = 0. Include:
  - intentGoalId: The goal's id.
  - intentGoalDescription: The goal's description text.
  - requirementCount: Always 0 in the gaps array (these are uncovered goals).
- fullyCovered: true only if gaps is empty.

Important: Do NOT invent coverage. If a goal is not explicitly addressed, report it as a gap.

Output strictly valid JSON: { totalIntentGoals, coveredGoals, gaps, fullyCovered }
No prose outside the JSON object.

Anti-patterns to avoid:
- Marking a goal as covered by semantic similarity when it is clearly not addressed.
- Omitting goals from the count entirely.
- Reporting fullyCovered as true when gaps array is non-empty.`;

// ── Factory ───────────────────────────────────────────────────────────────────

export function createTraceabilityCheckPrompt(
  ai: AiGenerationPort,
): PromptDefinition<TraceabilityCheckInput, TraceabilityReportOutput> {
  return definePrompt(ai, {
    id: 'prd.traceability_check',
    version: '1.0.0',
    description:
      'Verify that every IntentGoal has at least one supporting FunctionalRequirement and identify coverage gaps.',
    estimatedCostRange: { minUsd: 0.05, maxUsd: 0.2 },
    systemPrompt: SYSTEM_PROMPT,
    buildMessages: (input) => [
      {
        role: 'user',
        content: [
          'Check traceability between the intent goals and functional requirements.',
          '',
          '## Intent Brief',
          '```json',
          JSON.stringify(input.intentBrief, null, 2),
          '```',
          '',
          '## Functional Requirements',
          '```json',
          JSON.stringify(input.functionalRequirements, null, 2),
          '```',
          '',
          'Return a JSON object: { totalIntentGoals, coveredGoals, gaps: [{ intentGoalId, intentGoalDescription, requirementCount }], fullyCovered }',
        ].join('\n'),
      },
    ],
    outputSchema: TraceabilityReportOutputSchema,
    defaults: { model: 'claude-3-5-sonnet-20241022', maxTokens: 2000 },
  });
}
