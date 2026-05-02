# ADR-0027: Soft Delete and Optimistic Locking by Default

**Status:** Accepted
**Date:** 2026-05-02
**Deciders:** solo

## Context

The platform manages enterprise data. Two cross-cutting concerns apply to virtually every entity:

1. **Deletion**: Hard deletes (physical removal) break audit trails, break foreign key references in audit log records, and make recovery impossible. Enterprises expect to "undelete" records.

2. **Concurrent editing**: Multiple users or background jobs may attempt to update the same record simultaneously. Without a concurrency control mechanism, the last write wins and intermediate updates are silently lost.

Both patterns must be consistent across all three databases (Postgres, MSSQL, MongoDB) because the platform presents a unified data model regardless of the underlying store.

## Decision

**Every platform entity table has:**

- `_archived_at TIMESTAMPTZ` — soft-delete column. `NULL` means live; non-null means archived.
- `_version INTEGER DEFAULT 1` — optimistic lock version. Incremented on every update.

These columns are part of `standardColumns` in `src/schema/_common.ts` and apply to all tables that spread this helper.

**Soft delete behaviour:**

- `archive(id)` sets `_archived_at = NOW()`. The row remains in the database.
- `findById`, `findMany`, `findOne`, and `count` exclude archived rows by default.
- Pass `{ includeArchived: true }` to `findMany` to query across all rows.
- `hardDelete` physically removes the row, logs at `warn` level, and requires an explicit call.

**Optimistic locking behaviour:**

- `update(id, changes, { expectedVersion: N })` appends `AND _version = N` to the WHERE clause.
- If zero rows match (either not found, or version mismatch), the adapter checks whether the row exists to distinguish `EntityNotFoundError` from `ConflictError`.
- The service layer surfaces conflicts to the UI, which offers a merge/reload flow.
- `update` always increments `_version` in the SET clause.

## Consequences

### Positive

- Audit trail integrity: deleted records are archived, not destroyed; audit log FK references never break.
- Conflict detection prevents silent data loss under concurrent edits.
- Recovery: an admin can unarchive rows by clearing `_archived_at`.
- Universal pattern: works on all three databases without dialect-specific syntax.

### Negative

- Tables grow indefinitely unless an archival/purge job runs periodically (planned as a background job).
- Every query incurs the overhead of `_archived_at IS NULL` in the WHERE clause. This is negligible with a functional index on `_archived_at` where `_archived_at IS NULL`.
- Hard delete is still possible (via `hardDelete`) but is a deliberate, logged action.

### Neutral

- The version column is an integer, not a timestamp. Two updates happening in the same millisecond get different versions; a timestamp would not catch this.
- `_version` starts at 1 on creation, so a new row has version 1. The first caller with `expectedVersion: 1` succeeds; a concurrent caller with the same expected version fails.

## Alternatives Considered

### Hard delete by default

Simple, but breaks audit trails and is unrecoverable. Not appropriate for enterprise data management.

### Pessimistic locking (SELECT FOR UPDATE)

Prevents conflicts by holding a row lock for the duration of a transaction. Works but reduces concurrency and is incompatible with PgBouncer transaction mode (which requires short-lived locks). Optimistic locking is better for read-heavy workloads.

### Event sourcing (append-only)

Maximum audit fidelity. Too complex for the initial version; deferred to a future objective.

## References

- ADR-0009: Soft Delete by Default
- ADR-0010: Optimistic Locking
- `packages/adapters/persistence-postgres/src/schema/_common.ts`
- `packages/adapters/persistence-postgres/src/repository.adapter.ts`
