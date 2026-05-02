# ADR-0019: OpenTelemetry as the Telemetry Standard

**Status:** Accepted
**Date:** 2026-05-02
**Deciders:** solo

## Context

The platform needs a way to emit logs, metrics, and traces from application code to the observability backends (Loki, Prometheus, Tempo). There are several approaches: vendor-specific SDKs (Datadog agent, Prometheus client, Jaeger client), a standard protocol (OpenTelemetry), or custom instrumentation libraries.

The risk with vendor-specific SDKs is lock-in: if the backend changes (e.g., moving from Tempo to Jaeger), all instrumentation code must be rewritten. Given the platform's multi-year lifecycle and self-hosted nature, the backend may well change.

## Decision

Use OpenTelemetry (OTel) as the single instrumentation standard across all platform services:

- `@opentelemetry/api` for spans, metrics, and context propagation
- `@opentelemetry/sdk-trace-node` and `@opentelemetry/sdk-metrics` for the SDK
- OTel Collector as the single point of telemetry routing
- Auto-instrumentations for HTTP, fetch, and database drivers

The `TracerPort` and `MetricsPort` abstract over the OTel API, enabling the noop implementation in tests and the real OTel SDK in production.

## Consequences

### Positive

- Instrument once; swap backends (Loki→Elasticsearch, Tempo→Jaeger) by changing only the OTel Collector config.
- OTel is CNCF-graduated and vendor-neutral — long-term stability guaranteed.
- Auto-instrumentations handle HTTP and database layers without manual spans.
- W3C Trace Context propagation is built in — traces cross service boundaries automatically.
- Single Collector reduces the number of outbound connections from each service.

### Negative

- OTel SDK adds ~1–2 MB to the bundle.
- OTel API design (meter providers, tracer providers) is more complex than a simple `console.log`-style interface.
- Some OTel APIs (particularly metrics) went through breaking changes in 0.x; now stable at 1.x.

### Neutral

- The `TracerPort` abstracts the `withSpan` callback pattern; callers don't see OTel types directly.
- Applications must call `initTelemetry()` before any other module to avoid missed spans on startup.

## Alternatives Considered

### Option A: Direct Prometheus Client + Pino OTLP Transport + Jaeger Client

Using each vendor's SDK directly. Works, but creates three separate SDKs with three separate configurations. Replacing any backend requires touching application code.

### Option B: No Abstraction — Use OTel API Directly

Simpler — no port/adapter indirection. But core services would then import from OTel packages, which are adapters. This violates the hexagonal architecture boundary. The `TracerPort` / `MetricsPort` abstraction keeps core clean.

## References

- Objective 3 (Observability Foundation)
- ADR-0005 (Hexagonal Architecture)
- ADR-0018 (Observability Stack Choice)
- OpenTelemetry specification: https://opentelemetry.io/docs/specs/otel/
