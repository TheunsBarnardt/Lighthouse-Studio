# ADR-0219: Health Checks Mandatory Post-Deploy

**Status:** Accepted  
**Date:** 2026-05-07  
**Objective:** 29 (Deployment)

## Context

After deploying, the platform must verify the application is actually working, not just that deployment steps completed without error.

## Decision

Health checks are mandatory after every deployment. The platform hits a minimum set of endpoints:
- `/api/health` — standard health endpoint (critical)
- `/` — UI root (critical)
- One representative server function endpoint (non-critical)
- DB connectivity check via the health endpoint response

Health check timeout: 60 seconds (configurable). Failure policy:
- Dev/staging: auto-rollback on health check failure
- Production: alert + require human decision (no auto-rollback)

## Consequences

- Generated applications must include a `/api/health` endpoint (co-generated in Stage 7)
- Health check configuration is part of the deployment plan
- Failed health checks are audited and visible in the monitoring UI

## Alternatives Considered

- **Optional health checks**: defeats post-deploy verification; rejected
- **Auto-rollback in production on failure**: too aggressive; metric spikes may be transient; rejected for prod
