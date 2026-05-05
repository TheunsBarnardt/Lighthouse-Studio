# Platform Upgrade Procedure

This runbook covers the standard upgrade procedure for both single-instance and HA deployments.

---

## Prerequisites

- You have the new release artifact deployed to the server(s).
- A recent backup exists for every active database (taken within the last 24 hours, or within your configured threshold).
- You have the `migrate` user credentials for all configured databases.
- You have reviewed `release-manifest.json` for `breakingMigrations` and `expectedDowntimeSeconds`.

---

## Single-instance upgrade

**Expected downtime:** As stated in `release-manifest.json` (`expectedDowntimeSeconds`).

### Steps

1. **Stop the platform service** to prevent new writes during migration.

   ```bash
   systemctl stop platform
   # or on Windows:
   # net stop platform
   ```

2. **Verify backup recency.**

   ```bash
   platform upgrade --dry-run
   ```

   This runs all pre-flight checks without making changes. Review the output for any failures.

3. **Run the upgrade.**

   ```bash
   platform upgrade --applied-by "operator@example.com"
   ```

   The orchestrator will:

   - Check the backup gate (fails if no recent backup — use `--skip-backup-check` with caution)
   - Run schema migrations on all active databases in parallel
   - Record the version on all databases after all migrations succeed
   - Run the post-upgrade health gate

4. **Start the platform service.**

   ```bash
   systemctl start platform
   # or on Windows:
   # net start platform
   ```

5. **Verify.**

   ```bash
   platform version
   ```

   Confirm the recorded version matches the code version on every database.

6. **Monitor** for 30 minutes post-upgrade: application errors, database errors, API response times.

---

## HA (multi-instance) upgrade

**Expected downtime:** None for non-breaking migrations. Maintenance window required for breaking migrations.

HA rolling upgrade runs one instance at a time. Instance A and B must be able to coexist on adjacent minor versions during the window.

### Steps

1. **Drain instance B** at the load balancer (stop sending new traffic to B; let existing connections finish).

2. **Stop the platform service on instance B.**

3. **Deploy the new release artifact to instance B.**

4. **Run the upgrade from instance B's host** (this applies migrations using B's database connections):

   ```bash
   platform upgrade --applied-by "operator@example.com"
   ```

   Migrations apply. Version rows are written. The schema is now at the new version.

5. **Start instance B** on the new version. Traffic is still going to A (old code, new schema).

   - A is still on the old version. This is safe because the schema changes are additive-only (ADR-0138).
   - A can read and write the new schema without issue.

6. **Verify instance B is healthy**: smoke test via its health endpoint, check logs.

7. **Drain instance A**, stop it, deploy new release, start it.

   ```bash
   # On instance A:
   systemctl stop platform
   # deploy new artifact
   systemctl start platform
   ```

   Instance A starts on the new code. Both A and B are now at the new version.

8. **Re-enable traffic to A** at the load balancer.

9. **Verify** both instances:

   ```bash
   platform version
   platform upgrade --status
   ```

---

## Breaking migrations (requires maintenance window)

If `release-manifest.json` lists any `breakingMigrations`, the upgrade requires `--allow-breaking`:

```bash
# Schedule a maintenance window first.
platform upgrade --allow-breaking --applied-by "operator@example.com"
```

Both instances must be on the same version before and after the breaking migration. Do not attempt a rolling upgrade for breaking releases — drain all instances first.

---

## Skipping multiple minor versions

If upgrading from v1.0.x to v1.3.x, the compatibility window (N-2 minor) requires an intermediate stop:

```bash
# First upgrade to v1.2.0 (deploy v1.2.0 artifact, run upgrade)
platform upgrade --applied-by "operator@example.com"

# Then upgrade to v1.3.0 (deploy v1.3.0 artifact, run upgrade again)
platform upgrade --applied-by "operator@example.com"
```

If you attempt too large a skip, the orchestrator will tell you the next eligible intermediate version.
