# Cross-Database Conformance Report

**Date:** YYYY-MM-DD
**Environment:** clean staging (fresh containers for each adapter)
**Status:** PENDING — gate not yet run

---

## Conformance Suite Run

Command:

```sh
pnpm test:conformance --numRuns=10000
```

### PostgreSQL

| Suite                    | Tests | Pass | Fail | Skip | Skip Reason |
| ------------------------ | ----- | ---- | ---- | ---- | ----------- |
| Basic CRUD               | —     | —    | —    | —    | —           |
| Transactions             | —     | —    | —    | —    | —           |
| Audit chain              | —     | —    | —    | —    | —           |
| Change streams           | —     | —    | —    | —    | —           |
| Schema introspection     | —     | —    | —    | —    | —           |
| Cross-adapter properties | —     | —    | —    | —    | —           |
| **Total**                | —     | —    | —    | —    |             |

**Pass/Fail:** PENDING

### MSSQL

| Suite                    | Tests | Pass | Fail | Skip | Skip Reason |
| ------------------------ | ----- | ---- | ---- | ---- | ----------- |
| Basic CRUD               | —     | —    | —    | —    | —           |
| Transactions             | —     | —    | —    | —    | —           |
| Audit chain              | —     | —    | —    | —    | —           |
| Change streams           | —     | —    | —    | —    | —           |
| Schema introspection     | —     | —    | —    | —    | —           |
| Cross-adapter properties | —     | —    | —    | —    | —           |
| **Total**                | —     | —    | —    | —    |             |

**Pass/Fail:** PENDING

### MongoDB

| Suite                    | Tests | Pass | Fail | Skip | Skip Reason |
| ------------------------ | ----- | ---- | ---- | ---- | ----------- |
| Basic CRUD               | —     | —    | —    | —    | —           |
| Transactions             | —     | —    | —    | —    | —           |
| Audit chain              | —     | —    | —    | —    | —           |
| Change streams           | —     | —    | —    | —    | —           |
| Schema introspection     | —     | —    | —    | —    | —           |
| Cross-adapter properties | —     | —    | —    | —    | —           |
| **Total**                | —     | —    | —    | —    |             |

**Pass/Fail:** PENDING

---

## Cross-Adapter Property Tests

10,000 runs per property. Any equivalence failure is a gate-blocker.

| Property                           | Runs   | Failures | Pass/Fail |
| ---------------------------------- | ------ | -------- | --------- |
| Insert then read round-trip        | 10,000 | —        | PENDING   |
| Update then read consistency       | 10,000 | —        | PENDING   |
| Delete then absent                 | 10,000 | —        | PENDING   |
| Audit event emitted on write       | 10,000 | —        | PENDING   |
| Workspace scoping isolation        | 10,000 | —        | PENDING   |
| Optimistic lock conflict detection | 10,000 | —        | PENDING   |

---

## Capability Matrix Snapshot

Committed at: `docs/quality/capability-matrix-YYYY-MM-DD.md`

Any capability change since last run: (document here)

---

## Drift Detection

| Check                                                | Status  |
| ---------------------------------------------------- | ------- |
| No new skipped tests without declared capability gap | PENDING |
| Capability matrix matches current adapter behavior   | PENDING |
| No test ordering dependencies detected               | PENDING |

---

## Overall Gate Result

**PENDING**

All conformance tests pass or are skipped due to declared capability gap. All cross-adapter property tests pass.
