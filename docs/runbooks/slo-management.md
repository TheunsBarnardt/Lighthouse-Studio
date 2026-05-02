# Runbook: SLO and Error Budget Management

## Current SLOs

See ADR-0022 for the rationale. Summary:

| SLO               | Target       | Measurement window |
| ----------------- | ------------ | ------------------ |
| HTTP availability | 99.5%        | 28 days rolling    |
| HTTP p95 latency  | < 500ms      | 28 days rolling    |
| AI job p95 time   | < 5 minutes  | 28 days rolling    |
| Non-AI job p95    | < 30 seconds | 28 days rolling    |
| Data correctness  | 100%         | Any incident       |

## Checking Error Budget

Open Grafana → Platform Overview dashboard. The "HTTP Availability (28d)" stat panel shows remaining availability. Error budget math:

- 99.5% availability = 0.5% error budget
- 0.5% of 28 days = 201.6 minutes of allowed downtime

If the stat shows 99.3%, you've consumed 40% of the error budget (0.2% / 0.5%).

## When Budget Is Exhausted

1. Stop all non-critical feature deployments immediately.
2. Declare an incident if not already declared.
3. Identify the root cause from logs, traces, and error reports.
4. Write a post-mortem with: timeline, root cause, contributing factors, action items.
5. Implement the highest-priority action items before resuming feature deployments.

## Planned Maintenance

Planned maintenance consumes error budget. For a deployment that takes the service down for 5 minutes:

- 5 min / 201.6 min budget = 2.5% of monthly budget consumed

Minimize planned downtime by:

- Deploying during low-traffic periods (check the HTTP request rate panel)
- Using zero-downtime deployments when possible (rolling restarts, health checks)
- Batching multiple changes into one deployment window

## Quarterly SLO Review

Every quarter, review:

1. Actual availability vs. target (export from Prometheus)
2. p95 latency trend (improving, stable, or degrading?)
3. Major incidents and their SLO impact
4. Whether SLO targets should be adjusted (up for confidence, down for realistic constraints)
