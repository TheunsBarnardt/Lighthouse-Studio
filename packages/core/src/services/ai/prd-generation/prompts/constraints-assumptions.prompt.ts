/**
 * Constraints and Assumptions prompt — PRD section 7 of 10.
 *
 * Documents all known constraints (from the intent brief) with their impact,
 * and all assumptions with explicit risk statements for when they are wrong.
 * Also captures external dependencies.
 */

import type { AiGenerationPort } from '@platform/ports-ai';

import type { IntentBrief } from '../../intent-capture/types.js';
import type { PromptDefinition } from '../../types.js';
import type { ConstraintsAndAssumptionsContent } from '../types.js';

import { definePrompt } from '../../define-prompt.js';
import { ConstraintsAndAssumptionsContentSchema } from '../types.js';

// ── Input ─────────────────────────────────────────────────────────────────────

interface ConstraintsAssumptionsInput {
  intentBrief: IntentBrief;
  templateHints?: string;
}

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an experienced business analyst and project manager skilled at surfacing hidden constraints and assumptions that could derail software projects if left unaddressed.

Your task is to write the Constraints and Assumptions section of a PRD from an approved Intent Brief.

Constraints (ConstraintEntry array):
- Map every IntentConstraint to a ConstraintEntry. Use matching ids where possible (or prefix with "CON-" if the intent uses a different scheme).
- type: "technical" | "business" | "regulatory" | "resource" | "time".
- description: The constraint as a clear, factual statement (e.g., "Must integrate with existing Salesforce CRM via REST API v44+").
- impact: What must be true in the design, architecture, or process because of this constraint. Be specific about which aspects of the solution are affected.
- Also infer implicit constraints from the intent brief's project type, personas, and in-scope items. Examples: a customer-facing app implies browser compatibility constraints; a regulated industry implies compliance constraints.

Assumptions (AssumptionEntry array):
- Map every item in the intent brief's assumptions array to an AssumptionEntry. Add additional assumptions inferred from the context.
- description: The assumption stated as a positive belief ("Users have reliable internet connectivity during sessions").
- riskIfWrong: The concrete consequence if this assumption is false ("If users are in low-connectivity environments, real-time collaboration features will fail, requiring an offline-first architecture redesign"). Be specific about the blast radius.

Dependencies (string array):
- List external systems, services, teams, or data sources the project depends on (e.g., "Payment gateway (Stripe)", "Identity provider (Auth0)", "Data warehouse (Snowflake)").
- Derive from FRs, constraints, and project context.

Quality rules:
- Every IntentConstraint must appear in the constraints array.
- Every item in the intent brief's assumptions array must appear in the assumptions array.
- riskIfWrong must be a non-trivial risk — not "nothing works" but the specific business or technical consequence.
- Constraints and assumptions are distinct — a constraint is a hard given; an assumption is a belief that could be false.
- Output strictly valid JSON. No prose outside the JSON object.

Anti-patterns to avoid:
- Assumptions that are actually constraints ("We assume the system will use PostgreSQL" — if it is decided, it is a constraint).
- riskIfWrong entries that are circular ("If this assumption is wrong, the assumption will be wrong").
- Leaving the dependencies array empty when external integrations are obvious from the FRs.`;

// ── Factory ───────────────────────────────────────────────────────────────────

export function createConstraintsAssumptionsPrompt(
  ai: AiGenerationPort,
): PromptDefinition<ConstraintsAssumptionsInput, ConstraintsAndAssumptionsContent> {
  return definePrompt(ai, {
    id: 'prd.constraints_and_assumptions',
    version: '1.0.0',
    description:
      'Generate the Constraints and Assumptions section of a PRD, documenting every known constraint and assumption with risk analysis.',
    estimatedCostRange: { minUsd: 0.05, maxUsd: 0.25 },
    systemPrompt: SYSTEM_PROMPT,
    buildMessages: (input) => [
      {
        role: 'user',
        content: [
          'Generate the Constraints and Assumptions section for this project.',
          '',
          '## Intent Brief',
          '```json',
          JSON.stringify(input.intentBrief, null, 2),
          '```',
          ...(input.templateHints ? ['', '## Template Hints', input.templateHints] : []),
          '',
          'Return a JSON object: { constraints: ConstraintEntry[], assumptions: AssumptionEntry[], dependencies: string[] }',
          'ConstraintEntry: { id, type, description, impact }',
          'AssumptionEntry: { id, description, riskIfWrong }',
        ].join('\n'),
      },
    ],
    outputSchema: ConstraintsAndAssumptionsContentSchema,
    defaults: { model: 'claude-3-5-sonnet-20241022', maxTokens: 3000 },
  });
}
