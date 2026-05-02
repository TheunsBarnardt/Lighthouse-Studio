# Postgres — Tuning Reference

Performance tuning guidelines for the platform's PostgreSQL instance.

---

## Connection pool sizing

### PgBouncer

| Parameter           | Default | Guidance                                                          |
| ------------------- | ------- | ----------------------------------------------------------------- |
| `max_client_conn`   | 200     | Set to: expected peak concurrent HTTP connections × 1.5           |
| `default_pool_size` | 20      | Set to: `max_connections` on Postgres × 0.8 ÷ number of databases |

PgBouncer should be the bottleneck, not Postgres. If PgBouncer wait queue grows (`SHOW STATS` → `cl_waiting > 0`), increase `default_pool_size` first.

### Application pool (`pg` Pool)

| Parameter | Default | Guidance                                                                 |
| --------- | ------- | ------------------------------------------------------------------------ |
| `max`     | 10      | `POSTGRES_POOL_SIZE` env var. Should be ≤ PgBouncer `default_pool_size`. |

### Postgres `max_connections`

Default `max_connections` on Postgres 17: 100. The sum of all application pool `max` values + PgBouncer connections must not exceed this.

On a VPS with 2 GB RAM: `max_connections = 80` is a safe default.

---

## Statement timeout

**Server-level default:** `statement_timeout = 30000` (30 s) — set in the postgres command in `docker-compose` files.

Long-running queries that legitimately need more time (reports, aggregations) should:

1. Run as background jobs with their own connection.
2. Override the timeout for that connection: `SET LOCAL statement_timeout = 0;` within a transaction (directPool only).

Never disable the timeout globally.

---

## Autovacuum tuning

The default autovacuum is sufficient for most tables. For high-churn tables (audit log, event queue), consider:

```sql
ALTER TABLE audit_events SET (
  autovacuum_vacuum_scale_factor = 0.01,   -- vacuum at 1% dead tuples (default 20%)
  autovacuum_analyze_scale_factor = 0.005  -- analyze at 0.5% new tuples (default 10%)
);
```

Monitor with:

```sql
SELECT relname, n_dead_tup, last_autovacuum, last_autoanalyze
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC;
```

---

## Memory settings

For a VPS with 4 GB RAM dedicated to Postgres:

```conf
shared_buffers = 1GB              # 25% of RAM
effective_cache_size = 3GB        # 75% of RAM (hint for planner, not actual allocation)
work_mem = 16MB                   # per sort/hash operation; increases with joins
maintenance_work_mem = 256MB      # for VACUUM, CREATE INDEX
```

Add these to the `postgresql.conf` or as `-c` flags in the Compose command.

---

## Index maintenance

Run `REINDEX CONCURRENTLY` on bloated indexes:

```sql
-- Check index bloat (rough estimate)
SELECT
  indexrelid::regclass AS index,
  pg_size_pretty(pg_relation_size(indexrelid)) AS size,
  idx_scan AS scans
FROM pg_stat_user_indexes
ORDER BY pg_relation_size(indexrelid) DESC
LIMIT 20;
```

After heavy delete/update workloads, run:

```sql
VACUUM ANALYZE;  -- on tables with high dead-tuple counts
```

---

## Slow query log analysis

The platform logs queries > 1 s via `log_min_duration_statement = 1000`. To find the worst offenders:

**In Loki (Grafana):**

```
{container="postgres-dev"} |= "duration:"
| regexp `duration: (?P<ms>[0-9.]+) ms`
| ms > 1000
| line_format "{{.ms}}ms  {{.line}}"
```

**From pg_stat_statements (if installed):**

```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

SELECT
  calls,
  mean_exec_time::int AS mean_ms,
  total_exec_time::int AS total_ms,
  left(query, 100)
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;
```
