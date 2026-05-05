# ADR-0136: Platform Version as a First-Class Concept

**Status:** Accepted
**Date:** 2026-05-05
**Objective:** 9.5 — Platform Upgrade & Versioning

---

## Context

The platform ships as a self-hosted binary. Customers upgrade on their own schedule. Without an explicit platform-version concept, there is no way to know what version a given database is at, whether an upgrade is needed, or whether the last upgrade succeeded.

Prior to this ADR, the platform had no mechanism to record "this database has been upgraded to version X". Schema migrations (via `__platform_migrations`) recorded schema state, but not release version. The two concerns are distinct: a schema migration is a DDL change; a release version is a business contract.

## Decision

The platform version is sourced from a single canonical location: the `version` field in the root `package.json`. At build time this is mirrored into `packages/core/src/platform/version.ts` as `PLATFORM_VERSION`.

Every active database maintains an append-only `platform_versions` table (PostgreSQL/MSSQL) or collection (MongoDB). Each row records:

- `release_version` — the semver string
- `applied_at` — when the upgrade ran
- `applied_by` — operator user ID (nullable; system for automated first-install)
- `schema_migration_high_water` — the highest migration name applied at this point

The `PlatformVersionPort` abstracts these reads and writes. One port; three adapters.

## Consequences

**Easier:**

- Operators can query `SELECT * FROM platform_versions ORDER BY applied_at DESC` to see the full history.
- The upgrade orchestrator has a clear source of truth for "what version is this DB at".
- Audit tools can correlate release versions with schema states.

**Harder:**

- Every upgrade must write a version row after all migrations succeed — this is a new mandatory step.
- Fresh installs must also write the initial row (wired into the installation onboarding flow).

**Rejected alternative:** Deriving version from the migration high-water mark. Rejected because migrations are a schema concept, not a release concept; two different releases could apply the same migration set.

---

_Decision made by: Theuns Barnardt, 2026-05-05_
