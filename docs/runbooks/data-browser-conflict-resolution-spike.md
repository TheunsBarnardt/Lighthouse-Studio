# Runbook: Data Browser — Conflict Resolution Dialog Spike

**Symptom:** Users are seeing the conflict resolution dialog frequently — more than expected for normal collaboration patterns.

---

## 1. Understand the Pattern

A conflict (409) happens when two saves hit the same row with the same `_version`. Under normal collaboration, this is rare. A spike usually means:

1. **Permission caching is stale** — the row's `_version` in the cache is old, so saves always conflict.
2. **A background process is updating rows** — an ETL job, scheduled task, or webhook is touching the same rows users are editing.
3. **A bug is causing double-saves** — the UI is sending duplicate PATCH requests.

---

## 2. Check Conflict Rate in Audit Log

```sql
SELECT DATE_TRUNC('minute', created_at) AS minute,
       COUNT(*) AS conflicts
FROM audit_log
WHERE event_type = 'data_management.api.row_updated'
  AND metadata->>'conflictDetected' = 'true'
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY minute
ORDER BY minute DESC;
```

If the count is elevated, note which `table_id` and `schema_id` are affected.

---

## 3. Check for Background Writers

```sql
-- Recent row updates from non-human actors (API key usage)
SELECT actor_id, actor_type, COUNT(*) AS updates
FROM audit_log
WHERE event_type = 'data_management.api.row_updated'
  AND created_at > NOW() - INTERVAL '1 hour'
  AND metadata->>'tableId' = '<affected_table_id>'
GROUP BY actor_id, actor_type
ORDER BY updates DESC;
```

If an API key (system process) is responsible for many updates, coordinate with the team owning that process to schedule updates during off-peak hours or to use a separate table/schema.

---

## 4. Check Permission Cache

The data browser caches row permissions for 30 seconds (`BROWSER_DEFAULTS.PERMISSION_CACHE_TTL_MS`). If schema or membership changes caused the cache to serve stale `_version` values, force-invalidate by restarting the permission cache service or deploying a configuration change that bumps the cache generation key.

---

## 5. Check for Double-Save Bug

In the browser console, watch for duplicate PATCH requests to the same row endpoint in quick succession. If present, check the `onBlur` / `onCommit` handlers in the Grid cell components for re-entrancy issues.

---

## 6. Short-Term Mitigation

Instruct users to:

- Choose "Take theirs" if they're not certain their edit is more current.
- Use the "Row Detail" panel for multi-field edits (saves atomically on the Save button, not per-cell blur).

---

## Prevention

- Monitor the conflict rate; alert if it exceeds 5% of all row update attempts in a 5-minute window.
- Coordinate ETL/batch jobs to run outside working hours for tables that users actively edit.
