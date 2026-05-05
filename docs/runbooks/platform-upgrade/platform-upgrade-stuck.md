# Platform Upgrade Stuck or Failed Partway

This runbook covers situations where the upgrade orchestrator hangs, crashes, or fails mid-run.

---

## Diagnosis: where did it stop?

Run:

```bash
platform upgrade --status
```

This shows the last recorded version per database and whether any audit events indicate a failed step. Cross-reference with the audit log:

```sql
-- PostgreSQL
SELECT event_type, metadata, occurred_at
FROM audit_log
WHERE event_type LIKE 'platform.upgrade.%'
ORDER BY occurred_at DESC
LIMIT 20;
```

The `metadata.step` field on `platform.upgrade.failed` events identifies which step failed:

- `compatibility_check` — bad version jump; fix by using the correct intermediate version.
- `preflight.backup` — no recent backup; take a backup and retry.
- `preflight.disk` — insufficient disk; free space and retry.
- `migrations` — a migration script failed; see below.
- `version_record` — migrations succeeded but the version row write failed; re-run is safe.
- `health_gate` — schema and version committed but the health check failed; investigate health before rolling back.

---

## The migration failed partway

The migration adapters use checksum-based idempotency. If a migration failed:

1. Fix the underlying cause (disk full, permissions, transient network issue).
2. Re-run `platform upgrade`. Already-applied migrations will be skipped; the failed migration retries.

Do **not** manually edit `__platform_migrations` to mark a migration as applied. If the migration was partially applied, you must roll back the migration manually, then re-run.

---

## The orchestrator hung (no output for > 5 minutes)

1. Check the process is still alive: `ps aux | grep platform` or Task Manager on Windows.
2. Check for long-running transactions on the database:

   ```sql
   -- PostgreSQL
   SELECT pid, state, now() - xact_start AS duration, query
   FROM pg_stat_activity
   WHERE state = 'active' AND now() - xact_start > interval '1 minute'
   ORDER BY duration DESC;
   ```

3. If a migration is blocked by a lock, identify the blocker:

   ```sql
   SELECT blocked.pid, blocked.query, blocking.pid AS blocking_pid, blocking.query AS blocking_query
   FROM pg_stat_activity blocked
   JOIN pg_stat_activity blocking ON blocking.pid = ANY(pg_blocking_pids(blocked.pid))
   WHERE blocked.state = 'active';
   ```

4. If necessary, cancel the blocking process (not the migration process itself) and let the migration retry.

5. If the orchestrator process itself is hung and unresponsive, kill it. The migration transaction is atomic — either it committed or it rolled back. Re-run `platform upgrade` to check state and retry.

---

## Version row was written but the app is unhealthy

This means the health gate failed post-upgrade. The schema and version rows are committed. Options:

1. **Investigate the health issue** (most likely an application configuration error, not a migration issue). Fix the configuration and restart the platform without re-running upgrade.
2. **Roll back** if the health issue is caused by the new schema: `platform upgrade --rollback`. Note: this removes the version row and reverts the schema, but if data was written in the new format, data loss may result.

---

## Restarting a failed upgrade from scratch

If you want to start completely fresh (e.g., restore from backup and retry):

1. Restore the database backup.
2. Verify `SELECT * FROM platform_versions` shows the pre-upgrade state.
3. Re-run `platform upgrade`.
