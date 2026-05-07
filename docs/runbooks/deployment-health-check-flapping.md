# Runbook: Post-Deploy Health Check Flapping

## Symptoms

- Health check passes then fails intermittently after deployment
- Deployment status flips between `deployed` and `failed`
- `/api/health` returns 200 sometimes and 500 other times

## Common Causes

| Cause | Symptom | Fix |
|-------|---------|-----|
| App still initializing | Health check fails in first 10s then stabilises | Increase health check timeout or add readiness delay |
| Database connection pool exhausted | 500 errors under load | Check connection pool settings; increase pool size |
| Memory pressure | Health check times out under load | Check memory usage; increase instance memory |
| Dependent service unavailable | Health check cascades | Health endpoint should not check external services |

## Steps

1. Check health check response body for details:
   ```
   curl -v <app-url>/api/health
   ```
   The generated health endpoint returns `{ "status": "healthy" | "degraded", "checks": {...} }`.

2. Check application logs around the health check failure time using the Logs panel.

3. If the app is initialising slowly: the generated app's health endpoint should return `503` during startup and `200` when ready. Verify:
   ```
   GET /internal/runtime/instances?workspaceId=<id>
   ```
   Look at `instanceState` per instance.

4. Adjust health check timeout in the deployment plan:
   - Open the plan editor
   - Increase `healthCheck.timeoutSeconds` for the affected environment (default 60)
   - Save and re-deploy

5. For cascading health checks (health endpoint calls an external service that is down): the generated `/api/health` should only check internal components. Edit the health endpoint and remove external dependency checks.

## Prevention

- Health check timeout of 60s is the default; slow-starting apps may need 120s
- The health endpoint generated in Stage 7 checks only: database connectivity and memory usage
