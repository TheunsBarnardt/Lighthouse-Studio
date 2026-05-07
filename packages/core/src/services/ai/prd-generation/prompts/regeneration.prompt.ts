/**
 * Regeneration prompt — auxiliary prompt 3 of 5.
 *
 * Revises a specific PRD section based on user feedback while preserving
 * consistency with other approved sections. The output schema is z.unknown()
 * because the caller validates against the section-specific schema.
 */

import type { AiGenerationPort } from '@platform/ports-ai';

import { z } from 'zod';

import type { IntentBrief } from '../../intent-capture/types.js';
import type { PromptDefinition } from '../../types.js';
import type { PrdSectionContent, PrdSectionType } from '../types.js';

import { definePrompt } from '../../define-prompt.js';

// ── Input ─────────────────────────────────────────────────────────────────────

interface RegenerationInput {
  intentBrief: IntentBrief;
  sectionType: PrdSectionType;
  currentContent: PrdSectionContent;
  userFeedback: string;
  otherApprovedSections: Partial<Record<PrdSectionType, PrdSectionContent>>;
}

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert product manager tasked with revising a specific section of an existing Product Requirements Document based on user feedback.

You will receive:
1. The original Intent Brief that the entire PRD was derived from.
2. The section type being revised (e.g., "functional_requirements").
3. The current content of that section as JSON.
4. The user's feedback describing what needs to change.
5. Other already-approved PRD sections for consistency reference.

Your job is to produce a revised version of the specified section that:
- Incorporates the user's feedback completely and precisely. Do not ignore or partially implement feedback.
- Maintains internal structural integrity — all required fields remain present, IDs remain consistent.
- Preserves consistency with the other approved sections. Do not contradict approved content unless the feedback explicitly requests it.
- Retains all content not affected by the feedback. Only change what the feedback asks to change.
- Preserves all existing IDs (FR-1, US-3, etc.) wherever possible. If new items are added, assign new sequential IDs continuing from the current highest.

The output must be valid JSON matching the same schema as the current content. Output ONLY the revised section JSON — no wrapping object, no explanation, no markdown.

Feedback interpretation rules:
- If feedback says "add X" — add X while preserving all existing content.
- If feedback says "remove X" — remove X while preserving all other content.
- If feedback says "rewrite X" — rewrite only X.
- If feedback is ambiguous, interpret it conservatively — make the minimal change that satisfies the intent.
- If feedback requests a change that would create an inconsistency with an approved section, make the change but note it would need traceability updates.

Anti-patterns to avoid:
- Regenerating the entire section when only one element needs to change.
- Dropping fields that are required by the section schema.
- Renumbering all IDs when only one item was added or removed.
- Adding content not requested by the feedback.`;

// ── Factory ───────────────────────────────────────────────────────────────────

export function createRegenerationPrompt(
  ai: AiGenerationPort,
): PromptDefinition<RegenerationInput, unknown> {
  return definePrompt(ai, {
    id: 'prd.regeneration',
    version: '1.0.0',
    description:
      'Revise a specific PRD section based on user feedback, preserving consistency with other approved sections.',
    estimatedCostRange: { minUsd: 0.08, maxUsd: 0.4 },
    systemPrompt: SYSTEM_PROMPT,
    buildMessages: (input) => [
      {
        role: 'user',
        content: [
          `Revise the "${input.sectionType}" section based on the feedback below.`,
          '',
          '## User Feedback',
          input.userFeedback,
          '',
          '## Current Section Content',
          '```json',
          JSON.stringify(input.currentContent, null, 2),
          '```',
          '',
          '## Intent Brief',
          '```json',
          JSON.stringify(input.intentBrief, null, 2),
          '```',
          ...(Object.keys(input.otherApprovedSections).length > 0
            ? [
                '',
                '## Other Approved Sections (for consistency reference)',
                '```json',
                JSON.stringify(input.otherApprovedSections, null, 2),
                '```',
              ]
            : []),
          '',
          'Return ONLY the revised section JSON (same structure as the current content). No wrapper, no explanation.',
        ].join('\n'),
      },
    ],
    // Caller is responsible for validating against the section-specific schema
    outputSchema: z.unknown(),
    defaults: { model: 'claude-3-5-sonnet-20241022', maxTokens: 8000 },
  });
}
