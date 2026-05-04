# Runbook: Diagnosing Slow Customer API Calls

**Audience:** Platform operators
**Relates to:** Objective 12

---

## Overview

Slow API responses degrade customer experience and may indicate database issues, missing indexes, or problematic query patterns. The platform emits metrics and traces for every customer API call. This runbook covers diagnosing which endpoints are slow and why.

**Thresholds:**

- > 2 seconds: WARNING logged
- > 10 seconds: ERROR logged; alert fires if sustained
- Bulk operations: > 10s WARNING, > 60s ERROR

---

## Step 1: Identify the Slow Endpoint

**From metrics:**

```promql
histogram_quantile(0.95,
  rate(platform_api_request_duration_seconds_bucket{workspace="acme"}[5m])
) > 2
```

This shows the p95 latency per workspace/table/method combination. Filter by `table` and `method` to narrow down.

**From logs:** Search for `slow_request` log entries:

```
level=warn msg="slow API request" workspace=acme table=orders method=GET duration_ms=3200 correlationId=abc123
```

**From the audit log:** For a specific `correlationId`, look up the corresponding audit event to see the exact filter, sort, and pagination parameters the client used.

---

## Step 2: Reproduce the Query

Extract the query parameters from the slow request. If the correlation ID is known:

1. Find the trace in your tracing system (Jaeger, Tempo, etc.) by `correlationId`.
2. Look at the `db.query` span to see the actual SQL or Mongo query.
3. Reproduce the query directly in the database to measure execution time.

---

## Step 3: Diagnose the Root Cause

**Case A: Full table scan (missing index)**

Signs: `EXPLAIN` shows `Seq Scan` (Postgres) or `COLLSCAN` (Mongo) on a large table.

Action: Identify the filter field. Check whether an index exists on that column in the customer's schema. If not, add one via the Schema Designer (Objective 11). If the schema has an index defined but it wasn't created (failed migration), check the migration status.

**Case B: Large offset (offset pagination on a big table)**

Signs: `?offset=50000` or similar in the request. The `X-Pagination-Performance-Warning` header is present in the response.

Action: Advise the customer to switch to cursor pagination (`?cursor=...`). Explain the performance characteristics documented in ADR-0103.

**Case C: Broad filter returning too many rows**

Signs: The query itself is fast but the response is large (high `platform_api_response_size_bytes`).

Action: Check if the client is using field selection (`?fields=...`). If not, advise them to request only needed columns. Check if the client should be paginating more aggressively (smaller `?limit`).

**Case D: Database under load (contention)**

Signs: Query time is variable; sometimes fast, sometimes slow. Other queries also slowing down.

Action: Check database CPU and I/O metrics. Look for long-running transactions or lock waits. If a bulk operation is running, it may be holding locks — see the bulk operation stuck runbook.

**Case E: Network latency between app and database**

Signs: The application-level trace span is fast, but the database round-trip is slow.

Action: Check the network path between application servers and the database. Consider connection pool health (stale connections, pool exhaustion).

---

## Step 4: Fix and Verify

After applying a fix (adding an index, advising pagination changes, clearing contention):

1. Re-run the slow query and confirm execution time is below the 2-second threshold.
2. Check metrics for the next 5 minutes to confirm p95 returns to normal.
3. If an index was added via schema migration, confirm the migration completed with `status = 'succeeded'` in `customer_schema_migrations`.

---

## Step 5: Alert Tuning

If slow requests are expected (e.g., a customer runs nightly reports against a large table), adjust the per-workspace slow-request threshold:

```bash
PATCH /api/v1/admin/workspaces/<workspace_id>/performance
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "slowRequestThresholdMs": 10000,
  "bulkSlowRequestThresholdMs": 120000
}
```

This suppresses spurious alerts for known-slow workloads without disabling monitoring globally.
