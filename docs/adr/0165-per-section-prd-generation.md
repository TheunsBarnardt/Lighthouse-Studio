# ADR-0165: Per-Section PRD Generation, Not Whole-Document

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 22 (Stage 2: PRD Generation)

## Context

When generating a Product Requirements Document from an approved intent brief, the simplest approach is to run a single prompt that outputs a complete PRD in one pass. Modern language models have large context windows, and a PRD of 3,000–8,000 words is well within reach for a single inference call. This makes the implementation straightforward: one prompt template, one output schema, one validation step.

However, single-pass generation of long, structured documents produces systematically worse output than generating each section with a focused prompt. Quality degrades toward the end of long outputs as the model balances coherence across an increasingly large context. More practically: a PRD has 10 structurally distinct sections, each requiring different reasoning (narrative for Overview, measurable goals for Success Metrics, Gherkin-style criteria for Functional Requirements). A single prompt cannot optimize for all of them simultaneously.

Beyond generation quality, the review workflow matters. A PRD is reviewed by people with different expertise at different cadences: a business analyst might approve the User Stories section on day one while the architect reviews Non-Functional Requirements the following week. Whole-document approval forces a synchronization point that doesn't match how teams actually work. It also makes revision expensive: if one section needs rework, the user must regenerate everything or manually splice in changes.

## Decision

Each of the 10 locked PRD sections has its own dedicated prompt, test suite, and independent approval state. The PRD artifact is a composite that references its 10 section artifacts. Sections are generated in topological dependency order by an orchestrator prompt; sections without dependencies run in parallel.

The 10 sections and their dependency relationships are declared explicitly in `section-dependencies.ts`. The orchestrator drives generation; each section prompt receives only the intent brief slice and the outputs of its declared dependencies.

## Rationale

1. **Testability.** Each section prompt has a focused test suite with golden inputs and assertions. It is practical to assert that a functional-requirements prompt always produces Gherkin-style acceptance criteria; it is impractical to assert this about the twelfth paragraph of a monolithic output.

2. **Independent revision.** When the user rejects one section and provides feedback, only that section is regenerated. The other nine approved sections are untouched. This preserves reviewer work and reduces AI cost.

3. **Approval granularity.** Section-level approval routing (ADR-0167) requires sections to be independent artifacts with their own lifecycle states. A composite document cannot have per-section approval states.

4. **Generation quality.** Focused prompts produce better output per section. Each section prompt can include section-specific instructions (e.g., "every requirement must have a Given/When/Then criterion") that would dilute a monolithic prompt.

5. **Cost control.** A failed or low-quality section triggers regeneration of that section only, not the full PRD. Per-section cost is trackable and can have individual ceilings (see Objective 20 cost controls).

## Consequences

**Easier:**

- Prompt iteration targets a specific section without risk of regressing others
- Approval routing and lifecycle transitions operate at the natural granularity
- Quality signals (acceptance rate, revision count) are per-section, revealing which sections need the most prompt work
- Provider failover mid-generation is handled cleanly: a failed section retries independently

**Harder:**

- Full PRD generation takes longer (the dependency graph's critical path determines wall time, typically 2–4 minutes)
- Cross-section consistency must be verified separately (addressed by ADR-0170)
- The orchestrator logic for dependency ordering adds implementation complexity

**Alternatives considered:**

- **Single-prompt whole-document generation:** Simpler to implement; rejected because output quality degrades at length, revision requires full regeneration, and per-section approval states are incompatible with a single artifact.
- **Section streaming (one prompt, progressive output):** Theoretically preserves per-section granularity while reducing round trips; rejected because streaming structured JSON across section boundaries is fragile, and partial outputs cannot be independently validated or approved.
