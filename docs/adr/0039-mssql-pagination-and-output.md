---
adr: 0039
title: MSSQL Pagination via OFFSET-FETCH and INSERT via OUTPUT
status: Accepted
date: 2026-05-02
deciders: Theuns Barnardt
---

## Context

T-SQL has two key dialect divergences from standard SQL that affect the repository adapter:

1. No `LIMIT n OFFSET m` — uses `OFFSET m ROWS FETCH NEXT n ROWS ONLY`
2. No `RETURNING *` clause — uses `OUTPUT INSERTED.*` into a table variable or directly

## Decision

**Pagination**: All `findMany` queries include `ORDER BY [id]` as a default (required for OFFSET-FETCH), and user-provided sorts append to it. The clause is: `OFFSET @__offset ROWS FETCH NEXT @__limit ROWS ONLY`.

**Returning inserted/updated rows**: `INSERT … OUTPUT INSERTED.* VALUES (…)` returns the full inserted row. `UPDATE … SET … OUTPUT INSERTED.* WHERE …` returns the updated row. No separate SELECT round-trip needed.

**Upsert**: Explicit `IF EXISTS … UPDATE … ELSE INSERT …` pattern inside a transaction with appropriate locking hints (UPDLOCK, SERIALIZABLE), NOT MERGE, due to known MERGE deadlock susceptibility under concurrent load.

## Consequences

- Every findMany query must include at least one ORDER BY column — ORDER BY [id] is the default
- The OUTPUT clause returns the row atomically; no TOCTOU window
- The IF-EXISTS upsert pattern is more verbose than MERGE but safer under concurrent load
