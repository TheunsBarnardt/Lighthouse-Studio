# ADR-0012: Conformance Testing Strategy

**Status:** Accepted
**Date:** 2026-05-02
**Deciders:** solo (Theuns Barnardt)

## Context

The platform supports three databases and many other pluggable adapters. Without a shared test suite, each adapter is tested independently and "dialect drift" occurs silently: the PostgreSQL adapter handles edge cases that the MSSQL adapter does not, or the in-memory adapter diverges from production adapters, breaking tests that pass in development but fail in production.

## Decision

Every port exports a parameterized conformance test suite from `src/conformance/*.ts`. The suite is a function (not a test file) that accepts an adapter factory and runs a standard set of tests against it:

```typescript
// packages/ports/persistence/src/conformance/repository.ts
export function runRepositoryConformance<T extends { id: string }>(
  name: string,
  factory: () => RepositoryPort<T>,
  fixture: () => T,
): void {
  describe(`${name}: RepositoryPort conformance`, () => {
    it('findById returns null for unknown id', ...);
    it('create then findById returns the entity', ...);
    // 10+ tests minimum per major port
  });
}
```

Adapter test files import and call the suite:

```typescript
// packages/adapters/persistence-postgres/tests/repository.spec.ts
import { runRepositoryConformance } from '@platform/ports-persistence/conformance';
import { InMemoryRepository } from '../src/repository.adapter.js';

runRepositoryConformance(
  'InMemoryRepository',
  () => new InMemoryRepository(),
  () => ({ id: crypto.randomUUID() }),
);
```

Conformance test files in port packages use the `.ts` extension (not `.spec.ts`) so they compile into the package dist and are importable by adapters.

## Consequences

### Positive

- A new adapter automatically inherits the full correctness specification.
- A bug fix to the conformance suite immediately exposes the same bug in all adapters simultaneously.
- The in-memory adapter and production adapters are tested against an identical contract.
- CI can add a new database adapter to the matrix by running the same suite.

### Negative

- Writing a good conformance suite takes significant upfront effort.
- Conformance tests run against every adapter in CI — matrix expands as adapters are added.
- Tests that require database-specific setup (migrations, index creation) cannot be fully shared and need adapter-specific test helpers.

## Alternatives Considered

- **Per-adapter independent tests**: each adapter writes its own tests. Rejected because dialect drift is inevitable and undetected.
- **Shared test file imported via TypeScript path aliases**: fragile, requires careful tsconfig management. Rejected in favour of explicit package exports.
