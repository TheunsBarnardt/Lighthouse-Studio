# ADR-0190: Validation Failures Surface; User Decides on Rollback

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 25 — Stage 5: Data Migration

## Context

After migration, validation checks may reveal failures (FK violations, row count mismatches, truncation). Should the platform automatically roll back on validation failure, or surface the failure to the user and let them decide?

## Decision

Validation failures are surfaced to the user with details. The user decides whether to roll back (to snapshot) or accept the migration and address the failures manually. The platform does not auto-rollback.

## Consequences

- Users with intentional deviations (e.g., they know some FK references don't exist yet and will be added shortly) can accept and proceed.
- Accidental failures (truncation, massive row count mismatch) are visible and the user can roll back within the retention window.
- The platform is a decision-support tool, not an autonomous executor; this aligns with the broader design philosophy.
- Users who miss a validation failure and allow the window to expire cannot auto-rollback; they must follow the recovery runbook.

## Alternatives Considered

- **Auto-rollback on any failure**: too aggressive; some validation failures are acceptable in context.
- **No post-migration validation**: too risky; silent data corruption would be undetected.
