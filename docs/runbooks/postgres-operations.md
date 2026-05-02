# Postgres Operations

Day-to-day operational reference for the platform's PostgreSQL instance.

---

## Connecting

**Local (offline dev):**

```bash
# Via psql directly
psql postgres://platform_migrate:platform_migrate@localhost:5432/platform_dev

# Via PgBouncer (application user)
psql postgres://platform_app:platform_app@localhost:5433/platform_dev
```

**Dev/staging/prod:**

```bash
# Requires VPN or Coolify SSH tunnel
# Use POSTGRES_DIRECT_URL from environment secrets
psql "$POSTGRES_DIRECT_URL"
```

---

## Useful diagnostic queries

### Active connections and what they're doing

```sql
SELECT pid, usename, application_name, state, wait_event_type, wait_event,
       now() - state_change AS elapsed, left(query, 100)
FROM pg_stat_activity
WHERE datname = current_database()
ORDER BY elapsed DESC NULLS LAST;
```

### Long-running queries (> 10 seconds)

```sql
SELECT pid, usename, state, now() - query_start AS elapsed, left(query, 200)
FROM pg_stat_activity
WHERE datname = current_database()
  AND state != 'idle'
  AND query_start < now() - interval '10 seconds'
ORDER BY elapsed DESC;
```

### Table sizes

```sql
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS total_size,
  pg_size_pretty(pg_relation_size(schemaname || '.' || tablename)) AS table_size,
  pg_size_pretty(pg_indexes_size(schemaname || '.' || tablename)) AS index_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC;
```

### Lock investigation

```sql
SELECT
  bl.pid AS blocked_pid,
  a.usename AS blocked_user,
  kl.pid AS blocking_pid,
  ka.usename AS blocking_user,
  a.query AS blocked_query,
  ka.query AS blocking_query
FROM pg_catalog.pg_locks bl
JOIN pg_catalog.pg_stat_activity a ON a.pid = bl.pid
JOIN pg_catalog.pg_locks kl ON kl.transactionid = bl.transactionid AND kl.pid != bl.pid
JOIN pg_catalog.pg_stat_activity ka ON ka.pid = kl.pid
WHERE NOT bl.granted;
```

### Cache hit ratio (should be > 99%)

```sql
SELECT
  sum(heap_blks_read) AS heap_read,
  sum(heap_blks_hit) AS heap_hit,
  100 * sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read) + 0.001) AS ratio
FROM pg_statio_user_tables;
```

### Index usage (find unused indexes)

```sql
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;
```

### Autovacuum activity

```sql
SELECT relname, last_vacuum, last_autovacuum, last_analyze, last_autoanalyze,
       n_dead_tup, n_live_tup
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC;
```

---

## Terminating a stuck query

```sql
-- Soft cancel (sends SIGINT — query stops but connection remains)
SELECT pg_cancel_backend(pid) FROM pg_stat_activity WHERE pid = <PID>;

-- Hard kill (sends SIGTERM — connection is closed)
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE pid = <PID>;
```

**Caution:** terminating `platform_migrate` connections during a migration may leave the schema in an inconsistent state. See `postgres-migration-stuck.md`.

---

## Checking migration status

```bash
# From the repo root
POSTGRES_DIRECT_URL="..." pnpm --filter @platform/adapter-persistence-postgres db:migrate:status
```

---

## Extension status

```sql
SELECT extname, extversion FROM pg_extension ORDER BY extname;
```

Expected extensions: `pgcrypto`, `pg_trgm`, `uuid-ossp`, `vector`, `plpgsql`.

---

## PgBouncer stats

Connect to the PgBouncer admin console:

```bash
psql postgres://pgbouncer:@localhost:5433/pgbouncer
```

```sql
SHOW POOLS;   -- pool utilisation per database/user pair
SHOW STATS;   -- requests, bytes, query duration
SHOW CLIENTS; -- connected client info
SHOW SERVERS; -- backend server connections
```
