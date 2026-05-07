# ADR-0214: Per-Environment Approval Gates

**Status:** Accepted  
**Date:** 2026-05-07  
**Objective:** 29 (Deployment)

## Context

The platform deploys through multiple environments (dev → staging → prod). We must decide how progression between environments is gated.

## Decision

Each environment has its own approval gate. Progression is explicit: a human (or automation configuration) must confirm promotion to the next environment. No auto-progression between environments by default (except dev, which can be configured for auto-deploy).

Default approvers:
- dev: automatic (no approval)
- staging: workspace_admin (any of)
- prod: architect + workspace_owner (all of)

All defaults are configurable per workspace.

## Consequences

- Production deployments always require explicit human approval
- The UI surfaces "Promote to staging" and "Promote to production" as distinct, deliberate actions
- Auto-deploy can be configured per environment for teams that want it

## Alternatives Considered

- **Auto-progression through all environments**: removes human oversight; rejected
- **Single approval for all environments**: insufficient; dev approval is meaningless for production confidence; rejected
