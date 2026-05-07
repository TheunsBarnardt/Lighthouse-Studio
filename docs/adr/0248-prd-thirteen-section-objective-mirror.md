# ADR-0248: PRD Adopts the 13-Section Objective-Mirror Structure

**Status:** Proposed
**Date:** 2026-05-07
**Deciders:** solo

## Context

Stage 2 (Objective 22) emits a PRD with 10 sections: Overview, Goals & Success Metrics, Target Users & Personas, User Stories, Functional Requirements, Non-Functional Requirements, Constraints & Assumptions, Out of Scope, Open Questions, Risks & Mitigations.

The platform's own engineering work follows a 13-section objective document structure: Purpose, Scope, **Locked Decisions**, **Architectural Overview**, **The Hard Parts**, **Component Specifications**, **Implementation Order**, **ADRs to Write**, **Verification Steps**, **Definition of Done**, **Anti-Patterns to Refuse**, Open Questions, What Comes Next. The platform uses this rigor on itself because it is the rigor a buildable specification requires.

The asymmetry is the problem: the platform asks a level of rigor of its own work that it does not produce for the customer's app. Downstream stages (Schema, Design, UI, Code, Tests, Deploy) inherit whatever rigor lives in the PRD. A PRD with no Locked Decisions table forces downstream prompts to relitigate decisions every run; a PRD with no Architectural Overview means UI generation has no map; a PRD with no Anti-Patterns means downstream prompts can hallucinate features the user explicitly refused.

## Decision

The PRD schema is expanded from 10 sections to a **13-section mirror** of the platform's own objective document structure:

1. Purpose
2. Scope (in / out)
3. Locked Decisions — Decision · Choice · Rationale table
4. Architectural Overview — data-flow diagram + narrative
5. The Hard Parts — non-trivial design decisions called out
6. Component Specifications — typed contracts, interfaces, data models
7. Implementation Order — numbered build sequence with dependencies
8. ADRs to Write — titled stubs with rationale (seeds the per-app `docs/adr/` per ADR-0249)
9. Verification Steps — numbered, end-to-end testable checks (seeds Stage 8 tests)
10. Definition of Done — categorized checkbox list (sliced by downstream stages 4–9)
11. Anti-Patterns to Refuse — explicit "we don't do X" rules (negative constraints for downstream prompts)
12. Open Questions
13. What Comes Next

The customer-facing user stories, functional requirements, non-functional requirements, constraints, and risks remain — they live within Sections 2 (Scope), 3 (Locked Decisions), 5 (Hard Parts), and 6 (Component Specifications) where appropriate. No information is lost; the structure is reorganized to mirror the platform's own discipline.

## Consequences

### Positive

- **The customer's app gets a buildable specification, not just a list of requirements.** Downstream stages have explicit Locked Decisions to honor, an Architectural Overview to orient against, and Anti-Patterns to refuse.
- **Cross-stage consumption becomes structural.** Stage 8 reads Verification Steps as test seeds. Stage 7 reads Component Specs as scaffolding. Stage 9 reads Implementation Order. The PRD is a contract, not a wishlist.
- **Symmetry of rigor.** "We hold our own work to this standard" stops being a dual standard. The customer's app inherits the same rigor.
- **ADR scaffolding (ADR-0249) becomes natural.** Section 8 is the seed; the per-app `docs/adr/` folder is its destination.

### Negative

- **PRD generation is more expensive.** 13 section prompts vs. 10. The cost-per-PRD target rises to ~$2.00–$8.00 (vs. the prior $1.00–$5.00). Mitigated by: the rigor sections are cheaper-per-token than narrative sections (more structural, less generative).
- **Section dependencies grow.** Component Specs depend on Architectural Overview. Verification Steps depend on Component Specs. The orchestrator's section-dependency graph must be richer.
- **Customers used to a leaner PRD format will see more upfront artifact.** Mitigated by: the structured viewer surfaces sections in tabs; users skim what they want.

### Neutral

- The locked section enum is updated; downstream stage prompts that reference specific sections by name continue to work; new sections are additive.

## Alternatives Considered

### Option A: Keep the 10-section PRD; add ADR-0249-style scaffolding only

Pros: smaller change.
Cons: fails to address the structural deficit. ADR scaffolding without an ADR-listing section in the PRD has nothing to seed from.

### Option B: 5-section "core upgrade" (Locked Decisions, Architectural Overview, Verification, DoD, Anti-Patterns only)

Pros: 50% less generation cost; covers the most-leveraged gaps.
Cons: leaves Component Specifications, Hard Parts, Implementation Order, ADRs to Write out — which are exactly the inputs Stage 7 and Stage 4 most need. Half-measures undercut the goal.

### Option C: Make the 13-section structure optional per workspace

Pros: flexibility.
Cons: optionality complicates downstream consumption (every prompt needs a fallback path). The platform's posture is opinionated rigor; configurable rigor weakens it.

### Option D: Author a separate "Plan" artifact alongside the PRD

Pros: keeps the PRD lean; introduces a separate richer artifact.
Cons: two artifacts to keep in sync; two approval workflows; no clear rule for which artifact wins on conflict. One artifact, richer structure, is simpler.

## References

- Objective 22 (Stage 2 — PRD Generation) — Locked Decisions and DoD
- ADR-0249 (per-app `docs/adr/` folder; seeded from PRD Section 8)
- Objective 27 (Stage 7 — Code Generation) — D9 emits the per-app plan scaffolding
- Objective 28 (Stage 8 — Test Generation) — consumes Verification Steps
- The platform's own objective documents — the structure being mirrored
