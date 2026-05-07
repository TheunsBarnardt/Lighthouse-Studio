# ADR-0257: Generation-Time SCA Gate

**Status:** Proposed
**Date:** 2026-05-07
**Deciders:** solo

## Context

Stage 7 (Objective 27) generates server code, including `package.json` files. Today, vulnerable dependencies in generated code are caught only at deploy time by the gate in ADR-0254. That is too late: by the time the user sees the scan result, they have already approved the generated code in the change-review UI. Catching it earlier closes the feedback loop and avoids wasted review cycles.

The platform's review UX is: "AI proposes a change → user reviews diff and approves → change merges into the project." Vulnerability findings should appear inside that review surface, not as a downstream surprise.

## Decision

Whenever Stage 7 emits or modifies a `package.json` (or otherwise alters the resolved lockfile), the orchestrator:

1. Resolves the lockfile (`pnpm-lock.yaml` for generated projects).
2. Calls `VulnerabilityScannerPort` against the resolved lockfile.
3. Renders findings **inline in the change-preview UI** alongside the diff.

Policy at this stage is advisory-with-friction, not blocking:

- `critical` findings: change cannot be approved until the user explicitly acknowledges each finding via a per-finding checkbox. The acknowledgement is audited.
- `high` findings: same explicit acknowledgement required.
- `medium`/`low` findings: surfaced in the review UI; no gate.

The gate operates on the **resolved lockfile**, not the unresolved ranges in `package.json`, so the same input produces the same finding set across regenerations.

The deploy-time gate (ADR-0254) remains in place — generation-time and deploy-time gates are complementary, not redundant. Generation-time catches issues during AI iteration; deploy-time catches issues introduced by upstream advisories that arrived between generation and deploy.

## Consequences

### Positive

- Vulnerabilities surface in the smallest blast radius (one change, one user) instead of at deploy time when more context has accumulated.
- The user's mental model is simpler: "if my change preview is clean of red findings, my deploy will not be blocked on supply-chain grounds."
- AI iterations on `package.json` get fast feedback. The AI can propose alternative dependencies in the same review cycle.

### Negative

- Adds latency to the change-review flow (target < 30s for a typical lockfile). Mitigated by caching scan results keyed by lockfile hash.
- Friction during iteration if a popular dependency has a `high` finding that the user is willing to accept. The acknowledgement UX must be smooth — checkbox-and-note, not a multi-step approval.

### Neutral

- The same scanner (Grype, ADR-0254) is invoked. No new tool to maintain.

## Alternatives Considered

### Option A: Deploy-time gate only

Pros: simpler.
Cons: see Context. Late feedback; users approve code they will then have to re-review.

### Option B: Block on `high` and `critical` at generation time

Pros: stricter.
Cons: degrades AI iteration loop. A single transitive `high` could halt generation entirely with no per-workspace flexibility. Acknowledgement-with-audit is a better balance for an iteration surface.

### Option C: Run scan continuously in the background

Pros: no synchronous wait.
Cons: findings appear after the user has approved the change, defeating the purpose.

## References

- ADR-0254 (deploy-time gate; same scanner)
- ADR-0253 (advisory source)
- Objective 27 (Stage 7 — Code Generation) — DoD includes generation-time SCA gate
