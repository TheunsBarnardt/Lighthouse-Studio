# ADR-0010: Optimistic Locking by Default

**Status:** Accepted
**Date:** 2026-05-02
**Deciders:** solo (Theuns Barnardt)

## Context

The platform is multi-user. Two users editing the same record concurrently will produce a last-write-wins result unless the system detects and surfaces the conflict. Silent data loss is unacceptable, particularly in the schema designer and data management module.

## Decision

Every entity stored through `RepositoryPort` has an implicit version counter managed by the repository. The `update()` method accepts an optional `expectedVersion`:

```typescript
const result = await repo.update(id, changes, { expectedVersion: 3 });
// Returns ConflictError if the stored version is not 3
```

When `expectedVersion` is provided and does not match the stored version, the update returns `err(new ConflictError(...))`. The caller surfaces this to the user (conflict resolution flow, described in Objective 18).

When `expectedVersion` is omitted, the update proceeds without version checking (last-write-wins). This is intentional for internal system operations where conflict detection is not needed.

## Consequences

### Positive

- Concurrent edits by two users produce an explicit conflict rather than silent data loss.
- The version field is managed by the repository — entities do not need to include it in their type definitions.
- Optimistic locking scales better than pessimistic locking for the read-heavy workloads this platform expects.

### Negative

- Application code must track and pass versions — the entity must expose its current version to callers.
- Conflict resolution UX must be built (Objective 18); until then, conflicts surface as error messages.
- Some bulk operations cannot use `expectedVersion` efficiently; they must use explicit transaction isolation instead.

## Alternatives Considered

- **Pessimistic locking (SELECT FOR UPDATE)**: holds a database lock for the duration of the edit session. Rejected as impractical for web UIs where "sessions" last minutes.
- **No concurrency control**: last-write-wins. Rejected; silent data loss is unacceptable for the target enterprise use case.
- **Application-managed version field**: entities include `version: number` in their type. Rejected in favour of repository-managed versions to keep entity types clean.
