# ADR-0171: Staleness Detection on Intent Changes

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 22 (Stage 2: PRD Generation)

## Context

A PRD is generated from an approved intent brief. After the PRD is generated — and possibly after some sections are reviewed and approved — the user may revise the intent brief. They may add a new goal, change the target user description, or remove a feature from scope. Any of these changes potentially makes parts of the PRD outdated.

The simplest response to an intent change is to invalidate the entire PRD: mark all sections as stale, require the user to regenerate everything. This is safe but costly: if the user approved 8 of 10 sections, all of that review work is discarded. For a minor intent change (e.g., rewording a goal description without changing its substance), full invalidation is disproportionate.

The opposite extreme is to do nothing: leave the PRD as-is and let the user manually identify what needs revisiting. This is maximally conservative but puts the burden entirely on the user, and in practice leads to PRDs that silently diverge from the intent they were generated from.

An intermediate approach is smart staleness detection: identify which PRD sections are affected by the specific intent fields that changed, mark only those sections as stale, and leave unaffected sections (and their approvals) intact.

## Decision

When an intent brief is modified, a `staleness-detection.prompt.ts` runs, comparing the changed intent fields to the section dependency declarations. Sections are marked stale if their generating prompts declared a dependency on the changed intent fields. Sections with no dependency on changed fields retain their approval state.

The staleness report (`StalenessReport`) identifies affected and unaffected sections explicitly. The user sees a `StalenessDialog` in the PRD UI listing which sections need review and offering "regenerate affected sections" as a one-click action. Non-affected approved sections do not require re-approval.

The staleness detection prompt uses the structured `tracesTo` references on requirements (ADR-0169) and the section dependency graph to determine which sections are downstream of the changed intent fields.

## Rationale

1. **Preserves approved work.** If a user approved 8 sections and the intent change affects only 2, requiring re-approval of all 10 discards significant reviewer effort. Incremental staleness detection preserves approvals for sections that are genuinely unaffected.

2. **Respects user time.** Re-reviewing a section that hasn't substantively changed is friction without benefit. Narrowing the re-review scope to actually affected sections makes the platform more usable for iterative projects where intent evolves.

3. **Structural basis for detection.** The section dependency graph and `tracesTo` references provide a structural basis for determining which sections depend on which intent fields. This makes detection tractable without requiring NLP inference over all section content.

4. **Explicit over silent.** Silently leaving the PRD unchanged after intent modifications leads to divergence that is discovered later (by downstream stages failing, or by confused reviewers). Explicit staleness indicators make the state of the PRD visible and actionable.

5. **Incremental, not all-or-nothing.** Incremental regeneration of affected sections is consistent with the per-section generation approach (ADR-0165). The same orchestrator infrastructure handles targeted regeneration.

## Consequences

**Easier:**

- Users can iterate on intent without starting the entire PRD review from scratch
- The platform can answer "what would change if I modify this intent field?" before the user commits to the change
- Incremental regeneration uses the same per-section infrastructure as full generation

**Harder:**

- The staleness detection prompt must accurately identify section dependencies; under-detection leads to silently stale sections; over-detection unnecessarily invalidates approved work
- The dependency graph must be maintained as the section prompts evolve; changes to what a prompt reads from the intent brief must be reflected in the dependency declarations
- Users must understand the "stale" indicator and its implications; UI clarity matters

**Alternatives considered:**

- **Full PRD invalidation on any intent change:** Maximally safe; rejected because it discards approved work disproportionately to small or unrelated intent changes.
- **No automatic staleness detection:** Leaves the burden on the user; rejected because silent divergence between intent and PRD is a correctness problem that undermines the platform's value proposition.
- **NLP-based impact analysis:** Use the AI to read all PRD content and identify what might be affected; rejected because the structural dependency graph provides more reliable and cheaper detection without requiring full-PRD inference on every intent change.
