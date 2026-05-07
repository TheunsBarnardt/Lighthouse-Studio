/**
 * Target Users and Personas prompt — PRD section 3 of 10.
 *
 * Expands each IntentPersona into a rich PersonaEntry with goals, pain points,
 * technical proficiency, and usage frequency. Identifies the primary persona.
 */

import type { AiGenerationPort } from '@platform/ports-ai';
import type { z } from 'zod';

import type { IntentBrief } from '../../intent-capture/types.js';
import type { PromptDefinition } from '../../types.js';
import type { OverviewContent, TargetUsersContent } from '../types.js';

import { definePrompt } from '../../define-prompt.js';
import { TargetUsersContentSchema } from '../types.js';

// ── Input ─────────────────────────────────────────────────────────────────────

interface TargetUsersPersonasInput {
  intentBrief: IntentBrief;
  overview: OverviewContent;
  templateHints?: string;
}

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior UX researcher with expertise in user-centred design and persona development for enterprise and consumer software products.

Your task is to write the Target Users and Personas section of a PRD. You will receive an approved Intent Brief (containing targetUsers, a list of IntentPersonas) and the written Overview section.

Each PersonaEntry must:
- Use the same id as the corresponding IntentPersona (e.g., "persona-1"). Preserve all existing persona IDs.
- name and description: Carry forward from the IntentPersona, enriching the description with realistic context if sparse.
- primaryGoals: 3-5 specific goals this persona has when using the product. Derived from the IntentPersona's needs and the project overview.
- painPoints: 3-5 concrete frustrations or obstacles this persona currently faces that the product addresses. Derived from IntentPersona.painPoints if present; infer from context if absent.
- technicalProficiency: Classify as "low", "medium", or "high" based on persona description and project context.
- frequency: How often this persona will use the product: "daily", "weekly", "monthly", or "occasional".
- tracesTo: At least one ref with type "intent_brief", artifactId set to pipelineId, fieldPath "targetUsers.<persona-id>".
- primaryPersona: The id of the single most important persona — the one whose needs most drive core design decisions.
- marketSize: Optional string estimating the total addressable audience if any indication is present in the intent brief.

Quality rules:
- Every IntentPersona must produce exactly one PersonaEntry. Do not skip personas.
- Primary goals and pain points must be specific to this persona's context — not generic user research platitudes.
- Technical proficiency must be justified by the persona description, not randomly assigned.
- Do not invent personas beyond those in the intent brief.
- Output strictly valid JSON. No prose outside the JSON object.

Anti-patterns to avoid:
- Pain points that are just the inverse of goals ("doesn't have feature X" instead of "wastes 3 hours per week on...").
- Assigning "high" technical proficiency to business user personas without justification.
- A primaryGoals list of vague statements like "wants a better experience".`;

// ── Factory ───────────────────────────────────────────────────────────────────

export function createTargetUsersPersonasPrompt(
  ai: AiGenerationPort,
): PromptDefinition<TargetUsersPersonasInput, TargetUsersContent> {
  return definePrompt(ai, {
    id: 'prd.target_users_and_personas',
    version: '1.0.0',
    description:
      'Generate the Target Users and Personas section of a PRD, enriching each IntentPersona into a detailed PersonaEntry.',
    estimatedCostRange: { minUsd: 0.05, maxUsd: 0.25 },
    systemPrompt: SYSTEM_PROMPT,
    buildMessages: (input) => [
      {
        role: 'user',
        content: [
          'Generate the Target Users and Personas section for this project.',
          '',
          '## Intent Brief',
          '```json',
          JSON.stringify(input.intentBrief, null, 2),
          '```',
          '',
          '## Overview (already written)',
          '```json',
          JSON.stringify(input.overview, null, 2),
          '```',
          ...(input.templateHints ? ['', '## Template Hints', input.templateHints] : []),
          '',
          'Return a JSON object: { personas: PersonaEntry[], primaryPersona: string, marketSize?: string }',
          'Each PersonaEntry: { id, name, description, primaryGoals: string[], painPoints: string[], technicalProficiency, frequency, tracesTo: [{ type, artifactId, fieldPath }] }',
        ].join('\n'),
      },
    ],
    outputSchema: TargetUsersContentSchema as z.ZodType<TargetUsersContent>,
    defaults: { model: 'claude-3-5-sonnet-20241022', maxTokens: 3000 },
  });
}
