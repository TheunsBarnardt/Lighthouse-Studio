# Runbook: Data Browser — Slow Grid Load

**Symptom:** The data browser grid takes more than 2 seconds to display data after navigating to a table or changing filter/sort configuration.

---

## 1. Establish a Baseline

Open the browser DevTools Network panel before reproducing the slowness. Look for the primary data request:

```
GET /api/v1/data/{workspaceId}/schemas/{slug}/tables/{table}/rows
```

Record: total response time, time-to-first-byte, and transfer size. This tells you whether the bottleneck is server-side query time, FK resolution, or network/payload size.

---

## 2. Check Slow Query Logs

On the server, enable or review slow query logs:

```bash
# Platform worker/web logs — look for db.query spans over 1000ms
grep '"db.query"' /var/log/platform/web.log | jq 'select(.duration_ms > 1000)'
```

In the observability dashboard (Grafana), open the **Data Browser** dashboard and filter by `table_name`. Look for:

- P95 query latency > 500ms
- High `db.rows_scanned` vs `db.rows_returned` ratio (indicates missing index)

---

## 3. Check Pagination Mode

The data browser uses cursor-based pagination by default. If the URL contains `?offset=...` instead of `?cursor=...`, the query is using offset pagination, which degrades for large tables.

Cursor pagination is the default. Offset mode may have been selected by an older client or an explicit API call. Verify the query parameter and advise the user to use the default cursor mode.

---

## 4. Check Sort Column Index

Cursor pagination requires an index on the sort column to avoid full-table scans. If the user is sorting by a non-indexed column:

```sql
-- In the customer schema (cust_<slug>)
EXPLAIN ANALYZE
SELECT * FROM <table>
WHERE id > '<last_cursor>'
ORDER BY <sort_column> ASC
LIMIT 50;
```

If the plan shows `Seq Scan` or `Sort` with high actual time, add an index:

```sql
CREATE INDEX CONCURRENTLY idx_<table>_<sort_column>
  ON cust_<slug>.<table>(<sort_column>);
```

For MSSQL:
```sql
CREATE INDEX IX_<table>_<sort_column>
  ON cust_<slug>.dbo.<table> (<sort_column>);
```

---

## 5. Check FK Resolution Batch Size

If the table has FK columns, FK resolution runs after the primary query. Check whether FK resolution is contributing to the latency:

In the Network panel, look for a request to `/fk-resolve`. If this request is slow, see the dedicated **Data Browser — Foreign Key Resolution Slow** runbook.

As a quick mitigation, the user can hide FK columns (right-click column header → Hide Column) to skip FK resolution for those columns while you investigate.

---

## 6. Check Row Count vs. Page Size

For very wide rows (many columns, large text fields) and large page sizes, the payload can be several MB:

```
# In Network panel: check the response body size
# If > 1 MB, the page size is likely too high
```

The default page size is 50 rows. If the user has set it to 500 or 1000, and the rows are wide, total transfer time dominates. Advise the user to reduce the page size to 50 or 100.

---

## 7. Check for Realtime Subscription Overhead

The data browser subscribes to realtime updates for the current table view (ADR-0238). Under high write volume, realtime events can trigger excessive re-fetches. Check the WebSocket frame count in DevTools → Network → WS.

If the table is receiving > 10 events/second, the realtime subscription is likely causing rapid re-renders. The subscription uses a debounce before re-fetching; if debounce is not configured, this is a bug. Check `REALTIME_DEBOUNCE_MS` in the server configuration (default: 300ms).

---

## 8. Check Network Waterfall in Browser DevTools

Open DevTools → Performance → record a page load. Check for:

- Long DNS / TLS setup (CDN or DNS issue — outside platform control)
- Request queueing (browser HTTP/2 multiplexing issue — usually not a concern)
- Long `Waiting (TTFB)` with short `Content Download` → server-side query is slow (steps 3–5 above)
- Short `Waiting (TTFB)` with long `Content Download` → large payload (step 6 above)

---

## Resolution Summary

| Root Cause                          | Fix                                                              |
|-------------------------------------|------------------------------------------------------------------|
| Missing index on sort column        | `CREATE INDEX CONCURRENTLY ...`                                  |
| Large page size + wide rows         | Reduce page size to 50                                           |
| Slow FK resolution                  | See FK Resolution Slow runbook; hide FK columns as mitigation    |
| Offset pagination on large table    | Ensure client uses cursor pagination                             |
| High realtime write volume          | Check debounce config; consider disabling realtime for that view |

---

## Prevention

- Add an alert on `data_browser.query_duration_p95 > 1000ms` per table.
- After schema migrations that add sort-able columns, verify indexes exist before releasing the schema.
- Include the data browser in load testing scenarios (Objective 28 conformance suite).
