/**
 * Staleness Detection prompt — auxiliary prompt 4 of 5.
 *
 * Compares an (possibly updated) Intent Brief with existing PRD section
 * summaries to identify which sections need regeneration. Returns an
 * affectedSections array with change reasons.
 */

import type { AiGenerationPort } from '@platform/ports-ai';

import { z } from 'zod';

import type { IntentBrief } from '../../intent-capture/types.js';
import type { PromptDefinition } from '../../types.js';
import type { PrdSectionType } from '../types.js';

import { definePrompt } from '../../define-prompt.js';
import { PrdSectionTypeSchema } from '../types.js';

// ── Output schema ─────────────────────────────────────────────────────────────

const AffectedSectionSchema = z.object({
  sectionType: PrdSectionTypeSchema,
  reason: z.string().min(1),
  changedIntentFields: z.array(z.string()).min(1),
});

const StalenessDetectionOutputSchema = z.object({
  affectedSections: z.array(AffectedSectionSchema),
});

type StalenessDetectionOutput = z.infer<typeof StalenessDetectionOutputSchema>;

// ── Input ─────────────────────────────────────────────────────────────────────

interface StalenessDetectionInput {
  intentBrief: IntentBrief;
  sections: Partial<
    Record<PrdSectionType, { sectionType: PrdSectionType; contentSummary: string }>
  >;
}

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a requirements analyst who specialises in impact analysis — determining which parts of a PRD become stale when the underlying Intent Brief is updated.

You will receive:
1. The current (possibly updated) Intent Brief.
2. A set of existing PRD section summaries, each with a sectionType and a contentSummary describing what that section contains.

Your task is to identify which sections need regeneration because the intent brief has changed in ways that affect their content.

For each potentially stale section:
- sectionType: The section identifier (e.g., "functional_requirements").
- reason: A specific, actionable explanation of why this section is stale (e.g., "The intent brief added a new goal 'goal-4' that is not yet reflected in any functional requirement").
- changedIntentFields: An array of dot-path field references in the intent brief that changed and affect this section (e.g., ["goals.goal-4", "targetUsers.persona-2.needs"]).

Section staleness rules:
- overview: Stale if title, description, or inScope changed.
- goals_and_success_metrics: Stale if any goal was added, removed, or had its description/priority changed.
- target_users_and_personas: Stale if targetUsers changed (new persona, removed persona, or modified persona needs/painPoints).
- user_stories: Stale if target users or goals changed.
- functional_requirements: Stale if user stories are stale, or if inScope items were added/removed.
- non_functional_requirements: Stale if constraints changed or FRs are stale.
- constraints_and_assumptions: Stale if constraints or assumptions changed.
- out_of_scope: Stale if outOfScope items changed or FRs changed.
- open_questions: Stale if FRs or NFRs changed significantly.
- risks_and_mitigations: Stale if constraints, FRs, or NFRs changed.

If no sections are stale (the intent brief has not changed in ways that affect any section), return an empty affectedSections array.

Output strictly valid JSON: { affectedSections: [{ sectionType, reason, changedIntentFields: string[] }] }
No prose outside the JSON object. Do not include sections that are NOT stale.

Anti-patterns to avoid:
- Marking every section as stale for a minor wording change.
- Providing vague reasons like "content may need updating".
- Including changedIntentFields that are not actually different from what the section summaries describe.`;

// ── Factory ───────────────────────────────────────────────────────────────────

export function createStalenessDetectionPrompt(
  ai: AiGenerationPort,
): PromptDefinition<StalenessDetectionInput, StalenessDetectionOutput> {
  return definePrompt(ai, {
    id: 'prd.staleness_detection',
    version: '1.0.0',
    description:
      'Compare an updated Intent Brief with existing PRD section summaries to identify which sections need regeneration.',
    estimatedCostRange: { minUsd: 0.05, maxUsd: 0.25 },
    systemPrompt: SYSTEM_PROMPT,
    buildMessages: (input) => [
      {
        role: 'user',
        content: [
          'Identify which PRD sections are stale given the current intent brief.',
          '',
          '## Current Intent Brief',
          '```json',
          JSON.stringify(input.intentBrief, null, 2),
          '```',
          '',
          '## Existing Section Summaries',
          '```json',
          JSON.stringify(input.sections, null, 2),
          '```',
          '',
          'Return a JSON object: { affectedSections: [{ sectionType, reason, changedIntentFields: string[] }] }',
          'Return an empty affectedSections array if nothing is stale.',
        ].join('\n'),
      },
    ],
    outputSchema: StalenessDetectionOutputSchema,
    defaults: { model: 'claude-3-5-sonnet-20241022', maxTokens: 2000 },
  });
}
