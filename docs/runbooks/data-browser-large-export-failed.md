# Runbook: Data Browser — Large Export Failed

**Symptom:** A user reports that their export did not complete or the download link was not delivered.

---

## 1. Find the Export Job

```sql
SELECT id, status, scope, format, total_rows, exported_rows,
       started_at, completed_at, signed_url_expires_at,
       initiated_by_user_id
FROM export_jobs
WHERE initiated_by_user_id = '<user_id>'
ORDER BY created_at DESC
LIMIT 10;
```

---

## 2. Diagnose by Status

| Status                    | Meaning                                    | Action                                                                                           |
| ------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `pending`                 | Job was enqueued but worker hasn't started | Check worker queue; restart if needed                                                            |
| `exporting` + no progress | Worker started but stalled                 | Check worker logs; re-enqueue or cancel                                                          |
| `failed`                  | Worker threw an error                      | Read error log; fix root cause; let user retry                                                   |
| `completed`               | Job completed                              | Check whether the user received the notification; check `signed_url` and `signed_url_expires_at` |

---

## 3. Common Failure Causes

**Size limit exceeded (> 1 GB default)**

```sql
SELECT exported_rows * 200 AS estimated_bytes  -- rough estimate
FROM export_jobs WHERE id = '<job_id>';
```

If the estimate exceeds `EXPORT_MAX_SIZE_BYTES` (1 GB), advise the user to:

- Apply a filter to reduce row count.
- Split into multiple exports by date range or ID range.
- Use the query console for very large extracts.

**Storage write failure**

Check if the storage adapter is reachable:

```bash
# B2 / S3 health check
curl -s https://s3.<region>.amazonaws.com/<bucket>/?list-type=2&max-keys=1 -H "Authorization: ..."
```

**Signed URL expired**

Signed URLs are valid for 7 days. If the user tries to download after expiry:

```sql
UPDATE export_jobs
SET signed_url = NULL, signed_url_expires_at = NULL
WHERE id = '<job_id>';
```

Then manually trigger re-signing (via the admin API endpoint `/api/v1/admin/exports/<job_id>/resign`) or ask the user to re-export.

---

## 4. Re-run the Export

If the export must be re-run:

```sql
UPDATE export_jobs
SET status = 'pending', started_at = NULL, exported_rows = 0,
    output_file_id = NULL, signed_url = NULL, signed_url_expires_at = NULL,
    updated_at = NOW()
WHERE id = '<job_id>';
```

Then signal the job queue to pick it up.

---

## Prevention

- Alert on `export_jobs.status = 'failed'`.
- Alert on `export_jobs.status = 'exporting' AND updated_at < NOW() - INTERVAL '30 minutes'`.
- Ensure the storage adapter has sufficient quota for export files.
