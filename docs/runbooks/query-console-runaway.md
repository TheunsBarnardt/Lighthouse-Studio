# Runbook: Query Console Runaway Query

**Symptom:** A query is consuming excessive CPU or blocking other queries. The console shows "Running…" indefinitely or the DB shows a long-running session.

## Immediate Response

1. Identify the running query in the database:

   **PostgreSQL:**

   ```sql
   SELECT pid, usename, query_start, state, query
   FROM pg_stat_activity
   WHERE usename LIKE 'cust_%_readonly' OR usename LIKE 'cust_%_console_writer'
   ORDER BY query_start ASC;
   ```

   **MSSQL:**

   ```sql
   SELECT session_id, login_name, start_time, status, text
   FROM sys.dm_exec_requests r
   CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) t
   WHERE login_name LIKE 'cust_%';
   ```

2. Terminate the offending session:

   **PostgreSQL:**

   ```sql
   SELECT pg_terminate_backend(<pid>);
   ```

   **MSSQL:**

   ```sql
   KILL <session_id>;
   ```

## Root Cause Investigation

- Check the audit log for the query: `data_management.query.executed` / `data_management.query.timed_out`
- Review the query text in `query_history` table for the offending workspace
- Check whether `statement_timeout` was honoured (Postgres) — if the connection pool client was misconfigured, timeouts may not apply

## Prevention

- Default timeout is 30s (`QUERY_DEFAULTS.TIMEOUT_MS`). Reduce this for high-traffic workspaces via workspace config.
- Only grant `query.long_running` to users who genuinely need extended timeout budgets.
- Monitor `pg_stat_activity` and alert if any console-role session exceeds 2× the configured timeout.

## Post-Incident

- Update workspace timeout config if appropriate
- Review who holds `query.long_running` permission in the affected workspace
- If repeated occurrences: consider lowering the platform-wide `MAX_TIMEOUT_MS` cap
