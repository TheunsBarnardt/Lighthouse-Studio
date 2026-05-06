# ADR-0236: Optimistic Updates with User-Driven Conflict Resolution

**Status:** Accepted
**Date:** 2026-05-06
**Objective:** 18 (Data Browser & Editor)

---

## Context

Inline cell editing in the data browser should feel instant. The API uses optimistic locking (`_version` field on every row). When two users edit the same row concurrently, the second edit gets a 409 Conflict response. The UI must handle this gracefully — neither silently losing data nor leaving the user confused.

---

## Decision

**Optimistic updates:** The UI applies the new cell value locally before the API call completes. If the API succeeds, nothing more is needed. If it fails with a network error, the cell reverts and shows an error toast. If it fails with 409, the conflict resolution flow kicks in.

**Conflict resolution:** A modal dialog presents:

- The server's current value ("their value")
- The user's intended value ("your value")
- Three choices: Take theirs / Keep mine / Cancel (manual review)

The user makes a deliberate choice. No auto-merge. The winning choice is saved with the server's current `_version` so the save succeeds.

---

## Consequences

**What becomes easier:**

- Sub-100ms perceived latency for cell edits over typical network conditions.
- Users are never surprised — they explicitly chose how to resolve conflicts.
- Audit trail is clean: the final accepted value is the one written to the database.

**What becomes harder:**

- If two users edit the same row rapidly (race condition window), both may see conflicts. This is acceptable; conflicts are rare in practice.
- The modal interrupts flow. Users who work alone may never see it; collaborative workspaces will see it occasionally.

---

## Alternatives Considered

- **Last-write-wins (no conflict detection):** Fast but silently destroys data. Rejected: unacceptable data loss.
- **Auto-merge non-overlapping fields:** Appealing but fragile. Two users editing different fields of the same row still trigger a version mismatch. Auto-merge requires field-level versioning. Rejected: complexity not warranted for v1.
- **Lock the row while editing:** Prevents conflicts but breaks collaboration. Rejected: users editing slowly would block others indefinitely.
