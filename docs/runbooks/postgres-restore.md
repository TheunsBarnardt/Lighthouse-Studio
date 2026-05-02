# Postgres — Full Restore Procedure

Restoring the platform database from a pg_dump backup.

---

## When to use this

- Data loss due to accidental deletion or application bug.
- Database corruption.
- Disaster recovery (see also `disaster-recovery.md`).
- Quarterly restore drill (to verify backup integrity).

---

## Prerequisites

- Access to the backup file (from Restic via B2, or a local `.sql.gz` file).
- `pg_restore` or `psql` available on the restore machine.
- A fresh Postgres instance (or an empty database).
- The `POSTGRES_DIRECT_URL` for the target instance.

---

## Step 1: Locate the backup

**From Restic (remote B2):**

```bash
# List snapshots
restic -r b2:<bucket>:postgres/<env> snapshots

# Restore to a local directory
restic -r b2:<bucket>:postgres/<env> restore latest --target /tmp/pg-restore
```

**Local fallback:**

```bash
ls /backups/postgres/<env>/*.sql.gz | sort -r | head -5
```

---

## Step 2: Verify the backup is readable

```bash
gunzip -t /path/to/backup.sql.gz && echo "OK"
# OR for custom-format dumps:
pg_restore --list /path/to/backup.dump | head -20
```

---

## Step 3: Provision a fresh Postgres

For a drill, spin up the local Compose stack:

```bash
docker compose -f infra/docker/local.yml down -v
docker compose -f infra/docker/local.yml up -d postgres-local
```

Wait for it to be healthy, then verify extensions are installed (the init script runs on first start).

---

## Step 4: Restore the dump

**Plain SQL format (.sql.gz):**

```bash
gunzip -c /path/to/backup.sql.gz | psql "$POSTGRES_DIRECT_URL"
```

**Custom format (.dump):**

```bash
pg_restore --no-owner --role=platform_migrate --dbname="$POSTGRES_DIRECT_URL" /path/to/backup.dump
```

Errors about `role "platform" already exists` or extension ownership can be ignored.

---

## Step 5: Verify integrity

Run a set of sanity queries against the restored database:

```sql
-- Row counts for key tables (compare against expected values)
SELECT relname, n_live_tup FROM pg_stat_user_tables ORDER BY relname;

-- Check migration state
SELECT name, applied_at FROM __platform_migrations ORDER BY id;

-- Verify extensions
SELECT extname, extversion FROM pg_extension;
```

---

## Step 6: Run the conformance suite

If this is a drill or pre-traffic validation:

```bash
POSTGRES_DIRECT_URL="<restored-url>" pnpm test --filter @platform/adapter-persistence-postgres
```

All tests should pass. If they don't, investigate before switching traffic.

---

## Step 7: Switch traffic

For production recovery:

1. Update `POSTGRES_URL` and `POSTGRES_DIRECT_URL` in the environment (Coolify secrets).
2. Restart the `web-dev`/`web-prod` service.
3. Monitor error rates for 15 minutes.
4. File a postmortem.

---

## Quarterly drill schedule

The restore drill should be performed quarterly:

1. Pull the latest backup from Restic.
2. Restore to a fresh local Postgres.
3. Run the conformance suite.
4. Document the drill result in the team log.

If the drill fails, treat it as a production incident (the backup is not reliable).
