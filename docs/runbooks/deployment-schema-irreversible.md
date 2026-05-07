# Runbook: Rollback With Irreversible Schema Migration

## Symptoms

- Deployment rolled back but the database still has the new schema
- Platform shows warning: "Code rolled back, schema cannot be reverted automatically"
- Old code version is running against new schema

## Steps

1. Verify the old code is compatible with the new schema. Check which schema changes were irreversible (from the deployment plan's `irreversibleOperations`).

2. Test the old code against the new schema in a dev environment. Common issues:
   - Dropped column: old code tries to read/write it → `column does not exist` error
   - Renamed column: old code uses old name → `column does not exist` error
   - Type change: old code sends incompatible type → `invalid input` error

3. If the old code is NOT compatible with the new schema, you have two options:
   - **Option A**: Fast-forward — re-deploy the new version immediately (rollback was the wrong decision)
   - **Option B**: Write a compensating migration that restores the schema the old code expects, apply it, and confirm old code works

4. Write the compensating migration. Apply it via the schema migration API:
   ```
   POST /api/schema/migrations/apply
   { "workspaceId": "<id>", "sql": "ALTER TABLE ...", "direction": "compensating" }
   ```

5. Verify the old code is working correctly after the compensating migration.

6. Plan the forward path: the next deployment must include code that handles both old and new schema, then a phase 2 deployment with the destructive migration.

## Prevention

- Flag destructive migrations before deployment by reviewing the plan's `irreversibleOperations` section
- For destructive migrations: use the two-phase deployment pattern (code handles both schemas → schema change → code uses new schema only)
