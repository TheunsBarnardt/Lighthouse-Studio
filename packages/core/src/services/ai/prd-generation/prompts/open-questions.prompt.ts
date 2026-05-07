/**
 * Open Questions prompt — PRD section 9 of 10.
 *
 * Identifies questions that remain unanswered at PRD writing time and that
 * need resolution before or during development. Classifies each by impact.
 */

import type { AiGenerationPort } from '@platform/ports-ai';
import type { z } from 'zod';

import type { IntentBrief } from '../../intent-capture/types.js';
import type { PromptDefinition } from '../../types.js';
import type {
  FunctionalRequirementsContent,
  NonFunctionalRequirementsContent,
  OpenQuestionsContent,
} from '../types.js';

import { definePrompt } from '../../define-prompt.js';
import { OpenQuestionsContentSchema } from '../types.js';

// ── Input ─────────────────────────────────────────────────────────────────────

interface OpenQuestionsInput {
  intentBrief: IntentBrief;
  functionalRequirements: FunctionalRequirementsContent;
  nonFunctionalRequirements: NonFunctionalRequirementsContent;
  templateHints?: string;
}

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior product manager who understands that a PRD written at the start of a project will always have unresolved questions. Your job is to surface those questions explicitly rather than letting them become hidden blockers or late-stage surprises.

Your task is to write the Open Questions section of a PRD. You will receive an approved Intent Brief, the completed Functional Requirements, and the completed Non-Functional Requirements sections.

Each OpenQuestion must:
- id: Sequential identifier "OQ-1", "OQ-2", etc.
- question: A single, specific question in plain language. Avoid compound questions — one question per entry.
- context: 2-4 sentences explaining why this question matters and what is blocking a decision. Reference the specific FR, NFR, or constraint that raised it.
- owner: Optional — the role or team best positioned to answer (e.g., "Legal team", "Security architect", "Product leadership", "UX team"). Omit if genuinely unclear.
- dueDate: Optional — leave empty; this is filled in during project planning.
- status: Always "open" for freshly generated questions.
- resolution: Always null/absent for freshly generated questions.
- impact: Classify by what happens if this question is not resolved before development:
  - "blocking": Development of a "must" FR cannot begin or complete without resolving this.
  - "high": Development can proceed but a major rework risk exists if the question is resolved differently later.
  - "medium": The question affects a "should" or "could" requirement; resolution shapes detail but not structure.
  - "low": Minor clarification; resolution affects copy, labelling, or edge-case behaviour only.

Sources for questions (look for all of these):
1. Ambiguous or vague FRs that could be interpreted multiple ways.
2. NFRs with estimated/placeholder thresholds that need stakeholder confirmation.
3. Missing persona data that affects UX decisions.
4. Unresolved regulatory or compliance requirements in the constraints.
5. Third-party integrations with uncertain APIs or data models.
6. Business rules that are referenced but not fully defined.
7. Data ownership or privacy questions implied by the FRs.

Quality rules:
- Aim for 5-15 questions. Do not invent trivial questions to pad the list.
- Each question must have a non-trivial context — explain the impact, not just what is unknown.
- Questions must be actionable — someone must be able to answer them.
- Output strictly valid JSON. No prose outside the JSON object.

Anti-patterns to avoid:
- Questions like "What colour should buttons be?" — out of scope for a PRD.
- Duplicate questions that ask the same thing in different wording.
- Questions whose answers are already in the intent brief or completed sections.`;

// ── Factory ───────────────────────────────────────────────────────────────────

export function createOpenQuestionsPrompt(
  ai: AiGenerationPort,
): PromptDefinition<OpenQuestionsInput, OpenQuestionsContent> {
  return definePrompt(ai, {
    id: 'prd.open_questions',
    version: '1.0.0',
    description:
      'Generate the Open Questions section of a PRD by identifying unanswered questions across all PRD sections, classified by impact.',
    estimatedCostRange: { minUsd: 0.07, maxUsd: 0.3 },
    systemPrompt: SYSTEM_PROMPT,
    buildMessages: (input) => [
      {
        role: 'user',
        content: [
          'Generate the Open Questions section for this project.',
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
          ...(input.templateHints ? ['', '## Template Hints', input.templateHints] : []),
          '',
          'Return a JSON object: { questions: OpenQuestion[] }',
          'Each OpenQuestion: { id, question, context, owner?, dueDate?, status: "open", impact }',
        ].join('\n'),
      },
    ],
    outputSchema: OpenQuestionsContentSchema as z.ZodType<OpenQuestionsContent>,
    defaults: { model: 'claude-3-5-sonnet-20241022', maxTokens: 3500 },
  });
}
