# ADR-0183: Coverage Validation as Warning, Not Block

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 24 (Stage 4: Schema Synthesis)

## Context

After synthesis, a coverage validation step checks whether every entity in the PRD has a corresponding table. Coverage gaps (entities without tables) might indicate that the AI missed something important. The question is whether coverage gaps should block approval or be surfaced as warnings.

## Decision

Coverage validation results are **warnings, not blocks**. The user sees which PRD entities don't have corresponding tables, with the AI's reasoning for why they were omitted. The user decides whether to add the missing tables or accept the gap.

Gaps are always surfaced; they're never silently ignored. But they don't prevent submission for approval.

## Consequences

**Better:**
- PRDs often contain aspirational entities that aren't needed in the initial schema (e.g., "admin logs" in a v1 CRM)
- The user is best positioned to decide what schema is needed for the current sprint/phase
- Reducing blocking steps speeds up the review cycle

**Worse:**
- Missing tables could cause downstream failures (Stage 6 or 7 might expect tables that don't exist)
- Without a block, users may approve schemas with significant gaps without noticing

**Neutral:**
- The coverage report is shown prominently in the Schema Designer before approval; users can't miss it; they just aren't forced to resolve it

## Alternatives Considered

- **Block on coverage gaps** — rejected; too many legitimate PRDs have intentional v1 scope reductions; forcing full coverage creates toil
- **Block on high-confidence gaps** — considered; defining "high confidence" is ambiguous; warning-for-all is simpler and less error-prone
- **No coverage validation** — rejected; coverage gaps should at least be visible so users make an informed decision
