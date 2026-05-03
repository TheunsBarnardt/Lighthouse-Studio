# ADR-0083: MSSQL `_version` as INT, not ROWVERSION

**Status:** Accepted
**Date:** 2026-05-03
**Deciders:** solo

## Context

Objective 04a originally locked the optimistic locking column for the MSSQL adapter as MSSQL's native `rowversion` type. The rationale was idiomatic MSSQL usage and engine-managed auto-increment.

When the adapter was implemented (commits leading up to this ADR), the column was instead defined as `[_version] INT NOT NULL DEFAULT 1`, mirroring the Postgres adapter (`_version` integer) and the MongoDB adapter (`_version` integer). The original locked decision did not anticipate the cross-database conformance contract introduced in Objective 04c, which requires the optimistic-lock token to be observable as a comparable, portable value across all three adapters.

This ADR documents the actual decision and supersedes the locked decision in `objectives/04a-database-mssql.md` Section 3 row "Optimistic locking".

## Decision

The MSSQL adapter uses `[_version] INT NOT NULL DEFAULT 1`, incremented atomically on every UPDATE (`SET [_version] = [_version] + 1 WHERE ... AND [_version] = @expectedVersion`). The WHERE clause performs the optimistic-lock check; SQL guarantees the UPDATE-WHERE pair is atomic, so no race window exists.

The `rowVersionToToken` and `tokenToRowVersion` helpers in `packages/adapters/persistence-mssql/src/mapper.ts` remain in the codebase because they are exported public API and may have external consumers. They are not used by the platform's repository adapter and may be removed in a later cleanup ADR.

## Consequences

### Positive

- **Cross-database equivalence.** The version field has the same type (`number`) and semantics across Postgres, MSSQL, and MongoDB, simplifying the cross-adapter conformance suite (Objective 04c) and the `RepositoryPort` contract.
- **No boundary serialisation.** Services treat `_version` as `number` everywhere; there is no per-adapter conversion at the port boundary. ROWVERSION would have required base64-encoding an 8-byte Buffer at every read and decoding it on every write.
- **Finer control over what bumps the version.** ROWVERSION auto-increments on any row change including computed columns and rollbacks. INT-based version only changes when the application explicitly increments it during an UPDATE — which makes the contract explicit and matches the platform's "version reflects logical state changes" semantic.
- **Simpler conformance testing.** Property-based tests can generate `version: number` test inputs uniformly across adapters.

### Negative

- **Loses MSSQL-engine-native idiomatic locking.** A DBA familiar with MSSQL might expect to see ROWVERSION on a versioned table. This is a documentation problem more than a correctness one — the platform is portable across three databases, so MSSQL idioms are deliberately not the dominant influence.
- **The application must remember to bump `_version` on every UPDATE.** The repository adapter does this consistently in `repository.adapter.ts`. Custom raw SQL writes that bypass the adapter would need to do the same; this is enforced by code review and by `eslint-plugin-platform`'s discouragement of raw queries outside the adapter package.

### Neutral

- ROWVERSION mapper helpers (`rowVersionToToken`, `tokenToRowVersion`) are dead code from the platform's perspective but remain exported. A follow-up cleanup ADR may remove them after a deprecation window.

## Alternatives Considered

### ROWVERSION (the originally locked decision)

Use MSSQL's native `rowversion` type; engine auto-increments on any row change; `_version` becomes a Buffer (8 bytes) returned as base64 at the port boundary.

**Pros:** Idiomatic MSSQL; engine-managed, can't be forgotten; finer detection of any row change.

**Cons:** Breaks cross-database equivalence (different type from Postgres/Mongo); requires Buffer↔base64 conversion at every boundary; conformance tests have to special-case MSSQL; ROWVERSION's "anything changed" semantic is too permissive for some platform invariants where only explicit version-bumps should signal a logical update.

Rejected because cross-database parity outweighs MSSQL idiomatic preference.

### Hybrid (ROWVERSION + a separate platform `_version` INT)

Store both: ROWVERSION for engine-level concurrency detection, INT for portable application-level versioning.

**Pros:** Best of both worlds in theory.

**Cons:** Two columns conveying overlapping concepts; doubles the bookkeeping; a contributor would have to know which one is authoritative for which check. Rejected as unnecessary complexity.

## References

- `objectives/04a-database-mssql.md` Section 3 (the original locked decision being superseded)
- `objectives/04c-cross-database-conformance.md` (the cross-DB parity requirement that motivated the change)
- ADR-0010 (Optimistic Locking — original platform-wide pattern)
- ADR-0027 (Soft Delete and Optimistic Locking)
- ADR-0048 (Cross-Database Conformance Strategy)
- `packages/adapters/persistence-mssql/src/repository.adapter.ts` (the implementation)
