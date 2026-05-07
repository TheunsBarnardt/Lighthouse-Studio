# ADR-0171: Staleness Detection on Intent Brief Changes

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 22 (Stage 2: PRD Generation)

---

## Context

Users sometimes update the intent brief after a PRD has been generated. Without a detection mechanism, the PRD silently becomes inconsistent with the intent that produced it.

## Decision

When the intent brief is updated, a **staleness-detection prompt** compares the original and updated intent briefs against the current PRD sections. It identifies which sections are affected by the changes and marks them as stale. The UI displays a staleness banner and offers "Regenerate affected sections" — which re-runs only the stale sections while leaving approved unaffected sections intact.

## Consequences

**Positive:**
- Approved work is preserved; only the sections actually affected by the intent change need re-review
- Users are not surprised by silent drift between intent and PRD
- Incremental updates feel proportional to the size of the intent change

**Negative:**
- Staleness detection is imprecise — a changed word in the title may flag more sections than strictly necessary
- Users must explicitly trigger the check; the system does not auto-detect on every save

**Neutral:**
- The detection prompt receives both the original and updated intent briefs; quality of detection depends on how clearly the change is expressed in those documents
