# Platform Upgrade: HA Version-Skew Handling

This runbook explains the rolling upgrade procedure and what happens during the version-skew window when two platform instances are on different versions.

---

## What is version skew?

During a rolling upgrade, instance A runs code version 1.0 while instance B runs code version 1.1. Both instances are connected to the same database, which is now at the 1.1 schema (after instance B ran the upgrade). This window — between upgrading B and upgrading A — is the version-skew window.

---

## What must be true during the skew window

The **additive-only schema change policy** (ADR-0138) ensures that:

- Instance A (v1.0 code) can read and write all rows in the v1.1 schema — because no columns were removed or renamed, and new columns are nullable or have defaults.
- Instance B (v1.1 code) can read rows written by A without errors — because new code is designed to handle missing optional fields gracefully.

**The skew window is bounded.** As soon as A is upgraded to v1.1, both instances are on the same schema and code version.

---

## Procedure

```
Load balancer → [Instance A v1.0] [Instance B v1.0]
                   ↓
Drain B:
Load balancer → [Instance A v1.0]   [Instance B: draining]
                   ↓
Upgrade B:        (run `platform upgrade` on B's connections)
Load balancer → [Instance A v1.0]   [Instance B v1.1]
               ←─ SKEW WINDOW ─────────────────────────→
                   ↓
Drain A:
Load balancer →   [Instance A: draining]   [Instance B v1.1]
                   ↓
Upgrade A:         (deploy new artifact, restart)
Load balancer → [Instance A v1.1] [Instance B v1.1]
               ←─ COMPLETE ───────────────────────────────→
```

---

## Duration guidelines

- Keep the skew window as short as possible. Don't leave A on the old version for more than one hour after B is upgraded.
- If a defect is discovered during the skew window, drain B (stop sending traffic), roll back B to v1.0, and assess whether a schema rollback is needed before re-attempting.

---

## Breaking migrations and version skew

Breaking migrations (ADR-0138) are incompatible with rolling upgrades. If the release contains `breakingMigrations: [...]`:

1. Drain **both** instances before running `platform upgrade --allow-breaking`.
2. The schema will break backward compatibility with v1.0 code.
3. Both instances must start on v1.1 before re-enabling traffic.

The orchestrator refuses breaking migrations without `--allow-breaking` to prevent accidental rolling upgrades with schema-breaking releases.

---

## Monitoring during the skew window

Watch for:

- Application errors from instance A related to missing or unexpected columns — indicates the schema change was not truly additive.
- Errors from instance B reading rows written by A — indicates the new code is not backward-compatible.
- Replication lag spikes — the migration may have caused table scans.

If any of these appear, roll back instance B immediately and investigate before proceeding.
