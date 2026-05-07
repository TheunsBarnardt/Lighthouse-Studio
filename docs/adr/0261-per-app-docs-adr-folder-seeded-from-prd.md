# ADR-0261: Per-App docs/adr/ Folder Seeded from PRD Section 8

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 22 (Stage 2: PRD Generation)

---

## Context

The PRD's "ADRs to Write" section (Section 8) emits a list of architectural decision records that the customer's app will need. We must decide how these stubs reach the generated application.

## Decision

Stage 7 (Code Generation) reads the PRD's ADRs-to-Write section and **scaffolds a `docs/adr/` folder** in the generated application repository. Each ADR stub from the PRD becomes a Markdown file in that folder with Status: Proposed, the context and rationale summary from the PRD, and a template body for the customer to complete.

Every generated app ships with this folder pre-populated. Downstream stages (Stage 8 for tests, Stage 9 for deployment) append their own ADRs as they make implementation choices.

## Consequences

**Positive:**
- Customer apps inherit the platform's architectural-decision discipline from day one
- The ADRs are not an afterthought — they begin at the PRD stage where the decisions are first made
- Downstream stages have a clear target for their own ADRs (next available number in the folder)

**Negative:**
- Stage 7 must read and process the PRD's ADRs-to-Write section, adding a dependency
- Stub ADRs with Status: Proposed may confuse teams if they are not completed after generation

**Neutral:**
- ADR numbering within generated apps is independent of this platform's numbering (starts at 0001)
