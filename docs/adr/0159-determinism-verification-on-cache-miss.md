# ADR-0159: Determinism Verification on Cache Miss

**Status:** Accepted
**Date:** 2026-05-06
**Objective:** 20 (AI Pipeline Foundation)

## Context

Prompts authored with `temperature: 0` are intended to be deterministic: given the same input, they should produce the same output every time. Determinism is assumed by the caching strategy (ADR-0155), relied upon in the CI cost regression check (ADR-0161), and expected by developers who re-run a stage expecting stable results.

In practice, determinism at `temperature: 0` is not guaranteed by providers. Some models exhibit non-determinism at low temperatures due to floating-point non-associativity across hardware, sampling residuals, or provider-side infrastructure changes. If a prompt is assumed to be deterministic but is not, the cache may return one variant while a fresh call returns another — silently diverging behavior that is difficult to detect.

A structured verification job is needed to detect non-determinism before it causes production issues.

## Decision

For every prompt declared with `temperature: 0`, a nightly CI job runs a determinism verification suite. The job:

1. Selects the golden input fixtures for the prompt from `packages/core/src/ai/prompts/<stage>/__tests__/golden/`
2. Runs the prompt N=5 times against the live provider, bypassing the cache (`bypassCache: true`) each time
3. Compares the structural output across all 5 runs — specifically: output schema field presence, top-level section keys, and any fields declared as `deterministicFields` in `definePrompt`
4. If structural variance exceeds the prompt's declared `varianceTolerance` (default: 0), the job fails

`varianceTolerance` can be set to `'low'` (minor wording differences allowed, structure must match) or `'none'` (strict equality on `deterministicFields`). Prompts that are inherently non-deterministic (generating creative content) should not use `temperature: 0`; if they do, they should declare `varianceTolerance: 'low'` explicitly.

Failures in the nightly determinism job are treated as P1 issues: the prompt version is flagged in the dashboard, a GitHub issue is opened automatically, and the CI status badge reflects the failure.

## Consequences

**Easier:**

- Non-determinism is caught systematically before it manifests as a user-visible inconsistency (cache returns one thing, fresh call returns another)
- The nightly job provides ongoing evidence that the caching assumption holds for each prompt version, across provider model updates
- Prompts that legitimately have some variance can declare `varianceTolerance: 'low'` with an explicit acknowledgment, making the tolerance decision visible and reviewable

**Harder:**

- The nightly job runs N=5 live provider calls per `temperature: 0` prompt; at scale (many prompts) this has non-trivial cost; the job must be scoped to golden inputs only (not full data sets) and budgeted under a dedicated CI provider key
- Provider-side model updates can silently change determinism behavior between nightly runs; the job catches this but only after one night of exposure
- The `deterministicFields` declaration adds maintenance burden: prompt authors must remember to update the field list when the output schema changes

**Alternatives Considered:**

- **No determinism verification; trust temperature: 0:** Simpler; rejected — temperature=0 is not a hard guarantee; providers have documented cases of non-determinism at temperature=0; trusting it without verification creates silent caching inconsistencies
- **Determinism check on every CI run (not nightly):** Run N=5 on every PR that changes a prompt; rejected — too slow for PR feedback loops; a prompt change CI run that waits for 5 live provider calls per prompt would significantly increase PR turnaround time; nightly cadence is the right balance
- **Determinism verification using mocked provider responses:** Use a mock provider that always returns the same thing; rejected — this does not test the actual provider's behavior; the concern is provider-side non-determinism, which can only be verified against the real provider
