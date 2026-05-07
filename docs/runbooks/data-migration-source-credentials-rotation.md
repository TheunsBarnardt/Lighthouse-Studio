# Runbook: Source Credentials Rotated Mid-Flight

**Trigger:** Migration fails mid-execution because source credentials have been rotated.

## Symptoms

- Batch fails with "authentication failed" or "connection refused" against the source
- Source is a database (not a file upload)

## Investigation

Confirm the credentials error:
```sql
SELECT meta->>'error' AS error
FROM audit_events
WHERE event = 'ai.data_migration.batch_failed'
  AND meta->>'executionId' = '<execution-id>'
ORDER BY created_at DESC
LIMIT 5;
```

Look for "password authentication failed" or "authentication error" patterns.

## Remediation

### Option A: Cancel and re-execute with new credentials

1. Cancel the current execution
2. Update the source connection with new credentials
3. Re-execute the migration plan (executor resumes from last committed batch index)

### Option B: Pause and resume (if supported)

If the executor supports mid-flight pausing, pause the migration, update credentials in the secret store, then resume. The executor retries the failed batch with the new credentials.

## Prevention

- Require read-only service accounts for source connections, not personal credentials
- Read-only service accounts are typically not subject to regular rotation policies
- Alert if a source connection's credentials are about to expire (if the source provides credential TTL information)
- Document in the migration guide: use dedicated read-only migration accounts, not shared credentials
