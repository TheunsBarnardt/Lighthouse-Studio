# ADR-0141: Release Manifest Format

**Status:** Accepted
**Date:** 2026-05-05
**Objective:** 9.5 — Platform Upgrade & Versioning

---

## Context

The upgrade orchestrator needs to know, at upgrade time, whether the target release contains breaking migrations, what the minimum previous version is (for compatibility window enforcement), and how much downtime to advertise to operators. This information cannot be inferred from the migrations themselves without executing them.

## Decision

Every release ships a `release-manifest.json` at the repo root. The format:

```json
{
  "version": "1.2.0",
  "minPreviousVersion": "1.0.0",
  "breakingMigrations": [],
  "expectedDowntimeSeconds": 30,
  "rollbackSupported": true
}
```

Fields:

- **`version`**: The release version (must match `package.json`).
- **`minPreviousVersion`**: The oldest version that can upgrade directly to this release. Enforces the compatibility window at a per-release granularity.
- **`breakingMigrations`**: Names of migrations tagged as breaking. If non-empty, the orchestrator requires `--allow-breaking`.
- **`expectedDowntimeSeconds`**: Advisory; surfaced to operators in the UI confirmation dialog.
- **`rollbackSupported`**: Whether `--rollback` is supported for this release. Set to `false` if down-migrations are missing.

The manifest is **bundled with the release artifact** (not fetched from a remote URL). This keeps upgrades fully air-gapped and avoids a phone-home dependency. Operators who need post-release patches to the manifest must rebuild from the patched source.

The orchestrator validates the manifest against a Zod schema on startup and refuses to proceed if the manifest is malformed or the `version` field does not match the code version.

## Consequences

**Easier:**

- Operators get human-readable upgrade metadata before committing to an upgrade.
- CI can validate the manifest as part of the release pipeline.
- No network dependency for upgrade checks.

**Harder:**

- If a manifest contains a mistake (wrong `minPreviousVersion`), a re-release is required; there is no post-release patch path without a new build.
- Operators cannot check for available upgrades without out-of-band communication (e.g., checking the release notes).

**Alternatives rejected:**

- **Remote manifest over HTTPS**: Simpler to patch post-release, but introduces a phone-home dependency. The platform's self-hosting thesis requires air-gap support. Opt-in telemetry is a separate, configurable feature.
- **Deriving upgrade metadata from migrations**: Requires parsing and executing migration files, which is complex and error-prone.

---

_Decision made by: Theuns Barnardt, 2026-05-05_
