# Runbook: Data Browser — Stuck Import Job

**Symptom:** An import job is stuck in `validating` or `importing` status and not making progress.

---

## 1. Identify the Job

```sql
SELECT id, status, total_rows, imported_rows, skipped_rows,
       started_at, updated_at, initiated_by_user_id
FROM import_jobs
WHERE status IN ('validating', 'importing')
ORDER BY started_at;
```

If `updated_at` hasn't changed in > 10 minutes, the job worker is likely stuck or crashed.

---

## 2. Check the Job Queue

Look for the corresponding job in the platform's job queue:

```sql
SELECT id, queue, type, status, attempts, last_error, created_at, updated_at
FROM job_queue_records
WHERE payload->>'jobId' = '<import_job_id>'
ORDER BY created_at DESC;
```

- If `status = 'failed'`, the worker threw an unhandled error. Check `last_error`.
- If `status = 'pending'` with no attempts, the worker process may be down.

---

## 3. Check Worker Logs

```bash
# Find log lines for this import job
grep '"jobId":"<import_job_id>"' /var/log/platform/worker.log | tail -50
```

Common causes:

- **Out of memory**: importing very large CSVs with many FK columns exhausts heap. Increase `NODE_OPTIONS=--max-old-space-size=2048` for the worker process.
- **Storage file not found**: the source CSV was uploaded but the storage adapter can't find it. Check `source_file_id` in the `file_records` table.
- **Network timeout to database**: transient failure; re-enqueueing usually resolves.

---

## 4. Re-enqueue the Job

If the job is salvageable (source file exists, DB is healthy):

```sql
-- Reset to pending so the worker picks it up again
UPDATE import_jobs
SET status = 'pending', started_at = NULL, updated_at = NOW()
WHERE id = '<import_job_id>';
```

Then signal the job queue to retry. Or manually re-enqueue via the platform admin API.

---

## 5. Cancel and Advise the User

If the job cannot be recovered:

```sql
UPDATE import_jobs
SET status = 'cancelled', completed_at = NOW(), updated_at = NOW()
WHERE id = '<import_job_id>';
```

Notify the user that the import was cancelled and they should retry. For imports > 50K rows, suggest splitting the file.

---

## Prevention

- Monitor `import_jobs` with an alert on `status IN ('validating','importing') AND updated_at < NOW() - INTERVAL '15 minutes'`.
- Ensure the worker has at least 2 GB RAM for large import jobs.
