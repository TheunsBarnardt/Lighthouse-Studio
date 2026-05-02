# Runbook: Responding to Alerts

Alerts fire via email and optionally ntfy.sh. Each alert maps to a Grafana rule defined in `deploy/observability/grafana/provisioning/alerting/rules.yaml`.

## Alert: HTTP Error Rate > 5% (5m)

**What it means:** More than 5% of HTTP requests are returning 5xx errors over the past 5 minutes.

**First steps:**

1. Open Grafana → Platform HTTP dashboard
2. Check "Request Rate by Status" — identify which status codes are spiking
3. Loki query: `{service="platform"} | json | level = "error" | __error__ = ""` — look for error messages
4. Check GlitchTip for recent exceptions correlated with the alert time
5. Check the deployment log — was there a recent deploy? Roll back if so.

**Common causes:**

- Unhandled exception in a new deployment
- Database connection exhaustion (check persistence metrics)
- External dependency timeout (AI provider, email service)

## Alert: HTTP p95 Latency > 2s (10m)

**What it means:** 95% of HTTP requests are taking more than 2 seconds over the past 10 minutes. The SLO budget is at risk.

**First steps:**

1. Open Grafana → Platform HTTP dashboard → "Request Latency Percentiles"
2. Identify which routes are slow (filter by route in the query)
3. Open a trace for a slow request (Tempo → Search → sort by duration)
4. Identify the bottleneck span (usually DB query or AI call)
5. Check database connection pool metrics

## Alert: Job Failure Rate > 10% (15m)

**What it means:** More than 10% of worker jobs are failing over 15 minutes.

**First steps:**

1. Open Grafana → Platform Jobs dashboard
2. Identify which stage is failing
3. Loki query: `{service="platform"} | json | level = "error" | workspaceId != ""` to find job error logs
4. Check GlitchTip for exceptions from the worker process

## Alert: Process Memory > 90% Heap (5m)

**What it means:** The Node.js process heap is at 90%+ of its allocated limit. OOM crash is imminent.

**First steps:**

1. Check current heap usage: Grafana → Platform Resources → Memory
2. Check for memory leaks: look for steadily climbing heap without drops
3. Immediate relief: restart the service (short downtime vs. crash downtime)
4. Root cause: run `node --heap-prof` or check for unbounded data structures in recent commits

## Alert: Any Service Down

**What it means:** A platform container has been unreachable for more than 1 minute.

**First steps:**

1. `pnpm obs:status` — check which container is down
2. `docker logs <container-name> --tail 100` — check for crash logs
3. Restart the container: `docker restart <container-name>`
4. If the observability stack itself is down, see the observability stack recovery runbook
