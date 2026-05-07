# ADR-0206: Generated App Observability Defaults

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 27 — Code Generation

## Context

Generated server code runs in production. Operations teams need to monitor it without depending on Lighthouse Studio being available.

## Decision

Every generated server code project ships with observability enabled by default:
- **Structured JSON logs** — emitted on stdout at `info` level (configurable via `LOG_LEVEL` env var)
- **`/health` endpoint** — liveness + readiness checks (returns `{ status: 'ok', version }`)
- **`/metrics` endpoint** — Prometheus-format metrics (request count, latency histograms, error rates)
- **OpenTelemetry spans** — on all request paths; disable-by-config via `OTEL_ENABLED=false`

These are available when the platform is offline. The deployed app is independently monitorable.

## Consequences

- Operations teams can monitor generated apps with standard tooling (Grafana, Prometheus, Datadog)
- The `/health` endpoint enables standard Kubernetes/ECS liveness probes without configuration
- Observability adds ~50 lines to the generated bootstrap code; negligible

## Alternatives considered

- **Platform-only observability** — generated app cannot be monitored if platform is down; unacceptable for production
- **Opt-in observability** — most customers don't opt in; most apps ship unmonitored; bad default
