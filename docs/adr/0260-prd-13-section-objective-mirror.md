# ADR-0260: PRD Adopts the 13-Section Objective-Mirror Structure

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 22 (Stage 2: PRD Generation)

---

## Context

The platform specifies its own implementation using a consistent 13-section document format (Purpose, Scope, Locked Decisions, Architectural Overview, Hard Parts, Component Specifications, Implementation Order, ADRs to Write, Verification Steps, Definition of Done, Anti-Patterns, Open Questions, What Comes Next). We must decide whether customer PRDs should use this same structure or a more traditional requirements format.

## Decision

Customer PRDs use the **same 13-section structure the platform uses for its own objectives**. The sections are locked and identical to the platform's own internal format.

## Consequences

**Positive:**
- Customer apps inherit the same rigour and discipline the platform demands of itself
- Downstream stages have richer inputs: Locked Decisions, Architectural Overview, Component Specs, and Anti-Patterns give Stage 4, 6, and 7 far more to work with than traditional requirements documents
- The Definition of Done section becomes a cross-stage tracking surface rather than a closing checklist
- The Verification Steps section seeds Stage 8 (Test Generation) directly

**Negative:**
- The structure is opinionated — teams used to user-story-only formats must adapt
- Sections like "Locked Decisions" and "The Hard Parts" require more sophisticated AI generation than a simple functional requirements list

**Neutral:**
- Templates (CRM, blog, etc.) provide starter content for each section; the AI adjusts based on the actual intent
