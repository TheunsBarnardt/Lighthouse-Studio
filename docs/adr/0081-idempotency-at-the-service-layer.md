# ADR-0081: Idempotency at the Service Layer

**Status:** Accepted
**Date:** 2026-05-02
**Objective:** 08-service-layer-architecture

---

## Context

Operations with side effects — sending email, deploying code, charging payment,
creating records — must be safe to retry. Without idempotency, a network timeout
between the platform and a client can cause the operation to execute twice: once
when the original request partially succeeded, and again when the client retries.

HTTP-level idempotency (PUT, DELETE semantics) is not sufficient for complex
multi-step operations. Service-level idempotency is needed.

---

## Decision

Mutating service methods support an optional `idempotencyKey` carried in the
`RequestContext`. When provided, the `withIdempotency` helper (in
`packages/core/src/idempotency/`) deduplicates the operation:

1. Hash the `(operation, idempotencyKey)` pair with SHA-256.
2. Query the `idempotency_records` table for a matching, non-expired record.
3. If found: deserialise and return the cached result without re-executing.
4. If not found: execute, persist the result, then return.

**Table:** `idempotency_records` (workspace-scoped, has TTL via `expiresAt`)
**Default window:** 24 hours — overridable per operation
**Retention:** the nightly retention job purges expired records

Only successful results are cached. Failed results are not cached — the caller
retries, and the operation re-executes.

The `idempotencyKey` is client-supplied (passed in `RequestContext`). Clients
should use UUID v4 or similar per-operation unique values.

---

## Consequences

**What becomes easier:**

- API clients can safely retry any operation without fear of double-execution.
- Webhook delivery, job scheduling, and async workflows become reliable.
- The idempotency mechanism is universal — it applies to any service method.

**What becomes harder:**

- Service results must be JSON-serialisable (Dates and primitives — fine;
  Buffers and class instances — need explicit handling at the call site).
- The `idempotency_records` table adds a write to every deduplicated operation.
  This is small (one INSERT) relative to the protected operation's cost.

**Alternatives considered:**

- _HTTP-level Idempotency-Key header only_ — rejected; does not protect against
  server-side retries within the same request.
- _Redis / in-memory cache_ — rejected; not available in all deployment
  topologies; the database is the only stateful store we can guarantee.
- _24-hour default window_ — confirmed appropriate for most operations. Auth
  operations (5-minute window) and deployments (7-day window) override this
  per-call.
