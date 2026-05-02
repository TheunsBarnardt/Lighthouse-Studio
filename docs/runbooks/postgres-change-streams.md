# Runbook: Postgres Change Streams — Logical Replication

## Prerequisites

- PostgreSQL 13+ (pgoutput plugin built-in)
- `wal_level = logical` in postgresql.conf
- Sufficient `max_wal_senders` and `max_replication_slots` (default 10 each)
- Platform user has REPLICATION privilege

## Setup

### 1. Configure postgresql.conf

```ini
wal_level = logical
max_replication_slots = 10
max_wal_senders = 10
```

Restart PostgreSQL after changing `wal_level`.

### 2. Create replication user

```sql
CREATE ROLE platform_replication WITH REPLICATION LOGIN PASSWORD '<password>';
GRANT SELECT ON ALL TABLES IN SCHEMA public TO platform_replication;
```

### 3. Create publication

```sql
-- In the platform database
CREATE PUBLICATION platform_pub FOR ALL TABLES;
```

Or for specific tables:

```sql
CREATE PUBLICATION platform_pub FOR TABLE projects, workspaces, users;
```

### 4. Create replication slot

The adapter creates the slot automatically on first connect. To create manually:

```sql
SELECT pg_create_logical_replication_slot('platform_main', 'pgoutput');
```

### 5. Enable full before-images (optional; for UPDATE before rows)

```sql
-- Without this, UPDATE only includes the primary key in the before-image
ALTER TABLE projects REPLICA IDENTITY FULL;
```

## Monitoring

```sql
-- Active replication slots
SELECT slot_name, active, confirmed_flush_lsn, pg_current_wal_lsn() AS current_lsn,
       pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), confirmed_flush_lsn)) AS lag
FROM pg_replication_slots;

-- Alert threshold: lag > 100MB
```

## WAL Retention Risk

**Critical**: Replication slots retain WAL until consumed. If the adapter stops consuming (process crash, deployment pause), WAL accumulates and can fill the disk.

**Mitigations**:

- Monitor `pg_replication_slots` lag in Grafana (alert at 100MB)
- Set `max_slot_wal_keep_size = 1GB` in postgresql.conf (Postgres 13+) to auto-drop slots that fall too far behind
- The adapter reconnects automatically on restart and resumes from the last confirmed LSN

## Troubleshooting

| Symptom                                  | Cause                         | Fix                                                                              |
| ---------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------- |
| `ERROR: logical replication not enabled` | `wal_level != logical`        | Change postgresql.conf, restart                                                  |
| Slot creation fails                      | Missing REPLICATION privilege | `GRANT REPLICATION TO platform_replication`                                      |
| WAL disk full                            | Slot not consuming            | Restart adapter or drop slot: `SELECT pg_drop_replication_slot('platform_main')` |
| Duplicate events after restart           | Normal at-least-once behavior | Subscribers must handle deduplication                                            |
