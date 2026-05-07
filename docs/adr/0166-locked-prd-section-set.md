# ADR-0166: Locked PRD Section Set (13 Sections)

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 22 (Stage 2: PRD Generation)

---

## Context

The PRD must have a predictable structure so downstream stages (Schema, UI, Code) know exactly which sections to read and what to expect from each.

## Decision

The PRD has exactly **13 locked sections**: Purpose · Scope · Locked Decisions · Architectural Overview · The Hard Parts · Component Specifications · Implementation Order · ADRs to Write · Verification Steps · Definition of Done · Anti-Patterns · Open Questions · What Comes Next.

The section set mirrors the platform's own objective document structure (see ADR-0260).

## Consequences

**Positive:**
- Downstream stage prompts can reference specific sections by name with confidence
- Stage 8 (Test Generation) always finds Verification Steps; Stage 7 always finds Component Specifications
- The user-facing UI can render a fixed navigation panel without dynamic discovery

**Negative:**
- Adding a 14th section requires a versioned migration of all existing PRDs
- Some small projects may have sections with minimal content (e.g. Open Questions may be empty)

**Neutral:**
- Empty sections are valid — a section with no open questions is correct, not missing
