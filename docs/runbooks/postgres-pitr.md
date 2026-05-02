# Postgres — Point-in-Time Recovery (PITR)

PITR allows restoring the database to any moment in time, not just the last backup.

**Status: Deferred** — WAL archiving is designed but not yet activated. Activate when the first production deployment goes live.

---

## Design (for activation reference)

PITR requires:

1. `archive_mode = on` in `postgresql.conf`.
2. `archive_command` copies WAL segments to a local volume.
3. Restic ingests the WAL archive directory alongside the pg_dump backups.

When activated, this enables recovery to within seconds of any point after WAL archiving began.

---

## Activating WAL archiving

Add to the postgres command in `dev.yml` / `prod.yml`:

```yaml
command: >
  postgres
  -c archive_mode=on
  -c archive_command='cp %p /var/lib/postgresql/wal_archive/%f'
  -c wal_level=replica
  ...
```

Mount a volume for the WAL archive:

```yaml
volumes:
  - platform-postgres-wal-dev:/var/lib/postgresql/wal_archive
```

Add Restic job to include the WAL directory:

```bash
restic backup /var/lib/postgresql/wal_archive
```

---

## PITR restore procedure (once activated)

1. Restore the base backup using the standard restore procedure (`postgres-restore.md`).
2. Create a `recovery.conf` (Postgres 11 and earlier) or `postgresql.conf` additions (Postgres 12+):

```conf
# postgresql.conf additions for recovery
restore_command = 'cp /var/lib/postgresql/wal_archive/%f %p'
recovery_target_time = '2026-05-02 14:30:00 UTC'
recovery_target_action = 'promote'
```

3. Create `recovery.signal` in the Postgres data directory:

```bash
touch /var/lib/postgresql/data/recovery.signal
```

4. Start Postgres. It will apply WAL segments up to the target time, then promote.
5. Verify the data matches expectations.
6. Remove `recovery.signal` and `recovery_target_*` settings.

---

## Testing PITR

Before relying on PITR in production:

1. Activate WAL archiving in the dev environment.
2. Insert known test records, record their timestamps.
3. Delete the records.
4. Restore the base backup and apply WAL up to just before the delete.
5. Confirm the records are present.

Document the PITR test result.

---

## References

- `docs/runbooks/postgres-restore.md`
- `docs/adr/0016-backup-strategy.md`
- [Postgres PITR documentation](https://www.postgresql.org/docs/current/continuous-archiving.html)
