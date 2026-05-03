# Runbook: Audit Log Restore

_For recovering the audit log from backup after data loss, and verifying chain integrity after restore._

---

## Purpose

Describes the procedure for restoring the audit log tables from backup. Unlike application data, audit log restoration requires special attention:

- The audit log is append-only; restoring it can create chain discontinuities if done incorrectly
- Chain verification must be run immediately after restore
- Partial restores (restoring some rows but not others) will always fail chain verification

---

## Prerequisites

- Access to your database backup (PostgreSQL backup, MSSQL backup, or MongoDB backup)
- Database admin credentials (migration user level)
- Understanding of which backup was taken and when
- The platform should be in **maintenance mode** during restore

---

## Restore Scenarios

| Scenario                                             | Approach                                                         |
| ---------------------------------------------------- | ---------------------------------------------------------------- |
| Full database loss                                   | Restore the full database backup; chain verification afterward   |
| Audit tables corrupted; other data intact            | Restore only `audit_log` and `audit_chain_state` from backup     |
| Partial row loss (storage corruption, specific rows) | See [audit-storage-corruption.md](./audit-storage-corruption.md) |
| Events missing from recent window                    | Likely no backup covers them; check cold archive (if enabled)    |

---

## Procedure: Full Database Restore

Follow [postgres-restore.md](./postgres-restore.md) (or your database-specific restore runbook) for the full restore. After the database is restored:

1. **Verify audit chain integrity** (see Step 3 below) before bringing the platform back online
2. Compare event counts with your last known-good baseline
3. Identify the gap (if any) between the backup timestamp and the incident timestamp

---

## Procedure: Audit Tables Only

If only the audit tables need to be restored (other data is intact):

### Step 1: Put the platform in maintenance mode

Prevent new audit writes during restore:

- Set `PLATFORM_MAINTENANCE_MODE=true` in your deployment
- Or scale down the API and worker processes

### Step 2: Restore from backup

**PostgreSQL:**

```bash
# Restore only the audit_log and audit_chain_state tables
pg_restore -Fc \
  --host=your-db-host \
  --username=migrate_user \
  --dbname=your_database \
  --table=audit_log \
  --table=audit_chain_state \
  --data-only \
  --disable-triggers \
  your-backup-file.dump

# If using a SQL dump:
psql -h your-db-host -U migrate_user your_database \
  -c "TRUNCATE audit_log, audit_chain_state CASCADE;"
psql -h your-db-host -U migrate_user your_database < audit-backup.sql
```

**MSSQL:**

```sql
-- Restore using backup file (RESTORE with PARTIAL or file group restore)
-- Or use SELECT INTO from a backup database:
INSERT INTO audit_log SELECT * FROM backup_database.dbo.audit_log;
INSERT INTO audit_chain_state SELECT * FROM backup_database.dbo.audit_chain_state;
```

**MongoDB:**

```bash
mongorestore \
  --uri="mongodb://your-db-host:27017" \
  --db=your_database \
  --collection=audit_log \
  --drop \
  dump/your_database/audit_log.bson

mongorestore \
  --uri="mongodb://your-db-host:27017" \
  --db=your_database \
  --collection=audit_chain_state \
  --drop \
  dump/your_database/audit_chain_state.bson
```

### Step 3: Verify chain integrity after restore

**This step is mandatory.** Do not bring the platform back online until this passes.

```bash
# Run chain verification against all workspaces
for WORKSPACE_ID in $(psql -h your-db-host -U readonly_user your_database \
  -t -c "SELECT DISTINCT workspace_id FROM audit_chain_state;"); do
  echo "Verifying workspace: $WORKSPACE_ID"
  # Use the platform's internal verification tool (runs directly against DB, no API needed)
  node packages/tools/verify-chain-cli.js --workspace-id $WORKSPACE_ID
done
```

Or, once the platform is in maintenance mode but the API is accessible for admin calls:

```bash
curl -s -X POST \
  -H "Authorization: Bearer $INSTALLATION_AUDITOR_TOKEN" \
  https://your-platform/api/v1/workspaces/$WORKSPACE_ID/audit/verify-chain \
  | jq '{status, eventsVerified, tamperedAt}'
```

Expected result: `"status": "intact"` for all workspaces.

If verification fails: do not bring the platform online. Investigate the failure per [audit-storage-corruption.md](./audit-storage-corruption.md).

### Step 4: Document the restoration gap

Identify and document what was lost:

```sql
-- PostgreSQL: last event before backup cutoff
SELECT MAX(occurred_at) as last_event, MAX(sequence) as last_sequence
FROM audit_log
WHERE workspace_id = 'your-workspace-id';
```

If events between the backup cutoff and the incident exist in cold archive (if enabled), they can be retrieved and re-ingested. See [cold-archive-verification.md](./cold-archive-verification.md).

If no cold archive: the gap is permanent. Document it:

```
AUDIT LOG RESTORATION RECORD
Date of restore: 2026-05-02
Backup used: backup taken 2026-04-28T02:00:00Z
Confirmed loss: events from 2026-04-28T02:00:00Z to incident time
Affected workspaces: [list]
Chain verification result: intact (as of backup state)
Note: events in the gap are not recoverable; legal hold placed pending review
```

### Step 5: Resume platform operation

1. Remove maintenance mode
2. The platform will continue writing new events; the chain state picks up from the restored `last_sequence` value
3. New events chain correctly from the restored state

### Step 6: Audit the restore operation itself

Document the restore as an operational event:

```bash
# After the platform is back online, record the restore in the audit log
curl -s -X POST \
  -H "Authorization: Bearer $INSTALLATION_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "system.config.changed",
    "metadata": {
      "operation": "audit_log_restore",
      "backupTimestamp": "2026-04-28T02:00:00Z",
      "restoredAt": "2026-05-02T14:30:00Z",
      "gapStart": "2026-04-28T02:00:00Z",
      "gapEnd": "2026-05-02T14:00:00Z",
      "reason": "Storage failure on primary database"
    }
  }' \
  https://your-platform/api/v1/installation/audit/system-event
```

---

## After Restore: Supplementary Sources

If cold archival was enabled before the incident, archived chunks can provide events for the gap period. See [cold-archive-verification.md](./cold-archive-verification.md) for how to retrieve and verify archived chunks.

Note: re-ingesting archived events into the live database will break the hash chain (the chain state diverged during the gap). Archived events are the authoritative historical record; treat them as a separate read-only evidence source rather than re-inserting them.
