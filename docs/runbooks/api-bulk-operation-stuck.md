# Runbook: Cancelling a Stuck Bulk API Operation

**Audience:** Platform operators
**Relates to:** Objective 12, ADR-0104

---

## Overview

Bulk operations (`POST /<table>/bulk`, `PATCH /<table>?filter=...`, `DELETE /<table>?filter=...`) wrap their changes in a database transaction. If a bulk operation hangs — network interruption, application crash, database deadlock — the transaction may remain open, holding locks on the affected rows.

This runbook covers diagnosing and safely cancelling a stuck bulk operation.

---

## Symptoms

- A bulk API call has been in-flight for more than 60 seconds (ERROR threshold).
- The audit log shows a `bulk_created` / `bulk_updated` / `bulk_deleted` event with `outcome: failure` (if the operation failed and was rolled back) OR no audit event at all (if the application crashed before the audit write).
- Other clients get lock-wait timeouts accessing the same table.
- The `platform_api_request_duration_seconds` metric shows a long tail for that workspace/table.

---

## Step 1: Identify the Stuck Transaction

**Postgres:**

```sql
SELECT pid, state, wait_event_type, wait_event, query, now() - xact_start AS duration
FROM pg_stat_activity
WHERE state != 'idle' AND xact_start IS NOT NULL
  AND now() - xact_start > interval '30 seconds'
ORDER BY duration DESC;
```

**MSSQL:**

```sql
SELECT session_id, status, blocking_session_id, wait_type, wait_time,
       CAST(text AS VARCHAR(MAX)) AS sql_text,
       DATEDIFF(SECOND, start_time, GETDATE()) AS duration_seconds
FROM sys.dm_exec_requests r
CROSS APPLY sys.dm_exec_sql_text(sql_handle) t
WHERE DATEDIFF(SECOND, start_time, GETDATE()) > 30
ORDER BY duration_seconds DESC;
```

**Mongo:**

```javascript
db.currentOp({ active: true, secs_running: { $gt: 30 } });
```

Note the process/session ID of the stuck transaction.

---

## Step 2: Confirm It's the Bulk Operation

Match the query text to the expected bulk operation pattern:

- Postgres/MSSQL: look for `INSERT INTO cust_<workspace>.<table>` or `UPDATE cust_<workspace>.<table>` with a large WHERE clause.
- Mongo: look for `bulkWrite` or `updateMany` on the `cust_<workspace>__<table>` collection.

Also check the platform's audit log for a `data_management.api.bulk_created` / `bulk_updated` / `bulk_deleted` event with `outcome: running` (if the platform emits in-progress events).

---

## Step 3: Cancel the Transaction

**Postgres:**

```sql
SELECT pg_cancel_backend(<pid>);    -- sends SIGINT; graceful
-- If that doesn't work after 10 seconds:
SELECT pg_terminate_backend(<pid>); -- sends SIGTERM; forceful
```

**MSSQL:**

```sql
KILL <session_id>;
```

**Mongo:**

```javascript
db.killOp(<opid>)
```

After cancellation, the database will roll back the transaction automatically. No data is left in a partial state.

---

## Step 4: Check for Lock Inheritance

After cancelling, verify that locks have been released:

**Postgres:**

```sql
SELECT relation::regclass, mode, granted
FROM pg_locks l
JOIN pg_stat_activity a ON l.pid = a.pid
WHERE NOT granted;
```

If any rows appear with `granted = false`, there are still waiters. They should unblock within seconds of the kill. If they don't, investigate whether there's a second stuck transaction.

---

## Step 5: Inform the Client

The client that issued the bulk operation will receive a connection error or a 500 response (depending on when the connection broke). The response body will not include a `correlationId` if the application crashed before formatting the error.

Advise the client:

- The operation was rolled back; no data was changed.
- They should retry the operation.
- If the operation repeatedly gets stuck, reduce the batch size (split into smaller requests) or contact support.

---

## Step 6: Root Cause

Common causes:

- **Application crash mid-transaction:** Application OOM, uncaught exception in request handler. Check application logs for errors around the time of the stuck operation.
- **Network partition between app and database:** Connection dropped while transaction was open. The database detects this after the TCP timeout (typically 2 minutes). The `pg_cancel_backend` in Step 3 is faster.
- **Deadlock not detected:** Postgres and MSSQL have deadlock detectors (fire within ~5 seconds). Mongo does not. If two bulk operations targeted overlapping document sets in Mongo, manual kill may be needed.
- **Transaction timeout not configured:** Check that the platform's database connection pool has a transaction timeout configured (recommended: 120 seconds for bulk operations).

---

## Prevention

- The platform enforces bulk operation size limits (1,000 rows for create; 10,000 rows for update/delete by filter). Large operations that hit these limits are rejected before the transaction begins.
- Application-level timeouts are set per operation type (60-second error threshold). If a bulk operation exceeds this, the application should cancel the request, which triggers a database rollback.
- Monitor `platform_api_request_duration_seconds` for bulk operations with p99 > 10 seconds and investigate proactively.
