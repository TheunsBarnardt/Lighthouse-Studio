# ADR-0261: Per-App `docs/adr/` Folder Seeded From PRD Section 8

**Status:** Proposed
**Date:** 2026-05-07
**Deciders:** solo

## Context

ADR-0260 expands the PRD to a 13-section objective mirror, which includes Section 8 — "ADRs to Write". Without a destination for those ADR stubs, the section is decorative. The platform itself benefits enormously from `docs/adr/` as a forensic, auditable record of architectural decisions; the customer's generated app should inherit the same discipline.

A generated app today ships as a runnable repo (Objective 27 D1). It does not ship with an ADR folder, a CONTRIBUTING guide that references ADR discipline, or a copy of the PRD as `docs/PLAN.md`. New contributors to the generated repo (the customer's own engineering team) have no context for _why_ decisions were made — only _what_ the code does.

## Decision

Stage 7 (Code Generation, Objective 27) scaffolds the following into every generated app's repo:

1. **`docs/adr/0000-template.md`** — the same template the platform uses, copied verbatim.
2. **`docs/adr/000N-<slug>.md`** — one file per entry in PRD Section 8 ("ADRs to Write"), pre-filled with:
   - Title from the PRD entry
   - Status: `Proposed`
   - Context, Decision, Consequences sections seeded from the PRD's rationale stub
   - Date stamped with the generation date
   - Sequence numbers contiguous starting from 0001
3. **`docs/PLAN.md`** — markdown export of the approved PRD, all 13 sections, with anchors and a table of contents. Acts as a snapshot of the plan at generation time.
4. **`docs/CONTRIBUTING.md`** — references the ADR workflow:
   - "Create a new ADR before non-trivial architectural changes"
   - The next sequence number convention
   - Status lifecycle (Proposed → Accepted | Superseded by N | Deprecated)
   - Pointer to `0000-template.md`

The seeding is one-shot at app creation. Subsequent regenerations (Objective 30 maintenance) treat `docs/adr/` as customer-owned: the platform may _append_ new ADR stubs when PRD Section 8 grows, but never overwrites existing ADRs. Conflicts are surfaced through the same merge/conflict resolution flow as hand-edited code (Objective 30 D2).

## Consequences

### Positive

- The customer's app inherits the platform's ADR discipline by default. New contributors have a forensic trail.
- Section 8 of the PRD becomes load-bearing — it produces real artifacts, not decorative text.
- The customer can extend the ADR set by hand; subsequent platform regenerations respect their additions.
- `docs/PLAN.md` gives the customer's team a single document they can read end-to-end without opening the platform UI.

### Negative

- Generated repos grow in surface area. Mitigated by: documentation is small relative to code.
- Customers may not understand ADRs. Mitigated by: `CONTRIBUTING.md` is short and instructive; the template explains itself.
- ADR sequence numbers can collide if customer adds an ADR while a regeneration is in flight. Mitigated by: regeneration appends only and respects gaps; conflict resolution flow handles edge cases.

### Neutral

- The platform's own ADRs (this folder) and the customer's app ADRs are separate, parallel structures. No cross-references exist by default.

## Alternatives Considered

### Option A: No ADR folder; inline architectural notes in code comments

Pros: less documentation surface.
Cons: code comments rot; ADRs survive refactors. Code comments cannot capture the "why we rejected X" that ADRs do.

### Option B: ADR folder but no auto-seeding

Pros: less generation work.
Cons: empty folder is worse than no folder — invites ADR-less repos. The seed makes the discipline visible from day one.

### Option C: Shared ADR repo across all customer apps

Pros: one source of truth.
Cons: customer ADRs are app-specific, not platform-wide. Sharing them across customers leaks information and conflates concerns.

### Option D: Auto-update ADRs on every regeneration

Pros: ADRs stay in sync with PRD.
Cons: overwrites customer-authored ADRs. Treating the customer's work as authoritative once shipped is essential — same principle as Objective 30 D2 (round-trip durability).

## References

- ADR-0260 (PRD = 13-section objective mirror; provides Section 8 source)
- Objective 22 (Stage 2 — PRD Generation)
- Objective 27 (Stage 7 — Code Generation) — DoD item D9 implements this scaffolding
- Objective 30 (Maintenance) — D2 (round-trip durability) governs how regenerations interact with customer-edited ADRs
- `docs/adr/0000-template.md` — the source template
