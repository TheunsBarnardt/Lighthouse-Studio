# ADR-0009: Soft Delete by Default

**Status:** Accepted
**Date:** 2026-05-02
**Deciders:** solo (Theuns Barnardt)

## Context

Deleting records permanently is dangerous: it breaks audit trails, breaks foreign key references in audit logs, and makes "undo" impossible. Most enterprise applications need to retain deleted records for compliance, debugging, and recovery.

## Decision

`RepositoryPort` provides two distinct operations:

- `archive(id)` — soft delete. Sets an `archivedAt` timestamp. The entity remains in the database. `findMany()` excludes archived entities by default; they can be included with `opts.includeArchived = true`.
- `hardDelete(id)` — permanent deletion. Allowed only via explicit policy (e.g., GDPR erasure requests, data expiry). Application code must explicitly call this; it is never the default.

All entities stored through the repository are implicitly archivable. The `archivedAt` field is managed by the repository implementation, not by the entity model.

## Consequences

### Positive

- Audit trails are never broken by accidental deletion.
- "Undo" operations are possible by un-archiving.
- Compliance requirements (data retention) are easier to satisfy.
- Debugging is easier: deleted records remain queryable by admins.

### Negative

- Tables grow larger over time; archival cleanup jobs must be managed explicitly.
- `findMany()` must include the `WHERE archived_at IS NULL` clause; adapters are responsible.
- Hard delete is needed for GDPR erasure; the two-method design makes this explicit.

## Alternatives Considered

- **Permanent deletion as default**: simpler but irreversible. Rejected given the compliance and audit requirements.
- **Separate archived table**: complex migrations, complicates foreign keys. Rejected.
- **Flag column `is_deleted`**: equivalent but less informative than a timestamp. The timestamp enables "deleted after date X" queries that are useful for audits.
