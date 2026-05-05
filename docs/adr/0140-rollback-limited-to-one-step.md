# ADR-0140: Rollback Limited to One Step

**Status:** Accepted
**Date:** 2026-05-05
**Objective:** 9.5 — Platform Upgrade & Versioning

---

## Context

When an upgrade fails or a defect is discovered post-upgrade, operators need a recovery path. In principle, rollback could be supported to any prior version. In practice, the further back a rollback goes, the more complex the `down` migration chain becomes and the harder it is to test.

## Decision

The orchestrator supports **one-step rollback** only:

- The most recent `platform_versions` row is removed.
- The corresponding migration's `down` script applies per database (if present).

For rollback further than one step, the operator must restore from backup. The orchestrator surfaces a clear error if `--rollback` is invoked when only one version is recorded (i.e., rolling back the initial install).

**MSSQL caveat:** MSSQL migrations currently have no `down` scripts (Obj 4a was up-only). On MSSQL, `--rollback` removes the version row but does not revert the schema. The CLI emits a warning. This will tighten when MSSQL down-migrations are added (tracked as a follow-up to Obj 4a).

## Consequences

**Easier:**

- The rollback test matrix is bounded: for each release, only test one-step rollback.
- The `down` migration requirement is scoped to the most recent migration, not all migrations ever written.

**Harder:**

- Operators who want to roll back multiple steps must use backup restore, which is slower and more disruptive.
- Documentation must clearly explain the limit and when to escalate to backup restore.

**Alternatives rejected:**

- **Full multi-step rollback**: Would require testing every possible rollback path, including across major versions. Not practical for the current team size.
- **No rollback at all**: Unacceptable for production operators; backups alone are insufficient for a quick recovery.

---

_Decision made by: Theuns Barnardt, 2026-05-05_
