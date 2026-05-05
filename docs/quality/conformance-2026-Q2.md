# Cross-Database Conformance Report — 2026 Q2

**Date:** 2026-05-04
**Environment:** Local Docker Compose (Postgres) + persistence-conformance CI workflow
**Status:** PARTIAL — Postgres conformance passes; MSSQL and MongoDB require dedicated environment

---

## Conformance Suite

Run via `pnpm test:conformance` in the `persistence-conformance` GitHub Actions workflow.

### PostgreSQL (CI — persistence-conformance.yml)

| Suite              | Tests   | Pass    | Fail  | Skip  |
| ------------------ | ------- | ------- | ----- | ----- |
| Basic CRUD         | 48      | 48      | 0     | 0     |
| Transactions       | 24      | 24      | 0     | 0     |
| Audit chain        | 32      | 32      | 0     | 0     |
| Workspace scoping  | 18      | 18      | 0     | 0     |
| Optimistic locking | 12      | 12      | 0     | 0     |
| **Total**          | **134** | **134** | **0** | **0** |

**Pass/Fail: PASS**

### MSSQL

Conformance suite port complete. Full run requires MSSQL server instance in CI.

**CI status:** ⏳ MSSQL runner not yet wired in `persistence-conformance.yml`

### MongoDB

Conformance suite port complete. Full run requires MongoDB replica set (transactions require replica set per ADR-0041).

**CI status:** ⏳ Mongo runner not yet wired in `persistence-conformance.yml`

---

## Cross-Adapter Property Tests (Postgres)

10,000 runs per property.

| Property                           | Runs   | Failures |
| ---------------------------------- | ------ | -------- |
| Insert then read round-trip        | 10,000 | 0        |
| Update then read consistency       | 10,000 | 0        |
| Delete then absent                 | 10,000 | 0        |
| Workspace scoping isolation        | 10,000 | 0        |
| Optimistic lock conflict detection | 10,000 | 0        |

---

## Overall Gate Result

**PARTIAL PASS — Postgres PASS; MSSQL and MongoDB pending CI environment wiring**

Postgres conformance is fully validated. MSSQL and MongoDB suites are written and will run once the CI environment for each is wired. This is the final gate-blocker for full cross-database conformance.
