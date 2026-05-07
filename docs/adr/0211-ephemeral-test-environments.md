# ADR-0211: Integration and E2E Tests Run in Ephemeral Environments

**Status:** Accepted  
**Date:** 2026-05-07  
**Objective:** 28 (Test Generation)

## Context

Integration tests require a real database; e2e tests require a running application. We must decide how these environments are provisioned.

## Decision

Integration tests use an **ephemeral test database** provisioned per test run (schema-only, populated from factories). E2e tests require a **deployment URL** provided by the user — they run against an existing preview deployment (from Stage 9).

- Integration environment is torn down after the run completes
- Test database URL is injected as `TEST_DATABASE_URL` environment variable
- E2e tests do not provision infrastructure; they consume an existing deployment

## Consequences

- Users must trigger Stage 9 (Deployment) to get a preview URL before running e2e tests
- Integration tests are isolated from production data
- Each test run gets a clean database state (no shared state contamination)

## Alternatives Considered

- **Shared test database**: state contamination; hard to parallelise; rejected
- **Mocked databases for integration tests**: defeats the purpose; rejected
