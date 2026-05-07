import { z } from 'zod';
import { definePrompt, registerPrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  intentBriefJson: z.string(),
  lockedDecisionsSectionJson: z.string(),
  scopeSectionJson: z.string(),
});

const OutputSchema = z.object({
  antiPatterns: z.array(z.object({
    id: z.string(),
    rule: z.string(),
    rationale: z.string(),
  })).min(1),
  reasoning: z.string(),
});

export const antiPatternsPrompt = definePrompt({
  id: 'prd-generation/anti-patterns',
  version: '1.0.0',
  description: 'Generate the Anti-Patterns section — "we don\'t do X" rules that constrain downstream stages',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: {
    provider: 'anthropic',
    model: 'claude-opus-4-7',
    temperature: 0.2,
    maxTokens: 2048,
  },
  systemPrompt: `You are a technical lead. You define explicit "we don't do this" rules specific to this product.

Rules:
- Each rule is an imperative prohibition: "Do not X because Y"
- Anti-patterns are product/domain specific, not generic best practices
- They come from the intent brief's outOfScope, constraints, or explicit user statements
- Downstream stages (6, 7, 8) treat these as hard constraints — the generated app will not implement refused features
- Typical count: 5-12 rules`,
  userPromptTemplate: ({ intentBriefJson, lockedDecisionsSectionJson, scopeSectionJson }) => `
Write the Anti-Patterns to Refuse section (Section 11 of 13) of the PRD.

Intent Brief:
${intentBriefJson}

Locked Decisions (violations to guard against):
${lockedDecisionsSectionJson}

Scope (out-of-scope items each become a candidate anti-pattern):
${scopeSectionJson}

Return JSON with:
- antiPatterns: array of { id, rule, rationale }
- reasoning: where these rules come from
`.trim(),
  tests: [
    {
      description: 'Converts out-of-scope items into anti-pattern rules',
      input: {
        intentBriefJson: JSON.stringify({ title: 'Blog', outOfScope: ['Mobile app', 'Paid subscriptions'] }),
        lockedDecisionsSectionJson: JSON.stringify({ decisions: [] }),
        scopeSectionJson: JSON.stringify({ inScope: ['Blog posts'], outOfScope: ['Mobile app', 'Paid subscriptions'] }),
      },
      assertions: [
        (output: z.infer<typeof OutputSchema>) => output.antiPatterns.length >= 2,
        (output: z.infer<typeof OutputSchema>) => output.antiPatterns.every((ap) => ap.rule.length > 0 && ap.rationale.length > 0),
      ],
    },
  ],
});

registerPrompt(antiPatternsPrompt);
