# ADR-0080: Observable Wrapper as Mechanical Discipline

**Status:** Accepted
**Date:** 2026-05-02
**Objective:** 08-service-layer-architecture

---

## Context

Observability (spans, structured logs, metrics) on every service call is
required for production operations: diagnosing latency regressions, alerting on
error rates, tracing distributed request paths. If observability is left to
individual method authors, it gets inconsistently applied: some methods have it,
others don't, and the gaps are discovered when an incident occurs and there's no
trace.

---

## Decision

Service methods are wrapped with the `observable()` higher-order function
(defined in `packages/core/src/observability/observable.ts`). The wrapper:

1. Starts a trace span named `ServiceName.methodName`.
2. Logs `debug` on entry with `correlationId`.
3. Awaits the wrapped method.
4. Records `platform_service_method_duration_ms` histogram with `{ service, method, outcome }` labels.
5. Logs `debug` on success, `info` for expected errors (VALIDATION, FORBIDDEN),
   `error` for unexpected errors, `fatal` for stray throws.
6. Ends the span.

The wrapper is applied at the factory/composition level, not inside method
bodies. Method bodies remain readable: pure business logic.

ECMAScript decorators (the new TC39 proposal) are not yet stable across all
tools in the stack; we use the higher-order wrapper for now and will revisit
decorators when they stabilise.

---

## Consequences

**What becomes easier:**

- Every service call is automatically instrumented. Adding a new method
  automatically gets observability if the factory applies the wrapper.
- Stray throws from service methods are always logged at `fatal` before
  propagating — no silent failures.

**What becomes harder:**

- The `ObservabilityDeps` type (logger, optional metrics, optional tracer) must
  be threaded through the composition root. This is a one-time setup per service.
- The wrapper introduces a thin async overhead per call. This is negligible
  compared to database I/O and is not worth optimising.

**Alternatives considered:**

- _Manual instrumentation in each method_ — rejected; inconsistently applied.
- _TypeScript decorators (`experimentalDecorators`)_ — rejected; emit behaviour
  differs between decorator versions; the TC39 proposal is not yet stable in
  all tools we use.
- _Proxy-based auto-instrumentation_ — rejected; hides the wrapping, makes
  debugging harder, and requires runtime Proxy support.
