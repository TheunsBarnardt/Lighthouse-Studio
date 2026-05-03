# Runbook: Schema Rollback With Data Loss Risk

**Severity:** High — potential permanent data loss
**Estimated resolution time:** 30–120 minutes (plus customer decision time)

## When this applies

A customer initiates a rollback to a prior schema version, and the rollback plan includes at least one step flagged as `dataLoss: true` — typically:

- Rolling back past a column addition (dropping the column loses all data in that column)
- Rolling back past a table addition (dropping the table loses all data in that table)
- Rolling back past a type change (may truncate values to fit the smaller type)

The schema designer will display these risks prominently in the migration preview dialog before the customer confirms. This runbook applies if the rollback has **already been applied** and data was lost, or if an operator needs to assist a customer deciding whether to proceed.

## Before proceeding: confirm the customer understands the risk

The schema designer shows the user a preview that includes:

```
⚠️ DESTRUCTIVE CHANGES — DATA WILL BE LOST
- Table 'posts' will be dropped (all rows deleted)
- Column 'users.middle_name' will be dropped (all values deleted)
```

The customer must check a confirmation checkbox before proceeding. If a customer contacts support claiming data was lost, first verify they saw and accepted the warning.

## After data loss has occurred: options

### Option 1: Restore from database backup (if available)

Check whether a point-in-time backup exists from before the rollback:

```bash
# Postgres: verify PITR (Point-in-Time Recovery) capability
psql -c "SELECT pg_walfile_name(pg_current_wal_lsn());"
# Check your backup provider for PITR availability

# MSSQL: check transaction log backups
RESTORE HEADERONLY FROM DISK = N'/backup/...';

# MongoDB: check backup coverage
# Atlas: use the Atlas UI → Backup → Point in Time Recovery
```

If PITR is available:

1. Restore to a separate standby instance at the timestamp before the rollback
2. Export the lost data from the standby: `pg_dump --table=cust_<slug>.posts`
3. Import the lost data into the live instance
4. Do NOT restore the live instance directly — this would also roll back all other changes since the rollback

### Option 2: Application-layer recovery

If the application writing to the platform has its own records (e.g., a CRM system with its own backups), work with the customer to re-import data through the Data Browser (Objective 18) or a bulk import API.

### Option 3: Accept the loss

If no backup exists and application-layer recovery isn't possible, the data is gone. Document what was lost, who authorized the rollback (from the audit log), and close the incident.

## Documenting the incident

Pull the audit log for the rollback:

```sql
SELECT * FROM audit_log
WHERE event_type = 'data_management.schema.rolled_back'
  AND workspace_id = '<workspace_id>'
ORDER BY occurred_at DESC
LIMIT 5;
```

The `metadata` field contains `rolled_back_to_version`, `version_from`, and `data_loss_risk: true`. This provides evidence of what was done and when.

## Updating the schema state if needed

If the database was manually restored from backup but the platform's schema model wasn't updated, you'll have schema drift. Use the import flow to re-sync:

1. Introspect the restored database to produce a schema definition
2. Import that definition as a new version via the schema designer
3. Verify the designer's view matches the actual database state

## Prevention

- Ensure workspace-level backups are configured before customers begin using the data management module
- The platform's operational checklist (Objective 10) requires backup verification before Stage 1
- Encourage customers to use the column archive pattern (add a `deleted_at` column, soft-delete) rather than hard drops for important data
