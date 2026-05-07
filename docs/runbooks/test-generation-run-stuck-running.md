# Runbook: Test Run Stuck in Running State

## Symptoms

- Test run status has been `running` for more than 30 minutes
- No `TEST_RUN_COMPLETED` or `TEST_RUN_FAILED` audit event emitted
- Server may have restarted during the run

## Steps

1. Check the run's start time:
   ```
   GET /api/test-generation/runs/<runId>
   ```
   Compare `startedAt` to current time.

2. Check if the server process was restarted around the time the run started:
   ```
   GET /internal/process-log?since=<startedAt>
   ```

3. Manually mark the run as failed if it is stuck:
   ```
   PATCH /internal/test-generation/runs/<runId>
   { "status": "failed", "completedAt": "<now>", "_adminOverride": true }
   ```
   This requires the internal admin endpoint.

4. The background cleanup job (`test-run-cleanup` cron) ages out stuck runs automatically after 30 minutes. Verify it is scheduled:
   ```
   GET /internal/cron/jobs
   ```
   Look for `test-run-cleanup` with status `active`.

5. Restart the cleanup job if it is not running:
   ```
   POST /internal/cron/jobs/test-run-cleanup/trigger
   ```

## Prevention

- The cleanup cron should run every 15 minutes (configured in cron settings)
- Monitor `test_run_stuck_total` Prometheus metric
