# ADR-0139: Single Orchestrator Across Heterogeneous Databases

**Status:** Accepted
**Date:** 2026-05-05
**Objective:** 9.5 — Platform Upgrade & Versioning

---

## Context

The platform supports PostgreSQL, MSSQL, and MongoDB. A customer may use any combination. When upgrading, migrations must run on every active database. Multiple coordinators (one per DB) would require the operator to run separate commands and reason about cross-DB state.

## Decision

A single `UpgradeOrchestrator` coordinates upgrades across all configured databases. It:

1. Runs pre-flight checks per DB.
2. Triggers schema migrations per DB **in parallel**.
3. Records `platform_versions` rows **only after all migrations succeed** — all-or-nothing.
4. Emits a single set of audit events covering the full cross-DB operation.

The operator runs one command: `platform upgrade`. The orchestrator knows which databases are active from the environment configuration.

**Idempotency contract:** The orchestrator is safe to re-run after a partial failure. Migration adapters use checksum-based idempotency (`__platform_migrations` table), so re-running is a no-op for already-applied migrations. Version rows are only written if they don't yet exist for the current version.

**Failure semantics:** If Postgres succeeds but Mongo fails, no version row is written on either DB. The operator re-runs; Postgres's migrations are no-ops; Mongo retries.

## Consequences

**Easier:**

- One command for operators regardless of DB mix.
- The orchestrator's failure semantics are simple: partial success is never committed.

**Harder:**

- The orchestrator must know which databases are active (injected via environment).
- Per-DB failures must surface clearly (not hidden behind a single error code).

**Alternatives rejected:**

- **Per-DB upgrade commands**: Requires operators to orchestrate order and handle cross-DB state manually. Increases operator error surface.
- **Sequential migrations across DBs**: Slower than parallel; no meaningful benefit.

---

_Decision made by: Theuns Barnardt, 2026-05-05_
