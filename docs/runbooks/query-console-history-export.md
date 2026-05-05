# Runbook: Query Console History Export

**Purpose:** Export query history for compliance, auditing, or debugging.

## Export via Audit Log

All console executions produce audit events (`data_management.query.executed`, `data_management.query.executed_write`). These are in the append-only audit log with hash chain integrity.

Export audit events for a workspace:

```sql
SELECT event_type, actor_user_id, metadata, created_at
FROM audit_events
WHERE workspace_id = '<id>'
  AND event_type LIKE 'data_management.query.%'
  AND created_at BETWEEN '<start>' AND '<end>'
ORDER BY created_at ASC;
```

## Export via query_history Table

The `query_history` table stores full query text, parameters, and result summaries:

```sql
SELECT
  id,
  user_id,
  query_language,
  query_text,
  status,
  duration_ms,
  rows_affected,
  error_message,
  created_at
FROM query_history
WHERE workspace_id = '<id>'
  AND created_at BETWEEN '<start>' AND '<end>'
  AND deleted_at IS NULL
ORDER BY created_at ASC;
```

Export to CSV from psql:

```bash
\COPY (SELECT ...) TO '/tmp/query_history_export.csv' WITH CSV HEADER;
```

## Retention Policy

Query history is retained for 90 days by default (`QUERY_DEFAULTS.HISTORY_RETENTION_DAYS`). After that, rows are soft-deleted (deleted_at set). Hard-delete of expired records is performed by a scheduled maintenance job.

To retain longer for compliance: modify the `HISTORY_RETENTION_DAYS` config for the workspace before the default TTL expires.

## Data Subject Access Request

If a DSAR covers query console activity:

1. Export `query_history` entries for the user's UUID
2. Export audit events for the user's actor_user_id
3. Note: query parameters against PII columns are redacted (`parameters` will be `null` for those entries)

See also: [data-subject-access-request runbook](./data-subject-access-request.md).
