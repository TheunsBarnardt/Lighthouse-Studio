# Runbook: Data Migration Rollback After Retention Window

**Trigger:** User requests rollback but the 24-hour snapshot retention window has expired.

## Symptoms

- Rollback button is greyed out / returns "snapshot expired" error
- Snapshot storage record shows `expiredAt` in the past

## Investigation

Check when the snapshot expired:
```sql
SELECT snapshot_id, created_at, expires_at
FROM migration_snapshots
WHERE execution_id = '<execution-id>';
```

## Remediation

At this point there is no automatic rollback. Proceed manually:

### Option A: Target database native backup

If the workspace database has point-in-time recovery enabled (recommended for production):
1. Identify the timestamp just before the migration started (from the `snapshot_taken` audit event)
2. Use the database's PITR feature to restore the affected tables to that timestamp
3. Document the recovery in the audit trail

### Option B: Re-run migration from source

If the source data is still available:
1. Contact the user to confirm the source connection is still valid
2. Create a new migration plan from the same source
3. Execute the new migration (target tables now contain migrated data; use the Schema Designer to truncate affected tables first with user approval)

### Option C: No recovery possible

If PITR is unavailable and source is gone:
1. Escalate to the workspace owner
2. Document: recovery is not possible; workspace must rebuild the affected data manually

## Prevention

- Warn users prominently at the 20-hour mark that their snapshot expires in 4 hours
- Enable automatic snapshot extension if validation is still pending
- Recommend PITR for production workspace databases
