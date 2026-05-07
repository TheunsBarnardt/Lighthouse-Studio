# ADR-0247: Intent Brief Schema as Locked Contract

**Status:** Accepted
**Date:** 2026-05-06
**Objective:** 21 (Intent Capture)

---

## Context

The intent brief is the first structured artifact in the AI Build Pipeline. Every downstream stage (PRD, BRD, architecture) reads from it. If the brief schema changes without a migration strategy, downstream prompts break silently — they receive unexpected shapes and produce garbage outputs.

---

## Decision

`IntentBriefSchema` in `packages/core/src/services/ai/intent-capture/types.ts` is the locked contract. It is:

1. **Zod-defined** — the same schema validates AI generation output and service inputs/outputs.
2. **Versioned** — the schema's semantic version is embedded in every artifact's `generated_by` metadata.
3. **Breaking-change-protected** — removing or renaming a required field is a major version bump; adding optional fields is a minor bump. The `finalize-brief` prompt's `outputs` schema is pinned to the artifact schema version.
4. **Downstream-checked** — PRD generation prompts declare which brief schema version they accept; the pipeline refuses to run against an incompatible brief version.

The schema fields are: `title`, `summary`, `goals[]`, `targetUsers[]`, `successCriteria[]`, `constraints[]`, `assumptions[]`, `risks[]`, `inScope[]`, `outOfScope[]`, `references[]`, `estimatedScope`, `stakeHolders[]`.

---

## Consequences

**What becomes easier:**

- Downstream stages can depend on the brief structure without defensive null-checking.
- Schema drift is caught at the prompt test level (golden tests validate against the Zod schema) before it reaches production.

**What becomes harder:**

- Adding a new field to the brief requires updating: the Zod schema, the `finalize-brief` prompt, the `orchestrator` prompt's `briefUpdates` type, the `BriefPreviewPanel` UI, and the PRD prompt's input handling.
- Existing briefs stored under the old schema version will eventually need a migration script if a breaking change is made.

---

## Alternatives Considered

- **Loose schema (all fields optional):** Rejected — downstream prompts would produce inconsistent outputs depending on what's present; quality is unpredictable.
- **Free-form Markdown brief:** Rejected — not machine-readable; downstream stages would need to re-parse natural language.
- **Schema per workspace (customizable fields):** Deferred to a future version; the per-workspace field extension story requires careful versioning. The base schema is fixed; extensions are additive overlays.
