# Recovering from Partial Bulk-Delete Failure

**Audience:** On-call engineer  
**Severity:** Medium to High — data integrity risk

---

## Overview

A bulk-delete operation (triggered by the customer or an automated cleanup job) may partially complete: some files are deleted, some fail. This leaves the workspace in an inconsistent state. This runbook covers identifying the scope, deciding how to proceed, retrying failures, and restoring files if needed.

---

## 1. Identify the Bulk-Delete Operation

Find the operation in the audit log:

```sql
SELECT
  id          AS operation_id,
  workspace_id,
  actor_id,
  payload,
  created_at
FROM audit_events
WHERE event_type = 'storage.bulk_delete'
  AND workspace_id = '<workspace_id>'
ORDER BY created_at DESC
LIMIT 10;
```

Note the `operation_id` from the payload for use in subsequent queries.

---

## 2. Determine Which Files Succeeded vs Failed

```sql
-- Files successfully deleted in this operation
SELECT storage_key, deleted_at
FROM storage_objects
WHERE bulk_operation_id = '<operation_id>'
  AND deleted_at IS NOT NULL;

-- Files that failed (still present, marked with error)
SELECT storage_key, last_error
FROM storage_objects
WHERE bulk_operation_id = '<operation_id>'
  AND deleted_at IS NULL
  AND last_error IS NOT NULL;
```

Cross-reference the `last_error` column to understand the failure mode (network timeout, permission error, object not found, etc.).

---

## 3. Determine If Partial State Is Acceptable

- If the **failed files are ones that should be kept**, the partial state is correct — the completed deletions were intentional and the failures were a safe guard. Document and close.
- If **all files should have been deleted**, the remaining files are unintended survivors. Proceed to step 4.
- If **deleted files should not have been deleted**, proceed to step 5 (restore).

---

## 4. Retry the Failed Subset

Trigger a targeted retry via the admin API:

```bash
curl -X POST http://localhost:3001/admin/storage/retry-bulk-delete \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"operationId": "<operation_id>", "onlyFailed": true}'
```

Monitor worker logs for `[bulk-delete:retry]` progress events. Re-run the failed-files query after completion to confirm zero remaining.

---

## 5. Restore a Correctly Deleted File

Options depend on the storage backend:

### If the backend has versioning enabled (B2/Azure)

Restore directly from the provider:

```bash
# B2 — list versions and restore
b2 ls --long --versions b2://<bucket-name>/<storage-key>
b2 copy-file-by-id <file-version-id> <bucket-name> <storage-key>
```

Then re-insert or un-delete the DB record:

```sql
UPDATE storage_objects
SET deleted_at = NULL, last_error = NULL
WHERE storage_key = '<storage_key>'
  AND workspace_id = '<workspace_id>';
```

### If no versioning is available

Check whether a backup exists (nightly snapshots). Restore the object from backup to the bucket, then restore the DB record as above.

If no backup exists, notify the customer that the file is unrecoverable and document the data loss in the incident record.

---

## 6. Post-Recovery Verification

```sql
-- Confirm the workspace object counts look correct
SELECT COUNT(*), SUM(size_bytes) FROM storage_objects
WHERE workspace_id = '<workspace_id>' AND deleted_at IS NULL;
```

Confirm with the customer that the workspace is in the expected state before closing the incident.
