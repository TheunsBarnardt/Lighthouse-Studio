# ADR-0022: SLO and Error Budget Framework

**Status:** Accepted
**Date:** 2026-05-02
**Deciders:** solo

## Context

Without defined Service Level Objectives (SLOs), every incident is a surprise and there is no principled basis for deciding when to stop feature work to fix reliability. Error budgets provide a finite pool of "allowed downtime" that gives product teams a clear signal: when the budget is exhausted, reliability work takes priority over features.

The platform is a multi-tenant system used by enterprises; its SLOs must be strong enough to support enterprise use cases without requiring a full SRE team to maintain.

## Decision

**Initial SLOs (measured over 28 days rolling):**

| SLO                            | Target       | Measurement                        |
| ------------------------------ | ------------ | ---------------------------------- |
| HTTP availability              | 99.5%        | 1 - (5xx count / total count)      |
| HTTP p95 latency               | < 500ms      | `histogram_quantile(0.95, ...)`    |
| AI job p95 processing time     | < 5 minutes  | Histogram over job durations       |
| Non-AI job p95 processing time | < 30 seconds | Histogram over job durations       |
| Data correctness               | 100%         | Any data corruption is an SLO miss |

**Error budgets:**

99.5% availability over 28 days = 0.5% error budget = 201.6 minutes of allowed downtime per 28-day window.

When the error budget is exhausted:

1. No new feature deployments until the budget recovers (or is manually overridden with explicit justification).
2. An incident post-mortem is required.
3. On-call gets a priority page.

**Measurement:**

SLOs are measured in Grafana dashboards using Prometheus queries. The `platform-overview.json` dashboard shows error budget consumption as a percentage. Alerts fire at 50% budget consumed (warning) and 90% consumed (critical).

**Alerting philosophy:**

Alert only on SLO-correlated signals. Not on every metric threshold. Current alert rules:

- HTTP error rate > 5% for 5 minutes
- HTTP p95 latency > 2s for 10 minutes
- Job failure rate > 10% for 15 minutes
- Memory usage > 90% heap for 5 minutes

These map directly to SLO threats. Everything else is dashboard-only.

## Consequences

### Positive

- Clear signal for when to stop shipping features (budget exhausted).
- Incident post-mortems produce meaningful improvements over time.
- Enterprise customers can be given the SLO numbers during sales; they're measurable.

### Negative

- 99.5% is ambitious for a single-node VPS deployment. Planned maintenance must be coordinated to avoid exceeding the budget.
- Error budget tracking requires correct implementation of the Prometheus queries; a bug in the query produces a false signal.

### Neutral

- SLOs are intentionally conservative for v1. They will be reviewed quarterly as traffic grows.
- The 100% data correctness SLO has no error budget — zero tolerance.

## Alternatives Considered

### Option A: Informal SLOs ("we try to be up")

No measurement, no budget, no discipline. Rejected; doesn't satisfy enterprise customers or the platform's own on-call needs.

### Option B: Aggressive 99.99% SLO

Requires multiple nodes, active failover, and significant infrastructure investment. Out of scope for v1 single-node deployment.

## References

- Objective 3 (Observability Foundation)
- Google SRE Workbook — Chapter 2 (SLOs)
- Grafana SLO panel documentation
