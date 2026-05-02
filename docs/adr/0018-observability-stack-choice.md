# ADR-0018: Observability Stack Choice

**Status:** Accepted
**Date:** 2026-05-02
**Deciders:** solo

## Context

The platform needs structured logging, metrics, distributed tracing, and error tracking. The options are SaaS services (Datadog, New Relic, Sentry SaaS, Grafana Cloud) or a self-hosted stack. The platform's core value proposition is self-hosted, data-sovereign operation; using SaaS observability tools would contradict this for on-premises deployments, and would add per-seat or per-data-volume costs that compound with scale.

The platform must be debuggable in production by reading logs, traces, and metrics — not by SSH. The observability stack must be deployable on the same hardware as the platform itself (8 GB baseline VPS), meaning memory footprint matters.

## Decision

Self-host the Grafana/Loki/Tempo/Prometheus/GlitchTip stack:

- **Grafana** — visualization, alerting UI, dashboard provisioning
- **Loki** — log aggregation and querying (LogQL)
- **Tempo** — distributed trace storage
- **Prometheus** — time-series metrics
- **GlitchTip** — error tracking (Sentry-compatible)
- **OTel Collector** — central telemetry ingest, routing, and sampling

All services are provisioned in code; no manual UI configuration. Total memory footprint: ~2.5 GB on an 8 GB host.

## Consequences

### Positive

- No SaaS costs; data stays on the customer's infrastructure.
- Grafana is the industry standard; operators know it.
- Provisioning in code means the observability stack is reproducible and version-controlled.
- Sentry SDK works with GlitchTip — no vendor-specific error tracking code.
- On the 4 GB floor, Tempo can be dropped (distributed tracing sacrificed for Loki+Grafana+GlitchTip only, ~1.5 GB).

### Negative

- Operator must maintain the stack (upgrades, backups, storage growth).
- Self-hosted Grafana lacks some Grafana Cloud features (synthetic monitoring, longer retention out of the box).
- GlitchTip is less mature than Sentry SaaS; some Sentry features aren't supported.

### Neutral

- Operators accustomed to Datadog/New Relic face a migration when deploying on-premises.
- Log retention requires a cold-archive strategy once 14-day hot storage fills.

## Alternatives Considered

### Option A: Datadog

Full-featured SaaS. ~$25/host/month + per-log-ingestion fees that balloon quickly at production volumes. Contradicts data-sovereignty requirement. Rejected on cost and data residency.

### Option B: Grafana Cloud

Managed Grafana stack. Free tier limited (50 GB logs/month); production volumes push into paid tiers. Contradicts self-hosted requirement for on-premises installs. Rejected for on-premises deployments; may be offered as a hosted option in future.

### Option C: Sentry Self-Hosted + ELK + Prometheus

Sentry self-hosted requires 4 GB RAM alone. ELK stack is similarly heavy. Combined footprint would exceed the 8 GB host budget. Rejected on resource grounds.

## References

- Objective 3 (Observability Foundation)
- ADR-0017 (Coolify as Orchestrator)
