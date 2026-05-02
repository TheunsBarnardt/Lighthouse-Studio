# ADR-0023: Pino as the Logger Library

**Status:** Accepted
**Date:** 2026-05-02
**Deciders:** solo

## Context

The platform needs a structured logger for Node.js. Structured logging (JSON output) is required so the OTel Collector can parse log fields without regex heuristics. The logger must be fast enough that logging in hot paths doesn't measurably affect latency; must support child loggers (bound context); must redact sensitive fields; and must support pretty-printing for local development.

The three main contenders are Pino, Winston, and Bunyan.

## Decision

Use **Pino** as the logger library.

The `PinoLogger` adapter in `packages/adapters/observability-logger` wraps Pino behind the `LoggerPort` interface. The platform's service code uses only the port; Pino is an implementation detail.

Key Pino configuration choices:

- JSON to stdout (Docker captures it; the OTel Collector reads from there)
- `pino.transport()` for async log writing (non-blocking)
- `pino.stdSerializers.err` for error serialization (captures `message`, `stack`, `code`, `cause`)
- `redact` option for PII keys (hardware-enforced; not runtime-configurable)
- `pino-pretty` for development with `LOG_PRETTY=true`
- Auto-injection of `traceId`, `spanId`, `correlationId` via OTel context (future enhancement via `pino-opentelemetry-transport`)

## Consequences

### Positive

- Pino is ~5x faster than Winston in benchmarks; negligible logging overhead.
- JSON-native: no serialization step, just JSON.stringify.
- `child()` loggers are zero-cost (context is merged at write time, not at construction).
- Pino's `redact` is path-based and applied before any output; it cannot be bypassed by callers.
- Ecosystem: `pino-pretty`, `pino-opentelemetry-transport`, `pino-http` are all maintained.

### Negative

- Pino's API is slightly different from Winston/Bunyan in that context objects are passed as the first argument (`logger.info(ctx, msg)` vs `logger.info(msg, ctx)`). The `LoggerPort` normalizes this — callers use `logger.info(msg, ctx)` regardless.
- Async transport introduces a small (sub-millisecond) delay between log call and write. For `fatal`, Pino flushes synchronously.

### Neutral

- Pretty-printing in development is opt-in via `LOG_PRETTY=true`. In CI, logs are JSON (which is fine — CI doesn't render pretty-print anyway).
- The `LoggerPort` deliberately omits `setLevel()` — level changes in production are handled by restarting with a different `LOG_LEVEL` env var, not runtime mutation.

## Alternatives Considered

### Option A: Winston

Widely used, good ecosystem. But 3–5x slower than Pino in benchmarks; default output is not JSON (requires configuration); multi-transport model adds complexity. Rejected on performance.

### Option B: Bunyan

JSON-native like Pino. But slower than Pino; less active maintenance (last major release 2019); smaller ecosystem. Rejected on activity and performance.

### Option C: Custom Logger (bare `JSON.stringify` to stdout)

Minimal overhead. But misses: level filtering, child loggers, redaction, serializers, transports. Would require maintaining equivalent functionality. Rejected.

## References

- Objective 3 (Observability Foundation)
- Pino benchmarks: https://github.com/pinojs/pino/blob/master/docs/benchmarks.md
- ADR-0019 (OpenTelemetry as Standard)
