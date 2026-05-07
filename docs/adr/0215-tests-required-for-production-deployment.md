# ADR-0215: Tests Required for Production Deployment

**Status:** Accepted  
**Date:** 2026-05-07  
**Objective:** 29 (Deployment)

## Context

Stage 8 generates test suites. We must decide whether test execution is mandatory before deploying to staging/production.

## Decision

Tests are required for staging and production deployments. Test failure blocks promotion. Tests are optional (but recommended) for dev.

The platform runs the Stage 8 test suite against the target environment's setup before promoting. This is configurable per environment: can be disabled per workspace with an explicit acknowledgment.

## Consequences

- Customers cannot ship untested code to production by default
- Test infrastructure must be provisioned as part of the deployment pipeline
- Slow test suites add deployment latency; the platform surfaces test duration in quality signals

## Alternatives Considered

- **Tests always optional**: defeats the purpose of Stage 8; rejected
- **Tests required for prod only**: staging is a final verification gate; skipping tests there misses bugs before they hit prod; rejected
