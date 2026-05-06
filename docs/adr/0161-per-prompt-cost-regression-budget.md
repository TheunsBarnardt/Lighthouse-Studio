# ADR-0161: Per-Prompt Cost-Regression Budget

**Status:** Accepted
**Date:** 2026-05-06
**Objective:** 20 (AI Pipeline Foundation)

## Context

Prompt changes are code changes. Like any code change, they can introduce regressions. In the AI context, one of the most common and expensive regressions is token bloat: a rephrased system prompt, a more verbose instruction, or an added reasoning requirement silently doubles the token count per call, which doubles the per-call cost and doubles the latency.

Without an automated check, token bloat goes undetected until it appears in the monthly cost report. By then, thousands of pipeline runs have paid the inflated cost and the change may be deeply integrated into dependent prompts. A CI check that enforces token budget compliance at merge time prevents this class of regression.

## Decision

Every prompt declared with `definePrompt` includes a `tokenBudget` field:

```typescript
tokenBudget: {
  inputTokens: 4000,    // expected max input tokens for a typical golden input
  outputTokens: 8000,   // expected max output tokens for a typical response
}
```

CI runs a cost regression check on every PR that modifies a file in `packages/core/src/ai/prompts/`. The check:

1. Renders the prompt against each golden input fixture using `countTokens` on the configured provider
2. Computes the average actual input token count across golden inputs
3. Compares the average to both the declared `tokenBudget.inputTokens` and the previous prompt version's measured average (stored in `prompt_token_baselines` in the CI artifact store)
4. Fails the build if the average input token count exceeds either:
   - The declared `tokenBudget.inputTokens`, or
   - Previous version average × 1.20 (a 20% increase vs. the previous version)
5. The tighter of the two thresholds applies

Output token regression is harder to enforce (it depends on the model's generation choices, not just the prompt text). Output token checks are advisory rather than blocking: a warning is posted on the PR if average output tokens exceed `tokenBudget.outputTokens` × 1.20, but the build does not fail.

Overriding a failing token budget check requires two steps: update `tokenBudget.inputTokens` to the new expected value, and add a comment in the PR body explaining why the token increase is justified. The CI check verifies that the declared budget matches the measured average before passing (it cannot be bypassed by simply increasing the budget without a matching measured reality).

## Consequences

**Easier:**

- Token bloat regressions are caught at PR time, before they affect any production pipeline runs
- The `tokenBudget` declaration is living documentation of a prompt's expected cost characteristics; reviewers can reason about cost impact alongside correctness
- Prompt authors receive immediate feedback when a wording change causes unexpected token expansion, prompting them to tighten the prompt
- The 20% headroom prevents legitimate prompt improvements from failing on marginal increases; only significant growth is flagged

**Harder:**

- Golden input fixtures must be representative of real-world inputs; if golden inputs are toy examples that are shorter than typical production inputs, the check will pass for prompts that are actually over-budget in production
- The `prompt_token_baselines` store must be maintained across prompt versions; if the store is lost or corrupted, the previous-version comparison falls back to declared-budget comparison only, which is still useful but less sensitive
- `countTokens` calls in CI have a cost; for providers without a free `countTokens` API (e.g., some Ollama models), a local token counting approximation is used, which may differ slightly from the provider's actual count

**Alternatives Considered:**

- **No CI token check; rely on ADR-0157 workspace budgets to catch bloat:** Workspace budgets catch total spend but not per-prompt regressions; a prompt that doubles in cost is invisible until it shows up as elevated workspace spend; by then many runs have been affected; rejected as too late
- **Hard cap at declared budget only (no comparison to previous version):** Simpler; rejected — the previous-version comparison catches regressions even when the declared budget was set conservatively and has room; a prompt that goes from 1000 to 1900 tokens (still under a 2000 declared budget) represents a real regression that the declared-budget-only check would miss
- **Token budget as advisory only (no CI failure):** Post warnings rather than failing the build; rejected — advisory warnings are routinely ignored under deadline pressure; the only effective gate is a failing build that requires an explicit override
