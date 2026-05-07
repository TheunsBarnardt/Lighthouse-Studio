# ADR-0218: Rollback as First-Class Action

**Status:** Accepted  
**Date:** 2026-05-07  
**Objective:** 29 (Deployment)

## Context

When a production deployment causes issues, operators need a reliable way to revert quickly.

## Decision

Rollback is a single-action operation available from the deployment monitor UI. The platform retains prior deployment artifacts for 7 days (configurable up to 30 days). Rollback reverts: UI bundle, server functions, and schema migrations (where reversible). Health check runs after rollback.

For irreversible schema migrations, rollback is partial: code reverts, schema does not. The platform displays a prominent warning and records it in the audit log.

## Consequences

- Storage for artifact retention (bounded; 7 days)
- Operators must understand that partial rollback leaves the database in the new schema state
- Rollback of rollback is possible (re-deploy a specific version)

## Alternatives Considered

- **No rollback (redeploy old version manually)**: too slow for production incidents; rejected
- **Automated rollback on metric breaches**: auto-rollback in prod is risky (metric spike may be transient); humans decide; deferred
