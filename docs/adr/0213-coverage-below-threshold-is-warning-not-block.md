# ADR-0213: Coverage Below Threshold Is a Warning, Not a Deployment Blocker

**Status:** Accepted  
**Date:** 2026-05-07  
**Objective:** 28 (Test Generation)

## Context

When generated tests produce coverage below thresholds (80% lines, 70% branches), we must decide how to treat this: hard failure (block deployment) or warning (visible but non-blocking).

## Decision

Coverage below threshold is a **warning**. It is surfaced prominently in the UI and written to the audit log as `COVERAGE_BELOW_THRESHOLD`, but it does not prevent the user from approving the suite or proceeding to deployment.

Rationale: generated projects in early stages may have legitimately unreachable code paths (dead scaffolding, future extension points). Blocking deployment on AI-generated coverage would create a frustrating loop where the user cannot proceed until the AI produces better tests — a problem the user cannot directly fix.

## Consequences

- Users see a prominent warning banner when coverage is below threshold
- The audit event is written for tracking purposes
- Threshold values are configurable per suite (default: 80% lines, 70% branches)
- Post-approval, coverage trends are tracked as quality signals

## Alternatives Considered

- **Hard block**: correct engineering discipline but impractical for AI-generated code; rejected for v1
- **No thresholds**: removes useful signal entirely; rejected
