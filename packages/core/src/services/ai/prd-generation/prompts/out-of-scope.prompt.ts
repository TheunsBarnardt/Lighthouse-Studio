/**
 * Out of Scope prompt — PRD section 8 of 10.
 *
 * Documents explicit out-of-scope items derived from both the intent brief's
 * outOfScope list and items implied by the in-scope functional requirements.
 * Each item includes a rationale and optional deferral note.
 */

import type { AiGenerationPort } from '@platform/ports-ai';
import type { z } from 'zod';

import type { IntentBrief } from '../../intent-capture/types.js';
import type { PromptDefinition } from '../../types.js';
import type { FunctionalRequirementsContent, OutOfScopeContent } from '../types.js';

import { definePrompt } from '../../define-prompt.js';
import { OutOfScopeContentSchema } from '../types.js';

// ── Input ─────────────────────────────────────────────────────────────────────

interface OutOfScopeInput {
  intentBrief: IntentBrief;
  functionalRequirements: FunctionalRequirementsContent;
  templateHints?: string;
}

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior product manager who understands that clearly communicating what is NOT in scope is just as important as defining what is in scope. Explicit out-of-scope documentation prevents scope creep, manages stakeholder expectations, and reduces rework.

Your task is to write the Out of Scope section of a PRD. You will receive an approved Intent Brief (with its outOfScope array) and the completed Functional Requirements section.

Each OutOfScopeItem must:
- id: Sequential identifier "OOS-1", "OOS-2", etc.
- description: A clear, specific statement of what will NOT be built or delivered. Use definitive language ("This release does not include...", "The system will not support...").
- rationale: The business or technical reason this item was excluded. Options include: out of time/budget, requires separate project, regulatory dependency not yet resolved, not validated by user research, handled by a third-party tool, deferred to a future phase.
- deferredTo: Optional — if this item will be tackled later, note when/where (e.g., "Phase 2", "v2.0", "Objective 25", "after Q4 compliance audit").

Sources:
1. Map every item in the intent brief's outOfScope array to an OOS item.
2. Review the functional requirements to identify related capabilities that are deliberately excluded — common adjacent features that stakeholders might assume are included but are not.
3. Infer further exclusions from the project type: e.g., a v1 CRM likely excludes advanced reporting, workflow automation, AI scoring, mobile native apps.

Notes field:
- If there are overall themes or cross-cutting rationale for multiple exclusions, capture them in the optional notes field.

Quality rules:
- Every intent brief outOfScope item must produce at least one OOS entry.
- Descriptions must be specific enough to prevent "well, that could be interpreted as in scope" debates.
- Rationales must be non-trivial — not just "not needed" but WHY it is not needed for this phase.
- Output strictly valid JSON. No prose outside the JSON object.

Anti-patterns to avoid:
- OOS items that are the same as things explicitly NOT mentioned anywhere — only exclude things that stakeholders might reasonably assume are in scope.
- Vague items like "Advanced features" — name the specific feature.
- Missing rationale — every OOS item must justify its exclusion.`;

// ── Factory ───────────────────────────────────────────────────────────────────

export function createOutOfScopePrompt(
  ai: AiGenerationPort,
): PromptDefinition<OutOfScopeInput, OutOfScopeContent> {
  return definePrompt(ai, {
    id: 'prd.out_of_scope',
    version: '1.0.0',
    description:
      'Generate the Out of Scope section of a PRD, documenting explicit exclusions from the intent brief plus implied exclusions from the FRs.',
    estimatedCostRange: { minUsd: 0.05, maxUsd: 0.2 },
    systemPrompt: SYSTEM_PROMPT,
    buildMessages: (input) => [
      {
        role: 'user',
        content: [
          'Generate the Out of Scope section for this project.',
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
          ...(input.templateHints ? ['', '## Template Hints', input.templateHints] : []),
          '',
          'Return a JSON object: { items: OutOfScopeItem[], notes?: string }',
          'Each OutOfScopeItem: { id, description, rationale, deferredTo? }',
        ].join('\n'),
      },
    ],
    outputSchema: OutOfScopeContentSchema as z.ZodType<OutOfScopeContent>,
    defaults: { model: 'claude-3-5-sonnet-20241022', maxTokens: 2500 },
  });
}
