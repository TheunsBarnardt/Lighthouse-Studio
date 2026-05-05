# Storage Orphan File Reconciliation

**Audience:** On-call engineer  
**Severity:** Low (routine maintenance) / Medium (disk bloat or missing files)

---

## Overview

Two classes of orphan can occur:

- **Orphaned records** — a `storage_objects` DB row references a storage object that no longer exists in the backend (B2, Azure, or MinIO).
- **Orphaned bytes** — a storage object exists in the backend but has no corresponding DB row.

---

## 1. Detect via Reconciliation Job Logs

The reconciliation job runs nightly. Check its output:

```
# Docker / systemd
journalctl -u lighthouse-worker --since "24 hours ago" | grep reconciliation

# Kubernetes
kubectl logs -n lighthouse deploy/lighthouse-worker --since=24h | grep reconciliation
```

Look for lines like:

```
[reconciliation] orphaned_records=14 orphaned_bytes=3 workspace_id=ws_abc123
```

---

## 2. Find Orphaned Records (DB row, no storage object)

```sql
-- Records flagged as missing by the reconciliation job
SELECT id, workspace_id, bucket_id, storage_key, created_at
FROM storage_objects
WHERE reconciliation_status = 'missing'
ORDER BY created_at DESC;
```

For ad-hoc spot checks, query by upload date:

```sql
SELECT id, workspace_id, storage_key, size_bytes
FROM storage_objects
WHERE last_verified_at < NOW() - INTERVAL '48 hours'
  AND reconciliation_status != 'ok';
```

---

## 3. Find Orphaned Bytes (storage object, no DB row)

The reconciliation job writes orphaned keys to `storage_reconciliation_log`:

```sql
SELECT workspace_id, bucket_id, storage_key, detected_at
FROM storage_reconciliation_log
WHERE status = 'orphaned_bytes'
ORDER BY detected_at DESC
LIMIT 100;
```

---

## 4. Cleanup Steps

### Delete an orphaned DB record (file is genuinely gone)

Verify with the customer that the file is safe to remove, then:

```sql
UPDATE storage_objects
SET deleted_at = NOW(), reconciliation_status = 'purged'
WHERE id = '<object_id>';
```

### Re-create a DB record from a storage object (accidental record loss)

1. Confirm the storage object exists in the backend (check B2/Azure/MinIO directly).
2. Insert a new row restoring metadata from the storage object's header/custom metadata.
3. Mark `reconciliation_status = 'restored'`.

Contact the workspace owner to verify file integrity after restoration.

---

## 5. Trigger a Manual Reconciliation Run

```bash
# Via CLI
pnpm --filter @lighthouse/worker exec ts-node src/jobs/reconcile-storage.ts \
  --workspace-id ws_abc123

# Via API (internal admin endpoint)
curl -X POST http://localhost:3001/admin/jobs/storage-reconciliation \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"workspaceId": "ws_abc123"}'
```

Monitor progress in worker logs. The job emits `[reconciliation:complete]` when finished.
