# ADR-0231: AST Parsing for Query Classification

**Status:** Accepted
**Date:** 2026-05-05

## Context

The query console must classify queries as read-only, DML, or DDL before executing them. Naive regex approaches (e.g., checking for `INSERT`, `UPDATE`, `DELETE` strings) fail on edge cases: commented-out keywords, string literals containing SQL keywords, CTEs with DML in the body, and more.

## Decision

Use AST parsers for query classification:

- **PostgreSQL:** `pg-query-emscripten` (WebAssembly port of the real Postgres parser) — produces an exact AST that matches the actual Postgres query planner's interpretation
- **MSSQL / T-SQL:** `node-sql-parser` with `dialect: 'transact-sql'` — covers the common T-SQL statement set
- **MongoDB:** JSON parsing of the pipeline array; stage names (`$out`, `$merge`, etc.) are inspected directly

The classifier returns: `isReadOnly`, `containsDdl`, `statementCount`, `affectedTables`, `parameterNames`.

## Consequences

- Correct classification of edge cases: `WITH ... DELETE`, `INSERT ... SELECT`, CTEs, subqueries
- `pg-query-emscripten` ships as a WASM binary (~2MB); acceptable for a server-side-only dependency
- Classification happens before any DB connection is made — parse errors surface as `VALIDATION` errors with the problematic query, not as DB errors
- `node-sql-parser` does not support all T-SQL syntax; unknown constructs are treated conservatively as "not read-only"

## Alternatives Considered

**Regex keyword scanning:** Rejected — too many false positives and false negatives, especially for CTEs and nested statements.

**Parse on the database side (EXPLAIN only):** Rejected — requires a DB round-trip before classifying; slower and ties classification to a live connection.
