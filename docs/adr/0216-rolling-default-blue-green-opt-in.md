# ADR-0216: Rolling Default, Blue/Green Opt-In

**Status:** Accepted  
**Date:** 2026-05-07  
**Objective:** 29 (Deployment)

## Context

Two production deployment strategies exist: rolling (updates instances one at a time) and blue/green (parallel environment, atomic traffic switch). We must choose a default.

## Decision

**Rolling deploy is the default** for all environments. Blue/green is opt-in per environment via the deployment plan.

Rolling is sufficient for most generated applications (stateless APIs, React SPAs). Blue/green is recommended for production when zero-downtime is required and mixed-version states are unacceptable (e.g., real-time collaboration apps).

## Consequences

- Blue/green doubles resource usage during the deploy window; customers must opt in knowingly
- Rolling deploys have brief mixed-version windows; acceptable for stateless apps
- The deployment plan shows which strategy is in use per environment

## Alternatives Considered

- **Blue/green as default**: resource-inefficient; unnecessary for most generated apps; rejected
- **Canary deployments**: traffic-splitting infrastructure is heavyweight for v1; deferred
