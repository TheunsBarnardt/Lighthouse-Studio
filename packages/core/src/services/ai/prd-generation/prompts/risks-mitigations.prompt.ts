/**
 * Risks and Mitigations prompt — PRD section 10 of 10.
 *
 * Identifies technical and product risks using a probability/impact matrix,
 * with concrete mitigations and contingency plans. Derives risks from all
 * previously completed sections.
 */

import type { AiGenerationPort } from '@platform/ports-ai';
import type { z } from 'zod';

import type { IntentBrief } from '../../intent-capture/types.js';
import type { PromptDefinition } from '../../types.js';
import type {
  ConstraintsAndAssumptionsContent,
  FunctionalRequirementsContent,
  NonFunctionalRequirementsContent,
  RisksAndMitigationsContent,
} from '../types.js';

import { definePrompt } from '../../define-prompt.js';
import { RisksAndMitigationsContentSchema } from '../types.js';

// ── Input ─────────────────────────────────────────────────────────────────────

interface RisksMitigationsInput {
  intentBrief: IntentBrief;
  functionalRequirements: FunctionalRequirementsContent;
  nonFunctionalRequirements: NonFunctionalRequirementsContent;
  constraintsAndAssumptions: ConstraintsAndAssumptionsContent;
  templateHints?: string;
}

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior product manager and solutions architect with expertise in risk management for enterprise software projects. You approach risk identification systematically, not catastrophically — your goal is to surface real risks with concrete mitigations, not to create an endless worry list.

Your task is to write the Risks and Mitigations section of a PRD. You will receive an approved Intent Brief, the Functional Requirements, the Non-Functional Requirements, and the Constraints and Assumptions sections.

Each RiskEntry must:
- id: Sequential identifier "RISK-1", "RISK-2", etc.
- title: A short noun phrase naming the risk (e.g., "Third-Party API Unavailability", "Scope Expansion Under Deadline").
- description: 2-4 sentences describing the risk event, its trigger, and its direct consequences for the project.
- probability: The likelihood of the risk materialising: "low" | "medium" | "high".
- impact: The severity of consequences if the risk occurs: "low" | "medium" | "high" | "critical".
- riskScore: A composite rating based on probability × impact. Use this matrix:
  - low × low = "low"; low × medium = "low"; low × high = "medium"; low × critical = "medium"
  - medium × low = "low"; medium × medium = "medium"; medium × high = "high"; medium × critical = "high"
  - high × low = "medium"; high × medium = "high"; high × high = "high"; high × critical = "critical"
- mitigation: The proactive action taken before the risk occurs to reduce its probability or impact. Be specific — name the technique, tool, or process (e.g., "Implement circuit breaker pattern with fallback to cached data", "Contract API SLA with vendor before development begins").
- contingency: Optional — what the team will do IF the risk occurs despite mitigation (e.g., "Fall back to manual CSV upload workflow", "Engage backup vendor within 48 hours").
- owner: Optional — the role responsible for monitoring and executing the mitigation (e.g., "Tech lead", "Product manager", "Security team").
- relatedRequirements: Optional array of FR/NFR ids that this risk affects (e.g., ["FR-3", "NFR-2"]).

Risk category guidance:
- Technical risks: integration failures, data migration issues, performance bottlenecks, security vulnerabilities, third-party dependencies.
- Product risks: scope creep, wrong assumptions about user behaviour, regulatory change, competitive response.
- Delivery risks: key person dependencies, timeline compression, resource constraints.

Overall risk rating:
- overallRiskRating: The highest riskScore across all individual risks, or "high" if 3+ medium risks exist.

Quality rules:
- Aim for 5-12 risks. Do not pad the list with trivial risks.
- Mitigations must be actionable — not "monitor the situation" but a specific action.
- Every assumption in the constraints section should be reviewed for associated risks.
- Output strictly valid JSON. No prose outside the JSON object.

Anti-patterns to avoid:
- Risks whose mitigation is "we will be careful".
- Risks that are actually assumptions (put those in constraints/assumptions).
- Assigning "critical" impact to every risk — reserve it for risks that could cancel the project.`;

// ── Factory ───────────────────────────────────────────────────────────────────

export function createRisksMitigationsPrompt(
  ai: AiGenerationPort,
): PromptDefinition<RisksMitigationsInput, RisksAndMitigationsContent> {
  return definePrompt(ai, {
    id: 'prd.risks_and_mitigations',
    version: '1.0.0',
    description:
      'Generate the Risks and Mitigations section of a PRD using a probability/impact matrix with concrete mitigation strategies.',
    estimatedCostRange: { minUsd: 0.08, maxUsd: 0.35 },
    systemPrompt: SYSTEM_PROMPT,
    buildMessages: (input) => [
      {
        role: 'user',
        content: [
          'Generate the Risks and Mitigations section for this project.',
          '',
          '## Intent Brief',
          '```json',
          JSON.stringify(input.intentBrief, null, 2),
          '```',
          '',
          '## Functional Requirements (already written)',
          '```json',
          JSON.stringify(input.functionalRequirements, null, 2),
          '```',
          '',
          '## Non-Functional Requirements (already written)',
          '```json',
          JSON.stringify(input.nonFunctionalRequirements, null, 2),
          '```',
          '',
          '## Constraints and Assumptions (already written)',
          '```json',
          JSON.stringify(input.constraintsAndAssumptions, null, 2),
          '```',
          ...(input.templateHints ? ['', '## Template Hints', input.templateHints] : []),
          '',
          'Return a JSON object: { risks: RiskEntry[], overallRiskRating }',
          'Each RiskEntry: { id, title, description, probability, impact, riskScore, mitigation, contingency?, owner?, relatedRequirements? }',
        ].join('\n'),
      },
    ],
    outputSchema: RisksAndMitigationsContentSchema as z.ZodType<RisksAndMitigationsContent>,
    defaults: { model: 'claude-3-5-sonnet-20241022', maxTokens: 5000 },
  });
}
