# ADR-0182: Diff-Based Proposals for Existing Schemas

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 24 (Stage 4: Schema Synthesis)

## Context

When a workspace already has a schema (the user is iterating on an existing project), synthesis could either:
1. Replace the existing schema entirely (start fresh from the PRD)
2. Propose additive changes only (new tables, new columns)
3. Propose both additive and destructive changes

## Decision

When an existing schema is present, synthesis operates in **diff mode**: it proposes additive changes only (new tables, new columns, new indexes, new foreign keys). Destructive changes (dropping tables, removing columns, changing types) are listed as informational but not executed automatically.

The diff is presented in the Schema Designer as a clearly labeled "proposed additions" section. The user accepts the additions, rejects them, or modifies them before committing.

## Consequences

**Better:**
- Existing work is never silently destroyed; the user's hand-authored schema decisions are respected
- The "additive by default" principle aligns with how the Schema Designer's migration flow works (destructive changes require explicit migration steps)
- Users feel safe running synthesis against existing schemas; it's always safe to run

**Worse:**
- The AI cannot suggest that a table should be renamed or a column type changed; these cases require the user to make the change manually
- The diff may miss cases where a new table should replace rather than complement an existing one

**Neutral:**
- Destructive changes (when needed) happen via the Schema Designer's standard edit → validate → migrate flow, not via AI suggestion

## Alternatives Considered

- **Replace mode** — rejected; destroys user work; any accidental run can wipe a carefully crafted schema
- **Propose destructive changes with confirmation** — considered; the Schema Designer's migration flow already handles this better; adding a "propose to drop this table" AI feature duplicates that functionality
