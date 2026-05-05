# Platform Upgrade Rollback

This runbook covers rolling back a failed or problematic upgrade.

---

## When to use rollback

- The upgrade completed but a critical defect was discovered immediately post-upgrade.
- The post-upgrade health gate failed and the platform is in a degraded state.
- An operator error occurred and the upgrade is in an inconsistent state.

**Do NOT use rollback for:**

- Rollback more than one version — see "Multi-step rollback via backup restore" below.
- When data has already been written in the new schema that is incompatible with the old code.

---

## One-step rollback

```bash
platform upgrade --rollback --applied-by "operator@example.com"
```

The orchestrator will:

1. Identify the latest version row on all configured databases.
2. Remove that row from all databases.
3. Apply the `down` migration script for the most recent migration (if present).
4. Emit a `platform.upgrade.rolledback` audit event.

### Verifying rollback

```bash
platform version
```

The recorded version should now be the previous version on all databases.

### MSSQL warning

If MSSQL is configured, the version row is removed but the schema is **not** reverted (MSSQL down-migrations are pending — tracked as a follow-up to Objective 4a). The CLI will emit:

```
⚠  MSSQL schema was not reverted (no down-migrations). Version row removed only.
```

Assess whether this leaves MSSQL in an inconsistent state. If the new schema is additive-only (the normal case for minor releases), the old code can still read the database safely.

---

## When rollback is not available

Check `release-manifest.json`:

```json
{ "rollbackSupported": false }
```

If `rollbackSupported` is false, the upgrade had no `down` migration and rollback is not safe. You must restore from backup.

---

## Multi-step rollback via backup restore

If you need to go back more than one version, or if the one-step rollback failed:

1. Stop all platform instances.
2. Restore the database backup from before the first problematic upgrade.
3. Deploy the target (older) platform artifact.
4. Start the platform.
5. Run `platform version` to confirm the recorded version matches.

See the backup restore runbook for database-specific restore procedures.

---

## After rollback

1. File an incident report explaining what went wrong.
2. Identify whether the defect is in the migration, the application code, or the upgrade process.
3. Fix forward (create a new migration or patch release) rather than attempting multiple rollbacks.
