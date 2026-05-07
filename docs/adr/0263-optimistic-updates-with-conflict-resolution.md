# ADR-0263: Optimistic Updates with Conflict Resolution for the Data Browser

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 18 (Data Browser & Editor)

---

## Context

The data browser lets multiple users edit the same workspace data simultaneously. We need to decide the cell-editing UX under concurrent writes.

Two broad approaches:

1. **Pessimistic locking** — a user acquires an exclusive lock on a row before editing. Other users see the row as locked and cannot edit it until the first user saves or releases the lock.

2. **Optimistic concurrency** — any user can start editing immediately. When the save is submitted, the server compares the expected version against the actual version. If they differ, a conflict is returned and the user decides how to resolve it.

---

## Decision

Use **optimistic concurrency** with **manual conflict resolution**.

Each row carries a `version` integer. When a user edits a cell and commits, the client sends the original row version alongside the new value. If the server returns a `409 Conflict`, the UI shows a `ConflictResolutionDialog` presenting:

- **Their change** — what the other user saved (server's current value)
- **Your change** — the local draft value
- Two resolution buttons: **Keep mine** (force-save the local draft) and **Accept theirs** (discard the local draft)

No real-time collaboration (shared cursor, CRDT merge) is shipped in v1.

### Why not pessimistic locking?

- Locks complicate UX: users who navigate away without saving leave rows locked indefinitely.
- Locks require server-side lease management (heartbeat, timeout, cleanup on disconnect).
- In practice, simultaneous edits to the exact same cell are rare. The overhead of locking the common case to prevent the uncommon case is not justified in v1.

### Why not silent last-write-wins?

Silent overwrites lose data without warning. The platform stores customer data; silent data loss is unacceptable regardless of concurrency level.

---

## Consequences

**Positive:**
- No lock infrastructure — simpler server and client.
- Editors can work freely; only the rare true-conflict case requires a decision.
- The conflict dialog makes the data loss risk explicit and puts the user in control.

**Negative:**
- Two users editing the same cell in quick succession will see a conflict dialog. This is the correct behaviour, but users unfamiliar with optimistic concurrency may find it unexpected.
- Force-save ("Keep mine") writes over the other user's change. The overwritten value is captured in the audit log.

**Future:**
- Real-time awareness (showing which rows another user is currently editing) could reduce conflict frequency without requiring locks.
- CRDT-based merge for text fields is a possible future enhancement; the `version` field remains valid under that model.
