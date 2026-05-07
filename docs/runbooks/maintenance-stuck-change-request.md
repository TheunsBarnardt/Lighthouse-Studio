# Runbook: Stuck Change Request

**Severity:** Medium
**Trigger:** A change request has been `in_progress` for more than 24 hours without status update

---

## Symptoms

- Change request status stuck at `in_progress`
- The engaged pipeline stage shows no recent activity
- No deployment or resolution event in the audit log for the change request

---

## Diagnosis

1. Check the pipeline queue for the engaged stage — is it queued, running, or failed?
2. Check the audit log for the change request:
   ```
   SELECT * FROM audit_events
   WHERE metadata->>'changeRequestId' = '<cr-id>'
   ORDER BY occurred_at DESC;
   ```
3. Look for a `CHANGE_REQUEST_ENGAGED_STAGE` event — did it fire?
4. If the stage job is running: check its logs for errors or hangs

---

## Resolution

### Stage job failed silently

1. Locate the stage execution record for the engaged stage
2. Check its `errorDetails` field — the async executor should have written an error there
3. Manually transition the change request status back to `open`
4. Re-engage the stage after fixing the underlying issue

### Stage job never started

1. Check whether the pipeline worker is healthy (Obj 9 process management)
2. Restart the worker if needed
3. Re-engage the stage — the change request status will update once the job completes

### Manual resolution

If the change was made outside the pipeline (e.g., a manual hotfix):
1. Resolve the change request with `resolution: 'fixed'` and a note explaining the manual fix
2. Ingest a new signal with the fix details for audit trail purposes

---

## Prevention

- The cleanup cron job (every 6 hours) should detect stuck change requests and flag them
- Set a maximum `in_progress` duration in workspace settings (default: 48 hours)
