# Runbook: Backup and Restore

How to manage Restic backups and perform restores from Backblaze B2.

---

## Restic setup (one-time)

### 1. Install Restic

```bash
sudo apt-get install restic
```

### 2. Configure B2 credentials

Set in the backup script or shell environment:

```bash
export B2_ACCOUNT_ID=<your-b2-account-id>
export B2_ACCOUNT_KEY=<your-b2-application-key>
export RESTIC_REPOSITORY=b2:<bucket-name>:/platform
export RESTIC_PASSWORD=<your-encryption-passphrase>
```

Store these in your password manager. Write the `RESTIC_PASSWORD` on paper and store in a secure physical location — losing it makes all backups permanently unreadable.

### 3. Initialise the Restic repository

```bash
restic init
```

### 4. Verify the repository

```bash
restic snapshots
restic check
```

---

## Manual backup (on-demand)

```bash
# Postgres dump
docker exec postgres-dev pg_dump -U platform platform_dev > /tmp/platform-dev-$(date +%Y%m%d).sql

# Back up the dump to Restic
restic backup /tmp/platform-dev-*.sql

# Back up storage volume
restic backup /var/platform/storage

# Clean up local dump
rm /tmp/platform-dev-*.sql
```

---

## Listing snapshots

```bash
restic snapshots
```

---

## Restoring from backup

### Restore a Postgres dump

```bash
# List snapshots to find the one you want
restic snapshots

# Restore the dump file (replace SNAPSHOT_ID with the actual ID)
restic restore SNAPSHOT_ID --target /tmp/restore

# Import into Postgres (will overwrite existing data)
# DANGER: verify APP_ENV=development before running on a live server
cat /tmp/restore/tmp/platform-dev-*.sql | docker exec -i postgres-dev psql -U platform platform_dev
```

### Restore a storage volume

```bash
restic restore SNAPSHOT_ID --target /tmp/restore
cp -r /tmp/restore/var/platform/storage/* /var/platform/storage/
```

---

## Retention management

Run monthly to prune old snapshots:

```bash
restic forget \
  --keep-daily 30 \
  --keep-weekly 12 \
  --keep-monthly 12 \
  --prune
```

---

## Integrity check

Run monthly:

```bash
restic check
```

A failing check means repository corruption — restore from a known good snapshot immediately and investigate.

---

## Restore drill procedure

**Do this quarterly for production.**

1. Provision a throwaway VPS (or use a local Docker container)
2. Install Restic and configure B2 credentials
3. Run `restic snapshots` — verify you can list snapshots
4. Restore the latest Postgres dump: `restic restore latest --target /tmp/restore`
5. Start a Postgres container and import the dump
6. Verify the database is intact: `psql -U platform platform_dev -c "SELECT count(*) FROM workspaces;"`
7. Document the result: date, snapshot ID used, time to restore, any issues
8. Destroy the throwaway environment

**Goal:** confirm that a full restore takes less than 2 hours.

---

## Troubleshooting

**`restic: command not found`:** Install with `sudo apt-get install restic`

**`Fatal: unable to open config file`:** The B2 credentials or RESTIC_PASSWORD are wrong. Re-check environment variables.

**`repository /.../backup does not exist`:** You may be pointing at the wrong repo path. Check B2_ACCOUNT_ID and the bucket name.

**Restore takes very long:** B2 has higher latency from South Africa than from US/EU. Large restores may take hours — plan accordingly.
