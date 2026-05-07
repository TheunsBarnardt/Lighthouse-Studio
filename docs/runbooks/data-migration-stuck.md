# Runbook: Data Migration Stuck

**Trigger:** Migration execution is in `running` status but no progress has been made in > 10 minutes.

## Symptoms

- Execution status is `running` but `migratedRows` hasn't changed
- No recent `ai.data_migration.execution_progress` audit events
- No recent batch results in the execution record

## Investigation

### 1. Check the migration executor job

```sql
SELECT status, started_at, last_heartbeat
FROM migration_executions
WHERE id = '<execution-id>';
```

If `last_heartbeat` is > 5 minutes ago, the executor job has crashed or lost connectivity.

### 2. Check source connectivity

If the source is a database, test a simple query:
```sql
SELECT 1 FROM pg_stat_activity LIMIT 1; -- Postgres
```

If the source is a file, verify the file storage key is still accessible.

### 3. Check target write availability

Query the migration's target tables directly. If writes are failing due to a deadlock or quota, they'll appear in error logs.

## Remediation

### Option A: Cancel and re-run

If the executor job is dead:
1. Update execution status to `cancelled`
2. The migration plan remains; re-execute (the executor resumes from the last committed batch index)

### Option B: Manual executor restart

If the job is in the queue but not executing:
1. Identify the job ID from the execution record
2. Cancel the stuck job
3. Re-enqueue: `JobQueuePort.enqueue('migration-executor', { executionId })`

### Option C: Rollback

If the source is permanently unavailable and migration cannot continue:
1. Roll back to the snapshot from the execution page
2. Investigate source access before re-attempting

## Prevention

- Add a heartbeat check: if last_heartbeat > 5 min, alert oncall
- Implement job timeout: kill executor jobs that haven't progressed in 15 minutes
