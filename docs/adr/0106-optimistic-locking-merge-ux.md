# ADR-0106: Optimistic Locking with Manual Merge UX

**Status:** Accepted  
**Date:** 2026-05-03

## Context

The schema designer allows editing a schema that is shared across a workspace. Multiple users (e.g., two workspace admins) could be editing the same schema simultaneously. If User A deploys while User B is mid-edit, User B's deploy should fail gracefully — not silently overwrite User A's changes.

We need a conflict detection mechanism that is:

1. Correct — no silent overwrites
2. Practical — doesn't require locking the schema or forcing real-time collaboration
3. Recoverable — the user can resolve conflicts without losing their work

## Decision

Use **optimistic locking** via a `version` integer on `CustomerSchema`. Every save/deploy operation sends the `expectedVersion` it was based on. The server increments `version` on every successful write and rejects requests where `expectedVersion !== currentVersion`.

On conflict (HTTP 409):

1. Show an error: "This schema was updated by [user] since you started editing (v4 → v5). Your changes are on v4."
2. Show a three-panel diff: **Current deployed (v5)** | **Your changes (based on v4)** | **Result**
3. Let the user choose: discard their changes (reload v5), force-overwrite (deploy from v4 anyway with a flag), or manually merge.

The Zustand store tracks `deployed` (last known server version) and `schema` (in-memory working copy). When the server returns a 409, the store fetches the current deployed version and presents the conflict UX.

## Consequences

**Benefits:**

- No locks held on the server; users can edit offline or without network for extended periods
- Conflict detection is deterministic and cheap (integer compare)
- The three-way diff UX lets users make informed decisions rather than losing work silently

**Drawbacks:**

- Conflicts are discovered at deploy time, not earlier. Users who work in parallel for extended periods may accumulate large conflicts.
- The merge UX is non-trivial to implement. The initial implementation shows the conflict and offers "discard mine" or "force-overwrite"; full three-way merge is a future enhancement.
- Force-overwrite (`overwrite: true`) bypasses the protection. It exists for emergencies but should not be the default.

## Alternatives Considered

**Last-write-wins:** No conflict detection; the last deploy wins. Rejected: silent data loss is unacceptable for schema changes which have production consequences.

**Pessimistic locking:** Lock the schema when a user opens it for editing. Rejected: impractical for a web UI (how long do you hold the lock? what if the browser closes?); blocks other users unnecessarily.

**Real-time collaboration (OT/CRDT):** Changes are merged in real time. Rejected: massive complexity, requires WebSocket infrastructure, and the use case (schema editing) is relatively low-frequency. Not worth the investment for v1.
