# Runbook: Deployed Function Failing at Runtime

## Symptoms

- `code_generation_runtime_failure_rate` above 5% for a function
- Customer reports function returning 500 errors
- Alert: invocation timeout or memory exceeded

## Steps

1. Check recent invocations for the function:
   ```
   GET /internal/functions/<id>/invocations?limit=20&status=failed
   ```
   Look for error codes: `TIMEOUT`, `MEMORY_EXCEEDED`, `RUNTIME_ERROR`.

2. Read the function's logs:
   ```
   platform logs function --function-id <id> --tail 200 --level error
   ```

3. Common failure modes:

   | Error code | Cause | Action |
   |-----------|-------|--------|
   | `TIMEOUT` | Function exceeds 30s limit; likely unbounded loop or slow external call | Rollback to previous version; regenerate with explicit timeout guidance |
   | `MEMORY_EXCEEDED` | Processing too many records in memory | Rollback; regenerate with cursor pagination instead of loading all records |
   | `RUNTIME_ERROR: NotFoundError` | Function assumes record exists without null check | Rollback; regenerate with proper null-guard |
   | `RUNTIME_ERROR: permission denied` | Declared permissions don't match actual SDK calls | Re-verify permissions; re-approve; redeploy |
   | `INTEGRATION_ERROR: 401` | Third-party API key expired or revoked | Customer rotates the secret; re-deploy without code changes |

4. For persistent failures, roll back to the last known-good version:
   ```
   POST /api/code-generation/functions/<id>/rollback
   { "targetVersion": <N> }
   ```

5. After rollback, open a regeneration with feedback describing the failure cause.

## Prevention

- Monitor `code_generation_runtime_failure_rate` per function
- Alert when any function's failure rate exceeds 5% over a 5-minute window
- Stage 8 (Test Generation) tests reduce the likelihood of runtime failures reaching production
