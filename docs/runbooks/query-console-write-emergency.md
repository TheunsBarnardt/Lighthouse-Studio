# Runbook: Query Console Write Emergency

**Symptom:** A user has executed a destructive write query (mass DELETE, UPDATE, or INSERT) via the console and data needs to be recovered.

## Immediate Containment

1. Revoke `query.write` permission for the affected workspace immediately:

   - Navigate to Workspace → Settings → Permissions
   - Remove `query.write` from any role that has it
   - Or revoke it directly from the individual user

2. If the loss is ongoing (in-progress query):
   - Terminate the session using the [query-console-runaway runbook](./query-console-runaway.md)

## Evidence Collection

1. Find the audit event: `data_management.query.executed_write`
   - Records: `userId`, `workspaceId`, `queryText` (via `query_history`), `affectedTables`, `durationMs`, timestamp
2. Retrieve the full query from `query_history`:
   ```sql
   SELECT query_text, parameters, status, rows_affected, created_at, user_id
   FROM query_history
   WHERE workspace_id = '<workspace_id>'
     AND status = 'succeeded'
     AND created_at > now() - interval '1 hour'
   ORDER BY created_at DESC;
   ```

## Data Recovery

1. Check if the database has Point-in-Time Recovery enabled — see [postgres-pitr runbook](./postgres-pitr.md)
2. Restore from the most recent backup to a recovery instance
3. Extract the affected rows from the recovery instance
4. Replay lost data into production (may require manual SQL construction)

## Post-Incident

- Document the incident in the audit log with a manual entry
- Review who granted `query.write` and update the workspace permission policy
- Consider adding workspace-level confirmation requirements or daily `query.write` grant expiry
- File a post-mortem if data loss exceeded 100 rows
