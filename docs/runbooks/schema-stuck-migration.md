# Runbook: Schema Migration Stuck

**Severity:** High — customer database is in an inconsistent state
**Estimated resolution time:** 15–60 minutes

## Symptoms

- `customer_schema_migrations` row has `status = 'running'` for more than 10 minutes
- Schema designer shows "Migration in progress" banner indefinitely
- No progress events appearing in the migration progress dialog

## Step 1: Identify the stuck migration

```sql
-- Postgres / MSSQL
SELECT id, schema_id, version_from, version_to, status, started_at, _created_at
FROM customer_schema_migrations
WHERE status = 'running'
ORDER BY started_at ASC;
```

```js
// MongoDB
db.customer_schema_migrations.find({ status: 'running' }).sort({ started_at: 1 });
```

Record the `id`, `schema_id`, `version_from`, `version_to`.

## Step 2: Check whether the migration process is still alive

```bash
# Find the platform process(es)
ps aux | grep platform-api   # Linux
Get-Process platform-api     # Windows
```

If the process crashed mid-migration, the migration row is orphaned. Proceed to Step 4.

If the process is running, check its logs for the correlation ID associated with the stuck migration.

## Step 3: Check for database locks (if process is alive)

### Postgres

```sql
SELECT pid, now() - pg_stat_activity.query_start AS duration,
       query, state
FROM pg_stat_activity
WHERE state != 'idle'
  AND now() - pg_stat_activity.query_start > interval '5 minutes';
```

If a long-running query is blocking the migration:

```sql
-- Identify the blocker
SELECT pg_blocking_pids(pid) AS blocked_by, pid, query
FROM pg_stat_activity
WHERE cardinality(pg_blocking_pids(pid)) > 0;

-- If safe, cancel the blocker (does not kill the connection)
SELECT pg_cancel_backend(<blocking_pid>);

-- Last resort: terminate
SELECT pg_terminate_backend(<blocking_pid>);
```

### MSSQL

```sql
SELECT session_id, blocking_session_id, wait_type, wait_time, last_wait_type, command, sql_handle
FROM sys.dm_exec_requests
WHERE blocking_session_id != 0;

-- Kill the blocker if appropriate
KILL <session_id>;
```

### MongoDB

```js
db.currentOp({ secs_running: { $gt: 300 } });
// If a long-running operation is blocking:
db.killOp(<opid>);
```

## Step 4: Mark the migration as failed

If the process crashed or the migration cannot complete, mark it failed so the system is consistent:

```sql
-- Postgres / MSSQL
UPDATE customer_schema_migrations
SET status = 'failed',
    completed_at = NOW(),
    error_details = '{"reason": "migration orphaned — process crashed or operation timed out"}'
WHERE id = '<migration_id>'
  AND status = 'running';
```

```js
// MongoDB
db.customer_schema_migrations.updateOne(
  { _id: ObjectId('<migration_id>'), status: 'running' },
  {
    $set: {
      status: 'failed',
      completed_at: new Date(),
      error_details: { reason: 'migration orphaned — process crashed or operation timed out' },
    },
  },
);
```

## Step 5: Assess database state

The migration may have applied some steps and not others. Check the actual database state:

1. In the schema designer, view the schema's history panel — the version diff shows what was intended
2. Use the Query Console (Objective 17) or a direct database client to inspect the customer's table namespace:

```sql
-- Postgres: list tables in the customer's schema
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'cust_<workspace_slug>';
```

Compare against the migration plan (stored in `customer_schema_migrations.plan`).

## Step 6: Choose a recovery path

**Option A: Re-attempt the migration**

If the database is in a clean state (no partial changes applied), clear the failed migration and re-attempt from the schema designer. The schema version has not changed.

**Option B: Accept partial state and apply the remainder manually**

If some steps succeeded and some didn't, use the Query Console to apply the remaining DDL manually, then mark the migration as succeeded and bump the schema's deployed version.

**Option C: Roll back to the previous version**

Use the schema designer's "Roll back to version N" action. This produces a new migration plan to undo the partial changes and restore the previous state.

## Step 7: Verify

After recovery, run the isolation verification:

```bash
pnpm test --filter=@platform/tests-cross-tenant -- --reporter verbose
```

And confirm the schema designer shows the correct state.

## Prevention

- Migrations longer than 30 seconds emit a `WARN` log with the migration ID
- Migrations longer than 5 minutes emit an `ERROR` log and trigger an alert (configure alerting on `platform_schema_migration_duration_seconds` histogram)
- All migration steps are designed to be idempotent where possible; re-running a partially-applied migration should not produce duplicate structures
