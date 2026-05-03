# ADR-0082: Pessimistic Locking via withLock

**Status:** Accepted
**Date:** 2026-05-02
**Objective:** 08-service-layer-architecture

---

## Context

The platform uses optimistic locking for all writes (every entity has a
`version` column; concurrent updates return `ConflictError`). This handles the
overwhelming majority of concurrency scenarios correctly.

A small class of operations cannot be resolved by retrying with an updated
version. These operations require a guarantee that no other process is executing
the same operation concurrently — for example, generating a globally-unique
sequence number where two concurrent generators must produce different values,
or a two-step prepare-confirm flow where the prepare result must be stable
until confirmed.

---

## Decision

A `LockPort` (defined in `packages/ports/persistence/src/lock.port.ts`) provides
a `withLock(key, work, opts?)` method. The key is an arbitrary string that names
the resource being locked. Implementations:

- **PostgreSQL**: advisory locks via `pg_try_advisory_lock` / `pg_advisory_unlock`.
  Lock key is a 31-bit djb2 hash of the string key.
- **MSSQL**: `sp_getapplock` with `Exclusive` mode and `Session` owner.
- **MongoDB**: TTL document in `_platform_locks` collection; lock is acquired by
  an atomic `insertOne`; duplicate key error indicates contention.

Rules for using `withLock`:

- **Hold only as long as needed.** Release immediately after the critical section.
- **Do not call external services inside the lock.** HTTP, email, AI calls that
  block inside a lock will exhaust the timeout and poison the lock.
- **Locks > 30 s emit a warning; > 5 min emit an error.** These thresholds
  signal a design problem — the critical section is too long.
- **Default timeout: 30 s.** `LockTimeoutError` is returned (not thrown) when
  the lock cannot be acquired within this window.

`withLock` is rare. If you find yourself using it often, reconsider the design.
Most scenarios are correctly served by optimistic locking.

---

## Consequences

**What becomes easier:**

- Operations that genuinely require serialization have a correct, adapter-native
  mechanism rather than ad-hoc workarounds.
- The `LockPort` interface is the same across all three databases; services
  use it without knowing the underlying mechanism.

**What becomes harder:**

- Lock timeout errors must be handled by callers — they are `Result<T, PersistenceError | LockTimeoutError>` so TypeScript enforces handling.
- String key hashing (Postgres) has collision potential for > ~10k distinct keys.
  In practice, lock keys are resource-scoped (`workspace:<id>:invoice-seq`) and
  collisions are negligible.

**Alternatives considered:**

- _Database-level row locks (SELECT FOR UPDATE)_ — rejected; requires a
  transaction wrapping the entire critical section, which we avoid for
  non-transactional operations.
- _Application-level mutex (in-process Map)_ — rejected; does not work across
  multiple process instances (worker, API, etc.).
- _Redis SETNX_ — rejected; not guaranteed available in all deployment
  topologies; the database is the only stateful store we can guarantee.
