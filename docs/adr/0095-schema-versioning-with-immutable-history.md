# ADR-0095: Schema Versioning with Immutable History

**Status:** Accepted
**Date:** 2026-05-03
**Deciders:** solo

## Context

Customer schemas change over time. A customer defines a `users` table, then adds a `posts` table, then renames a column, then adds an index. Each of these changes touches the customer's live database. Without a version history:

- There is no record of what the schema looked like before a change
- Rollback requires the customer to reconstruct the prior state manually
- Audit queries cannot answer "what was the schema at this time?"
- Drift detection (schema in the database differs from the designer's view) cannot be attributed to a specific change

Schema changes also carry risk. A column drop with data in it is irreversible at the data level. An index creation on a large table can lock writes. A type change can truncate data. Without a preview of what will happen and a record of what happened, customers have no safety net.

## Decision

Every successful schema deployment creates an **immutable version record** in `customer_schema_versions`. The version system operates on these principles:

### Forward-only versioning

Versions are sequential integers starting at 1. They only go forward. There is no "editing" of history. A rollback to version N creates version N+1 (a new record) whose content matches the state at version N. The history is never mutated.

### Immutable snapshots

Each `customer_schema_versions` row stores a complete snapshot of the `CustomerSchema` JSON at that version — not a delta. This means:

- Any historical version can be reconstructed without replaying a chain of deltas
- Snapshots are larger than deltas but trivially readable and queryable
- There is no "snapshot + replay" complexity

### Optimistic locking at the schema document level

The `customer_schemas` table has a `current_version` integer. Updates require providing the expected version; if the version in the database differs, the update is rejected with a conflict error. This prevents two concurrent editors from silently overwriting each other.

### Rollback is a new version

Rollback does not delete or modify any version records. It produces a migration plan from the current schema state to the target version's state, applies it, and records the result as a new version with a `change_summary` of "Rolled back to version N". The `customer_schema_versions.rolled_back_at` timestamp marks which versions are no longer the deployed tip.

### Migration records separate from version records

`customer_schema_migrations` tracks execution — what plan ran, when, whether it succeeded. `customer_schema_versions` tracks state — what the schema looked like. These are separate concerns intentionally: a migration can fail partway through; the version record is only written on success.

## Consequences

**Positive:**

- Complete audit trail of all schema changes — who, when, what summary
- Rollback to any prior version is always available (though data recovery is a separate question)
- Concurrent edit conflict detection prevents silent data loss from race conditions
- Snapshot storage avoids delta-replay complexity

**Negative:**

- Each schema deployment writes a full JSON snapshot of potentially megabytes of schema definition — storage grows linearly with the number of deployments
- Retention policy for old versions is needed for long-lived workspaces (not implemented in this objective; deferred)

## Alternatives Considered

**Delta-based versioning (store only changes)**: rejected for the schema layer — the deltas would need to be a full-fidelity DSL (not just JSON diffs), and replaying a long chain is complex. Snapshot storage at this scale (schema JSON is measured in KB, not GB) is simpler.

**Schema version stored externally (e.g., in a VCS)**: rejected — the platform must be self-contained; not every customer has a git repository or VCS workflow. The version store is internal; export to git is an optional integration.
