# Runbook: Deployment Stuck / Not Progressing

## Symptoms

- Deployment shows `running` status but no steps are completing
- Deploy monitor shows a step in `running` state for more than 10 minutes
- No log lines appearing in the logs panel

## Steps

1. Check the deployment's current step:
   ```
   GET /api/deployment/deployments/<id>
   ```
   Look at `steps[].status` to find which step is `running`.

2. For a stuck `schema` step: check if the database migration is locked:
   - PostgreSQL: `SELECT * FROM pg_locks WHERE granted = false;`
   - MSSQL: `SELECT * FROM sys.dm_exec_requests WHERE blocking_session_id > 0;`
   - Look for long-running transactions from the migration process.

3. For a stuck `server` step: check if the runtime is responding:
   ```
   GET /internal/runtime/status?workspaceId=<id>
   ```

4. For a stuck `health_check` step: verify the application is actually responding:
   ```
   curl -f <app-url>/api/health
   ```

5. If the process is unrecoverable, cancel the deployment:
   ```
   POST /api/deployment/deployments/<id>/cancel
   ```
   Then investigate the root cause before retrying.

6. For deployments stuck due to orchestrator crash: the orchestrator will recover and resume on restart. Check orchestrator logs: `journalctl -u lighthouse-deploy-orchestrator -f`

## Prevention

- Monitor `deployment_step_duration_p99` metric per step
- Alert if any step exceeds 5 minutes without completing
