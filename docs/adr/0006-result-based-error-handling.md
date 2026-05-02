# ADR-0006: Result-Based Error Handling

**Status:** Accepted
**Date:** 2026-05-02
**Deciders:** solo (Theuns Barnardt)

## Context

Across port boundaries — between the domain and adapters — errors must be explicit, typed, and impossible to accidentally ignore. JavaScript's default exception model (`throw`/`try-catch`) is untyped: a function's signature gives no hint of what it might throw, and callers can omit the `catch` silently.

## Decision

All fallible operations at port boundaries return `Promise<Result<T, E>>` using the `neverthrow` library. Errors are values in the `Err` variant; success is a value in the `Ok` variant.

```typescript
// Correct: error is a typed value, caller must handle it
const result = await repo.findById(id);
if (result.isErr()) return err(result.error); // propagate
const user = result.value; // use safely

// Forbidden: never throw across a port boundary
throw new Error('not found');
```

Each port defines its own typed error union (e.g., `PersistenceError | EntityNotFoundError | ConflictError`). Adapters catch driver exceptions internally and translate them to typed port errors.

The public SDK (if it ever exists) uses native Promises per JavaScript convention. The `Result` discipline is internal only.

## Consequences

### Positive

- TypeScript enforces that callers handle errors; unhandled error paths are compile errors.
- Error types are explicit in function signatures — callers know exactly what can go wrong.
- No unchecked exceptions escaping to top-level crash handlers.
- `neverthrow` provides chainable operators (`map`, `andThen`, `mapErr`) that compose cleanly.

### Negative

- More verbose than `throw`; every call site must unwrap or propagate.
- Developers unfamiliar with `Result` types have a learning curve.
- `neverthrow` is a runtime dependency; it must be kept updated.

## Alternatives Considered

- **Native exceptions throughout**: idiomatic JavaScript but untyped error contracts. Rejected.
- **Discriminated union return types without neverthrow**: `{ ok: true; value: T } | { ok: false; error: E }`. Rejected because `neverthrow` already provides this plus chainable operators, and reinventing it adds maintenance burden.
- **Checked exceptions (Java-style via type annotations)**: TypeScript does not support checked exceptions natively. `Result` achieves the same effect at the type level.
