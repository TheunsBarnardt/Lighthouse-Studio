# Runbook: Data Browser — Stuck Export Job

**Symptom:** A user triggered an export from the data browser but the export has not completed and no download link has been delivered. The UI shows the export as "in progress" indefinitely, or the user never received a notification.

---

## 1. Find the Export Job

```sql
SELECT id, status, format, scope,
       total_rows, exported_rows,
       started_at, updated_at, completed_at,
       signed_url_expires_at, error_message,
       initiated_by_user_id
FROM export_jobs
WHERE initiated_by_user_id = '<user_id>'
  AND status NOT IN ('completed', 'cancelled')
ORDER BY created_at DESC
LIMIT 5;
```

If `updated_at` is more than 15 minutes old and `status` is `exporting`, the worker is likely stuck or crashed.

---

## 2. Check Job Queue Status

```sql
SELECT id, queue, type, status, attempts, last_error, created_at, updated_at
FROM job_queue_records
WHERE payload->>'exportJobId' = '<export_job_id>'
ORDER BY created_at DESC;
```

Or via the platform CLI:

```bash
platform jobs status --type export --id <export_job_id>
```

- `status = 'failed'`: the worker threw an unhandled error. Check `last_error` and worker logs.
- `status = 'pending'` with 0 attempts: the worker is down or the queue is paused. Restart the worker.
- `status = 'running'` but no progress: the process may be stalled on a large query or storage write.

---

## 3. Check Worker Logs

```bash
# Find all log lines for this export job
grep '"exportJobId":"<export_job_id>"' /var/log/platform/worker.log | tail -100
```

On Windows:
```powershell
Select-String -Path "C:\Platform\logs\worker\*.log" -Pattern "<export_job_id>" | Select-Object -Last 100
```

Common failure patterns:

| Log pattern                        | Cause                                              | Resolution                                          |
|------------------------------------|----------------------------------------------------|-----------------------------------------------------|
| `StorageWriteError`                | Storage adapter unreachable or quota exceeded      | Check storage health; see storage runbooks          |
| `QueryTimeoutError`                | The export query exceeded `QUERY_TIMEOUT_MS`       | Check table indexes; reduce export scope with filter|
| `ENOMEM` / heap out of memory      | Very large export held entirely in memory          | Increase worker `NODE_OPTIONS`; or use streaming mode |
| `SignedUrlGenerationError`         | Storage credentials expired                        | Rotate storage adapter credentials                  |

---

## 4. Check Workspace Storage Quota

Exports write to the workspace's configured storage adapter. If the workspace is at its quota limit, the write will fail:

```sql
SELECT storage_used_bytes, storage_quota_bytes
FROM workspaces
WHERE id = '<workspace_id>';
```

If `storage_used_bytes >= storage_quota_bytes`, the export will fail with a quota error. Options:
- Increase the workspace quota (installation admin action in workspace settings).
- Delete old export files or other large assets to free space.
- Export to a smaller scope (apply filters to reduce row count).

---

## 5. Check Signed URL Expiry

If the export completed but the user missed the notification and the download link has expired (30-minute TTL for in-app download, 7 days for emailed links):

```sql
SELECT signed_url, signed_url_expires_at, status
FROM export_jobs
WHERE id = '<export_job_id>';
```

If `signed_url_expires_at < NOW()` and `status = 'completed'`, re-sign the export:

```bash
# Via the admin API
curl -X POST https://<platform-host>/api/v1/admin/exports/<export_job_id>/resign \
  -H "Authorization: Bearer <admin_token>"
```

This generates a new signed URL and re-sends the in-app notification.

---

## 6. Cancel and Advise Re-Export

If the job cannot be recovered:

```bash
platform jobs cancel <export_job_id>
```

Or directly in the database:

```sql
UPDATE export_jobs
SET status = 'cancelled', completed_at = NOW(), updated_at = NOW(),
    error_message = 'Manually cancelled by operator — see incident <ID>'
WHERE id = '<export_job_id>';
```

Advise the user to trigger a new export. If they need to export a large dataset, suggest:
- Applying filters to reduce scope.
- Using the query console for extracts > 500K rows (the query console supports streaming CSV output).
- Splitting into multiple exports by date range.

---

## Prevention

- Monitor `export_jobs` with an alert on `status = 'exporting' AND updated_at < NOW() - INTERVAL '15 minutes'`.
- Monitor `export_jobs.status = 'failed'` for unexpected failures.
- Ensure the storage adapter has sufficient quota for export files (exports can be large; allocate at least 10 GB for workspace export storage).
- Review worker memory allocation if exports of > 100K rows are common; increase `NODE_OPTIONS=--max-old-space-size=4096` for the worker process.
