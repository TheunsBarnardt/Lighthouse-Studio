# Postgres — Stuck Migration

What to do when a migration won't apply or won't roll back.

---

## Symptoms

- `pnpm db:migrate` hangs indefinitely.
- `pnpm db:migrate` exits with a lock-wait timeout error.
- A deployment is stuck at the "apply migrations" step.
- The migration applied partially — some SQL ran, then it crashed.

---

## Step 1: Identify the blocker

```sql
-- Find what's holding locks that block DDL
SELECT
  bl.pid AS blocked_pid,
  ka.usename AS blocking_user,
  ka.state AS blocking_state,
  left(ka.query, 200) AS blocking_query,
  now() - ka.query_start AS blocking_duration
FROM pg_locks bl
JOIN pg_stat_activity a ON a.pid = bl.pid
JOIN pg_locks kl ON kl.transactionid = bl.transactionid AND kl.pid != bl.pid
JOIN pg_stat_activity ka ON ka.pid = kl.pid
WHERE NOT bl.granted;
```

If there are blocking queries, decide whether to:

- Wait for them to finish (preferred for short queries).
- Cancel them: `SELECT pg_cancel_backend(<blocking_pid>);`
- Kill them: `SELECT pg_terminate_backend(<blocking_pid>);`

---

## Step 2: Check for an open transaction from the migration runner

The migration runner wraps each migration in `BEGIN/COMMIT`. If the process crashed mid-transaction, Postgres automatically rolls back the transaction (transactions don't persist across connection loss).

However, if the connection is still open (e.g. the migration is still running, just slowly):

```sql
-- Find migration connections
SELECT pid, state, now() - query_start AS elapsed, left(query, 200)
FROM pg_stat_activity
WHERE usename = 'platform_migrate'
ORDER BY elapsed DESC;
```

If the connection is `idle in transaction` and the migration is finished:

```sql
SELECT pg_terminate_backend(<pid>);
```

---

## Step 3: Determine if the migration was partially applied

Some DDL cannot run inside a transaction in Postgres (e.g. `CREATE INDEX CONCURRENTLY`, `ALTER TYPE ... ADD VALUE`). For these, if the runner crashed mid-migration:

1. Check which statements ran by inspecting `pg_catalog` for the object being created.
2. Manually complete or reverse the partial change.
3. Either:
   - Mark the migration as applied in `__platform_migrations` if the schema is now correct.
   - Write a fix-forward migration that patches the partial state.

**Never edit an applied migration file.** Fix forward.

---

## Step 4: Manually record or remove from the tracking table

If the migration needs to be re-run after a partial failure:

```sql
-- Remove the tracking record so the runner tries again
DELETE FROM __platform_migrations WHERE name = '0042_problematic_migration';
```

If the migration ran successfully but the tracking record was not written (crash after DDL, before INSERT):

```sql
-- Record it manually (compute the checksum with: sha256sum migrations/0042_....sql)
INSERT INTO __platform_migrations (name, checksum) VALUES ('0042_problematic_migration', '<sha256>');
```

---

## Step 5: Re-run the migration

```bash
POSTGRES_DIRECT_URL="..." pnpm --filter @platform/adapter-persistence-postgres db:migrate apply
```

---

## Prevention

- Migrations that use `CONCURRENTLY` operations (index creation, etc.) should be noted in the migration header comment.
- Long DDL migrations should be run during a maintenance window.
- The CI promotion gate takes a backup snapshot before applying migrations to staging/prod.

---

## Escalation

If the schema is in an unknown state and you cannot determine what ran:

1. Do not run the migration runner again.
2. Take an immediate pg*dump: `pg_dump -Fc $POSTGRES_URL > emergency*$(date +%s).dump`.
3. Compare the schema against the expected state for the target migration.
4. Fix manually in a psql session, then mark the migration applied.
5. File a postmortem.
