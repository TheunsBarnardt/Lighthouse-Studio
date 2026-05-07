# Runbook: Rollback Failed

## Symptoms

- Audit event `ai.deployment.rollback_failed` emitted
- Deployment shows `failed` status after rollback was initiated
- Application not serving previous version

## Steps

1. Identify why the rollback failed. Check deployment logs for the rollback step error:
   ```
   GET /api/deployment/deployments/<id>
   ```
   Look at `steps` where stepType is `server` or `ui` and status is `failed` during rollback.

2. **Server rollback failed**: The prior server bundle may have been purged (retention window expired). Check:
   ```
   GET /internal/artifacts/<rollbackTargetDeploymentId>/server-bundle
   ```
   If 404: the artifact is gone. You must redeploy the prior version from source control.

3. **Schema rollback failed**: Some migrations are irreversible. The platform should have warned about this. For manual schema recovery:
   - Identify the irreversible migration from the deployment plan's `irreversibleOperations`
   - Write a compensating migration manually and apply it

4. **UI rollback failed**: CDN cache still serving new version. Clear the CDN cache:
   ```
   POST /internal/cdn/invalidate?workspaceId=<id>&version=all
   ```

5. If partial rollback completed (code reverted but schema didn't): verify the old code handles the new schema gracefully. Add compatibility code if needed.

## Prevention

- Keep rollback retention at 7+ days for production environments
- Review `irreversibleOperations` in the deployment plan before approving
