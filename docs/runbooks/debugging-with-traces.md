# Runbook: Debugging with Traces

## Accessing Traces

Go to Grafana → Explore → Select **Tempo** datasource.

## Finding a Trace

**By trace ID** (from a log line, error report, or correlation header):

1. Grafana → Explore → Tempo
2. Set query type to "TraceID"
3. Paste the trace ID
4. Click "Run query"

**Search by service and time range:**

1. Set query type to "Search"
2. Service name: `platform`
3. Adjust the time range
4. Filter by span name or status (e.g., `status = error`)

## Reading a Trace

Each trace shows a waterfall of spans:

- The root span is the HTTP request (`HTTP GET /api/...`)
- Child spans show: service method calls, database queries, AI calls, job dispatches
- Error spans are marked in red

Key attributes on every span:

- `correlationId` — links to Loki logs for this request
- `workspaceId` — which workspace was involved
- `userId` — which user triggered the action
- `db.statement` (on DB spans) — the actual query

## Finding Slow Requests

1. Grafana → Explore → Tempo → Search
2. Sort by duration descending
3. Look for spans taking > 200ms on read endpoints or > 500ms on write endpoints (see SLOs in ADR-0022)
4. Drill into the slow trace to identify which span is the bottleneck

## Trace Retention

Traces are retained for 7 days. For older incidents, check logs (14 days) or the error tracker (GlitchTip, indefinite for errors).

## Sampling Notes

Not all traces are stored (see ADR-0020):

- All error traces are stored
- All traces > 1s are stored
- 10% of healthy traces are stored

If you're debugging an issue that produced a healthy (non-error) fast trace, it may not be in Tempo. Use logs instead.
