# Migrating a Workspace to a New Storage Adapter

**Audience:** On-call engineer / platform operations  
**Severity:** High operational change — plan carefully, test first

---

## Overview

This runbook covers moving all files for a workspace from one storage backend to another (e.g., MinIO → B2, B2 → Azure). The procedure is copy-then-switch: files are copied to the new backend before traffic is redirected, ensuring no downtime and a clean rollback path.

---

## Pre-Migration Checklist

Before starting:

- [ ] Confirm the workspace owner is aware and has approved a maintenance window
- [ ] Note total workspace data size: `SELECT SUM(size_bytes) FROM storage_objects WHERE workspace_id = '<workspace_id>' AND deleted_at IS NULL`
- [ ] Ensure destination bucket/container exists and credentials are configured
- [ ] Verify destination storage quota is sufficient
- [ ] Confirm the platform version supports the target adapter for this workspace
- [ ] Create a DB backup (or snapshot) before proceeding

---

## 1. Copy All Objects to the New Adapter

Use the platform's migration tool:

```bash
pnpm --filter @lighthouse/worker exec ts-node src/tools/migrate-storage.ts \
  --workspace-id ws_abc123 \
  --from-adapter minio \
  --to-adapter b2 \
  --dry-run   # Remove this flag when ready for real copy
```

The tool copies each object, preserving metadata and content type. Monitor progress:

```bash
journalctl -u lighthouse-worker -f | grep "migrate-storage"
```

A completed copy logs: `[migrate-storage] copied=1024 failed=0 workspace_id=ws_abc123`

**Do not proceed if failed > 0.** Investigate errors, fix them, and re-run.

---

## 2. Pause New Writes (Optional, for Strict Consistency)

For very active workspaces, briefly set the workspace to read-only to prevent writes arriving during the switchover:

```sql
UPDATE workspaces SET read_only = TRUE WHERE id = '<workspace_id>';
```

Run a final incremental copy pass to catch any objects uploaded after the initial copy.

---

## 3. Update Workspace Configuration

Switch the workspace's active storage adapter in the DB:

```sql
BEGIN;

UPDATE workspace_storage_config
SET
  adapter_type      = 'b2',
  adapter_config_id = '<new_config_id>',
  updated_at        = NOW()
WHERE workspace_id = '<workspace_id>';

-- Verify before committing
SELECT adapter_type, adapter_config_id FROM workspace_storage_config
WHERE workspace_id = '<workspace_id>';

COMMIT;
```

Re-enable writes if you set the workspace to read-only:

```sql
UPDATE workspaces SET read_only = FALSE WHERE id = '<workspace_id>';
```

---

## 4. Verify the New Adapter Is Working

1. Test a signed-URL generation for an existing object.
2. Test a small upload (1 KB test file) through the admin API.
3. Confirm an existing file can be downloaded.

```bash
curl -X POST http://localhost:3001/admin/storage/verify-adapter \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"workspaceId": "ws_abc123"}'
```

---

## 5. Post-Migration Cleanup

Once the workspace has been running on the new adapter for 24 hours with no issues:

```bash
# Delete old objects from the source backend
pnpm --filter @lighthouse/worker exec ts-node src/tools/migrate-storage.ts \
  --workspace-id ws_abc123 \
  --delete-source
```

Confirm old bucket/container is empty, then remove the old credentials from the DB.

---

## Rollback

If the new adapter fails verification:

1. Revert `workspace_storage_config` to the original `adapter_type` and `adapter_config_id`.
2. Re-enable writes if paused.
3. The old objects are still on the source backend — no data was deleted.
4. Investigate the failure before retrying.
