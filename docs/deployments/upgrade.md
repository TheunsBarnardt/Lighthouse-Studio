# Upgrade Guide

This document covers the procedure for upgrading a self-hosted Lighthouse Studio installation to a new release.

---

## Overview

Lighthouse Studio uses an in-place upgrade model. The Platform CLI applies database schema migrations and then updates the running services. The upgrade panel in the admin UI provides status visibility and one-click triggering for installations that prefer a UI workflow.

Each release ships a `CHANGELOG.md` and a `BREAKING.md`. Read both before upgrading across major versions.

---

## Prerequisites

Before starting an upgrade:

- You are logged in as a user with the **installation_admin** or **installation_owner** role.
- You have a recent database backup (see [Backup and restore](#backup-and-restore)).
- The installation is not currently serving an active upgrade (check the admin upgrade panel).
- You have the new release archive or can reach the package registry.

---

## Upgrade procedure

### 1. Take a backup

Back up all databases before proceeding. The CLI does not take automatic backups.

```bash
# PostgreSQL
pg_dump -U postgres lighthouse > backup-$(date +%Y%m%d).sql

# MSSQL
# Use SQL Server Management Studio or sqlcmd with BACKUP DATABASE
sqlcmd -S localhost -Q "BACKUP DATABASE lighthouse TO DISK='C:\backups\lighthouse-$(Get-Date -Format yyyyMMdd).bak'"

# MongoDB
mongodump --db lighthouse --out /backups/lighthouse-$(date +%Y%m%d)
```

### 2. Install the new release

Download and extract the new release archive, or pull the updated package if you installed via npm:

```bash
# Extract release archive
tar -xzf lighthouse-studio-<version>.tar.gz -C /opt/lighthouse-studio

# Or update via npm (if installed that way)
npm install -g @lighthouse/studio@<version>
```

### 3. Run database migrations

The `migrate` subcommand applies any pending schema migrations. Run it before restarting services.

The `migrate` database user requires DDL privileges (CREATE, ALTER, DROP on the lighthouse schema). The standard `app` user is read/write only and will not be able to run migrations.

```bash
lighthouse upgrade migrate \
  --db-url "postgres://migrate:<password>@localhost/lighthouse"
```

For multi-database installations, repeat for each configured database:

```bash
# MSSQL
lighthouse upgrade migrate --db mssql \
  --db-url "mssql://migrate:<password>@localhost/lighthouse"

# MongoDB
lighthouse upgrade migrate --db mongo \
  --db-url "mongodb://migrate:<password>@localhost/lighthouse"
```

If migrations succeed, the CLI records a new entry in the `platform_versions` table.

### 4. Restart services

After migrations complete, restart the platform services:

**Linux (systemd)**

```bash
sudo systemctl restart platform-web platform-worker
```

**Windows (Service Manager)**

```powershell
Restart-Service platform-web
Restart-Service platform-worker
```

**Or use the CLI:**

```bash
lighthouse service restart --all
```

### 5. Verify

Navigate to `http(s)://<your-host>/admin/upgrade`. The version displayed should match the release you installed. All database connections should show a green status.

Run the post-upgrade smoke tests if your installation includes them:

```bash
lighthouse upgrade verify
```

---

## Rollback

If the upgrade fails or you need to revert:

### Roll back the version record

```bash
lighthouse upgrade rollback
```

This removes the latest entry from `platform_versions`. It does **not** revert database schema changes — for that, restore from backup.

### Restore from backup (full rollback)

```bash
# PostgreSQL
psql -U postgres lighthouse < backup-<date>.sql

# MSSQL
sqlcmd -S localhost -Q "RESTORE DATABASE lighthouse FROM DISK='C:\backups\lighthouse-<date>.bak'"

# MongoDB
mongorestore --db lighthouse /backups/lighthouse-<date>
```

Then reinstall the previous release binary and restart services.

---

## Downtime expectations

| Upgrade type         | Expected downtime        |
| -------------------- | ------------------------ |
| Minor release        | < 30 seconds (restart)   |
| Major release        | 1–5 minutes (migrations) |
| Schema-heavy release | Depends on data volume   |

Migrations run online where possible. The `BREAKING.md` for the release notes any migrations that require a maintenance window.

---

## Backup and restore

See [docs/runbooks/backup-and-restore.md](../runbooks/backup-and-restore.md) for detailed procedures.

---

## Troubleshooting

**Migrations fail with "permission denied"**
The `migrate` user needs DDL privileges on the database schema. Ensure the user has `CREATE`, `ALTER`, and `DROP` rights, or run migrations as the database superuser.

**Services fail to start after upgrade**
Check service logs: `journalctl -u platform-web -n 100` (Linux) or Event Viewer (Windows). Usually indicates a missing environment variable from the new release — consult `BREAKING.md`.

**Admin panel shows wrong version**
The version record may not have been written. Run `lighthouse upgrade status` to inspect. If the migration succeeded but the record is missing, run `lighthouse upgrade record --version <version>`.

**Upgrade stuck "in progress"**
If the upgrade process was killed mid-run, the in-progress flag may be stuck. Run `lighthouse upgrade reset-flag` to clear it, then verify the database state before re-running.
