# Storage Quota Emergency Response

**Audience:** On-call engineer  
**Severity:** High — workspace writes are blocked

---

## Overview

When a workspace reaches 100% of its storage quota, all upload and write operations fail with `QuotaExceededError`. This runbook covers immediate relief and follow-up cleanup.

---

## 1. Identify the Affected Workspace

Check the alerting dashboard or query directly:

```sql
SELECT
  w.id AS workspace_id,
  w.name,
  sq.quota_bytes,
  sq.used_bytes,
  ROUND(sq.used_bytes::numeric / sq.quota_bytes * 100, 1) AS pct_used
FROM storage_quotas sq
JOIN workspaces w ON w.id = sq.workspace_id
WHERE sq.used_bytes >= sq.quota_bytes
ORDER BY pct_used DESC;
```

From Grafana: open the **Platform Storage** dashboard → **Quota Utilization** panel → filter by workspace.

---

## 2. Emergency Quota Extension

Grant a temporary uplift to unblock writes immediately. Agree an amount with the account team before making the change.

```sql
BEGIN;

UPDATE storage_quotas
SET
  quota_bytes = quota_bytes + (10 * 1024 * 1024 * 1024),  -- +10 GiB example
  updated_at  = NOW(),
  updated_by  = 'ops-oncall'
WHERE workspace_id = '<workspace_id>';

-- Confirm before committing
SELECT quota_bytes, used_bytes FROM storage_quotas WHERE workspace_id = '<workspace_id>';

COMMIT;
```

Document the change in the incident ticket.

---

## 3. Help the Customer Understand What's Taking Space

```sql
-- Top buckets by size within the workspace
SELECT
  b.name AS bucket_name,
  SUM(o.size_bytes) AS total_bytes,
  COUNT(*)          AS file_count
FROM storage_objects o
JOIN storage_buckets b ON b.id = o.bucket_id
WHERE b.workspace_id = '<workspace_id>'
  AND o.deleted_at IS NULL
GROUP BY b.name
ORDER BY total_bytes DESC
LIMIT 20;

-- Largest individual files
SELECT storage_key, size_bytes, created_at
FROM storage_objects
WHERE workspace_id = '<workspace_id>'
  AND deleted_at IS NULL
ORDER BY size_bytes DESC
LIMIT 25;
```

Share these results with the customer to help them decide what to remove.

---

## 4. Cleanup Guidance

Guide the customer to delete unneeded files through the UI. If mass deletion is needed:

```sql
-- Soft-delete all files in a specific bucket older than 90 days
UPDATE storage_objects
SET deleted_at = NOW()
WHERE bucket_id = '<bucket_id>'
  AND created_at < NOW() - INTERVAL '90 days'
  AND deleted_at IS NULL;
```

After soft-deletion, the storage purge job runs within 1 hour and reclaims bytes. The quota meter updates within 5 minutes of the purge job completing.

---

## 5. Monitor Quota After Extension

Watch the Grafana **Quota Utilization** panel for the workspace. Expect used bytes to decrease as the customer cleans up. Set a follow-up reminder to:

1. Reassess whether the emergency uplift should become a permanent increase.
2. Close the incident once the workspace is below 80% quota.
