# ADR-0138: Additive-Only Schema Changes Within a Minor

**Status:** Accepted
**Date:** 2026-05-05
**Objective:** 9.5 — Platform Upgrade & Versioning

---

## Context

HA deployments run multiple platform instances. During a rolling upgrade, instance A runs v1.0 while instance B runs v1.1. Both must be able to read and write the same database schema simultaneously. This creates a version-skew window where N and N-1 must coexist.

## Decision

All schema changes within a minor version series must be **additive only**:

- ✅ ADD COLUMN (nullable or with a default)
- ✅ CREATE TABLE / CREATE INDEX
- ✅ ADD enum value (in databases that support it without a full rewrite)
- ❌ DROP COLUMN
- ❌ RENAME COLUMN
- ❌ ADD NOT NULL to an existing nullable column without a default
- ❌ REMOVE enum value
- ❌ Change a column's data type in a way that breaks existing readers

Breaking changes are only permitted in major version upgrades, which require an explicit maintenance window and operator consent (`--allow-breaking`).

The `release-manifest.json` for each release declares `breakingMigrations: []` (empty for additive-only releases) or lists migration names that are breaking. The orchestrator refuses to apply releases with non-empty `breakingMigrations` unless the operator passes `--allow-breaking`.

## Consequences

**Easier:**

- Rolling upgrades work without downtime for non-breaking releases.
- Operators can upgrade instance-by-instance in HA deployments.

**Harder:**

- Removing or renaming columns requires a multi-step process across major versions (first deprecate as nullable, then drop in the next major).
- Migration authors must be aware of this constraint and tag breaking migrations explicitly.

**Alternatives rejected:**

- **Requiring full downtime for every upgrade**: Too disruptive for HA customers.
- **Zero-downtime for breaking changes via expand-contract patterns**: Valid but complex and out of scope for v1; deferred to a future objective if demand materialises.

---

_Decision made by: Theuns Barnardt, 2026-05-05_
