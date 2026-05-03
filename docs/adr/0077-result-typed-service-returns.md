# ADR-0077: Result-Typed Service Returns

**Status:** Accepted
**Date:** 2026-05-02
**Objective:** 08-service-layer-architecture

---

## Context

Service methods can fail for many expected reasons: invalid input, missing
records, authorization denial, version conflicts. These are not exceptional
conditions — they are expected paths that callers must handle.

Using thrown exceptions for expected failures creates two problems:

1. The type system cannot enforce that callers handle failures (try-catch is
   opt-in; returning a typed value is not).
2. Exception handling is by convention — stack unwinds, mid-operation state
   may be inconsistent, and the caller cannot easily inspect the error type.

---

## Decision

All service methods return `Promise<Result<T, AppError>>` from the `neverthrow`
library. Methods **never throw** for expected error conditions. Throws are
reserved for programmer errors (invariant violations) and genuinely
unrecoverable conditions.

Unexpected throws from deep helpers are caught at the service-method boundary
and wrapped in `InternalError`:

```typescript
try {
  return ok(await riskyOp());
} catch (e) {
  return err(new InternalError('riskyOp failed', { cause: e }));
}
```

The `observable()` wrapper also catches stray throws as a safety net and logs
them at `fatal` before re-throwing.

The public SDK (`packages/sdk/`) uses native Promises that reject — the
Result → Promise conversion happens at the SDK boundary, not inside services.

---

## Consequences

**What becomes easier:**

- Callers can exhaustively handle error cases with `.isOk()` / `.isErr()`.
- TypeScript enforces that error paths are acknowledged.
- Test assertions are simple: `expect(result._unsafeUnwrapErr().code).toBe('VALIDATION')`.

**What becomes harder:**

- Code that integrates with libraries that throw (pg, mongodb drivers) needs
  explicit wrapping — a one-liner (`return err(new PersistenceError(..., e))`),
  but still a required step.
- Developers unfamiliar with Result types need a brief orientation.

**Alternatives considered:**

- _Throw typed errors_ — rejected; callers can ignore uncaught exceptions.
- _Return discriminated unions manually_ — rejected; `neverthrow` provides the
  same semantics with better ergonomics.
