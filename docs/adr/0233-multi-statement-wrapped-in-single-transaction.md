# ADR-0233: Multi-Statement Write Queries Wrapped in a Single Transaction

**Status:** Accepted
**Date:** 2026-05-05

## Context

Users executing multi-statement write queries (e.g., updating several related tables) expect atomicity: either all statements succeed or none do. Without explicit transaction wrapping, a failure midway leaves the database in a partially-modified state.

## Decision

When the query classifier detects multiple write statements, the query console service:
1. Returns a `confirmation_required` response with `statementCount` and `affectedTables` before executing
2. Upon receipt of `confirmed: true`, wraps all statements in a single transaction on the database adapter
3. On any statement failure, rolls back the entire transaction and returns an error

For single-statement write queries, the same confirmation requirement applies (to prevent accidental execution) but transaction wrapping is implicit in the single statement.

Read-only queries (SELECT) are never wrapped in explicit transactions — the `readonly` role already prevents accidental mutations.

## Consequences

- Atomicity guarantee for multi-statement writes: partial failure rolls back cleanly
- Confirmation UX reduces accidental execution for all write queries
- Adapters must support transaction scoping — `PostgresRawQueryAdapter.execute()` uses `BEGIN`/`COMMIT`/`ROLLBACK` around multi-statement payloads
- The confirmation payload includes `affectedTables` from the classifier, giving users a chance to review before executing

## Alternatives Considered

**Require users to write their own BEGIN/COMMIT:** Rejected — too error-prone and inconsistent; users may not know the conventions for each database dialect.

**No wrapping, document the risk:** Rejected — partial failures are a serious data integrity risk.
