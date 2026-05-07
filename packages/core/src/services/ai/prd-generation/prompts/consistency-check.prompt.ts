/**
 * Consistency Check prompt — auxiliary prompt 1 of 5.
 *
 * Scans all generated PRD sections for contradictions, terminology mismatches,
 * and logical inconsistencies. Returns a ConsistencyReport that the
 * PrdGenerationService stores on the PRD artifact.
 */

import type { AiGenerationPort } from '@platform/ports-ai';

import { z } from 'zod';

import type { PromptDefinition } from '../../types.js';
import type { PrdSectionContent, PrdSectionType } from '../types.js';

import { definePrompt } from '../../define-prompt.js';

// ── Zod schema for the output ─────────────────────────────────────────────────

const ConsistencyIssueSchema = z.object({
  id: z.string(),
  severity: z.enum(['warning', 'error']),
  sections: z.array(z.string()),
  description: z.string().min(1),
  suggestion: z.string().min(1),
  resolved: z.boolean(),
});

const ConsistencyReportOutputSchema = z.object({
  issues: z.array(ConsistencyIssueSchema),
  clean: z.boolean(),
});

type ConsistencyReportOutput = z.infer<typeof ConsistencyReportOutputSchema>;

// ── Input ─────────────────────────────────────────────────────────────────────

interface ConsistencyCheckInput {
  sections: Partial<Record<PrdSectionType, PrdSectionContent>>;
}

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a technical editor reviewing a Product Requirements Document for internal consistency. Your job is to find contradictions, mismatches, and logical gaps between sections — NOT to critique the quality of individual requirements.

You will receive a set of PRD sections serialised as JSON. Check for:
1. Terminology mismatches: A concept is named differently across sections (e.g., "user" in overview vs "customer" in FRs vs "account holder" in NFRs). Flag as "warning".
2. Contradictions: A statement in one section directly contradicts a statement in another (e.g., overview says "mobile-first" but NFRs specify desktop-only performance targets). Flag as "error".
3. Orphaned references: A section references an ID (persona ID, goal ID, story ID) that does not exist in the referenced section. Flag as "error".
4. Priority conflicts: A user story marked "wont" is supported by a "must" functional requirement, or vice versa. Flag as "warning".
5. Coverage gaps: An in-scope item from the overview/goals is mentioned in no functional requirement. Flag as "warning".
6. Assumption violations: A risk or constraint assumes something that a different section contradicts.

Each ConsistencyIssue must have:
- id: "CI-1", "CI-2", etc. — sequential, unique.
- severity: "error" (must fix before approval) or "warning" (should review).
- sections: Array of the section type strings involved (e.g., ["functional_requirements", "non_functional_requirements"]).
- description: A specific description of the inconsistency — quote the conflicting values.
- suggestion: A concrete recommendation for how to resolve the inconsistency.
- resolved: Always false for newly found issues.

If no issues are found, return an empty issues array and set clean to true.

Output strictly valid JSON: { issues: ConsistencyIssue[], clean: boolean }
No prose outside the JSON. The clean field must equal (issues.length === 0).

Anti-patterns to avoid:
- Flagging stylistic differences that do not create logical inconsistency.
- Inventing issues that are not present in the provided content.
- Flagging issues in sections that were not provided.`;

// ── Factory ───────────────────────────────────────────────────────────────────

export function createConsistencyCheckPrompt(
  ai: AiGenerationPort,
): PromptDefinition<ConsistencyCheckInput, ConsistencyReportOutput> {
  return definePrompt(ai, {
    id: 'prd.consistency_check',
    version: '1.0.0',
    description:
      'Scan all PRD sections for contradictions, terminology mismatches, and logical inconsistencies.',
    estimatedCostRange: { minUsd: 0.1, maxUsd: 0.5 },
    systemPrompt: SYSTEM_PROMPT,
    buildMessages: (input) => [
      {
        role: 'user',
        content: [
          'Check the following PRD sections for consistency issues.',
          '',
          '## PRD Sections',
          '```json',
          JSON.stringify(input.sections, null, 2),
          '```',
          '',
          'Return a JSON object: { issues: ConsistencyIssue[], clean: boolean }',
          'Each ConsistencyIssue: { id, severity, sections: string[], description, suggestion, resolved: false }',
        ].join('\n'),
      },
    ],
    outputSchema: ConsistencyReportOutputSchema,
    defaults: { model: 'claude-3-5-sonnet-20241022', maxTokens: 4000 },
  });
}
