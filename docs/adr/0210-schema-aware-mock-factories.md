# ADR-0210: Generate Schema-Aware Mock Factories for Test Data

**Status:** Accepted  
**Date:** 2026-05-07  
**Objective:** 28 (Test Generation)

## Context

Integration and unit tests require realistic test data. Without a structured approach, each test invents its own fixtures, leading to inconsistency and maintenance burden when the schema changes.

## Decision

Generate a **mock factory file** (`src/__tests__/factories.ts`) alongside the test suite that provides typed factory functions for every entity in the database schema.

- Each factory accepts `Partial<Entity>` overrides
- Uses `@faker-js/faker` with a seeded instance for reproducible values
- Co-generated with the test suite; regenerated when the schema changes
- Relationship helpers are included for common associations

## Consequences

- All generated tests import from `./factories` rather than inlining fixtures
- Schema changes trigger a mock factory regeneration notification
- Faker seed is set per-test-run for reproducibility

## Alternatives Considered

- **Manual fixtures per test**: leads to drift; rejected
- **Database seeding only**: integration tests only, excludes unit tests; rejected
