# ADR-0217: Schema Migrations Coordinated with Code Deploys

**Status:** Accepted  
**Date:** 2026-05-07  
**Objective:** 29 (Deployment)

## Context

Database schema changes must be applied in coordination with application code deploys to avoid runtime errors.

## Decision

Schema migrations run **before** the code deploy in the deployment sequence. The platform:

1. Applies additive migrations (new columns, new tables) first — safe with old code still running
2. Applies destructive migrations (drop column, rename) with a warning and a required two-phase pattern
3. Rolls back schema on code deploy failure (for reversible migrations)
4. Alerts loudly when schema cannot be rolled back (irreversible operations)

For single-instance environments with brief downtime tolerance: schema and code deploy together within a maintenance window.

## Consequences

- Deployment sequence is always: schema → server → UI → health check
- Irreversible migrations are flagged in the plan for human review before deployment
- Partial rollback (code reverts, schema doesn't) is surfaced as a prominent warning

## Alternatives Considered

- **Post-deploy schema**: code deploys first; schema after — only works for additive changes; doesn't generalize; rejected
- **Separate migration stage**: decouples schema from deploys; creates drift risk; rejected
