# ADR-0068: Hash-Chained Audit Log

**Status:** Accepted
**Date:** 2026-05-02
**Deciders:** solo

## Context

The platform needs an audit log that compliance auditors, security teams, and enterprise customers can trust. The basic concern is: how does a customer know that the audit log hasn't been modified after the fact?

Three threat scenarios drive the requirement:

1. **A compromised application account** writes fraudulent audit entries to cover its tracks.
2. **An insider** with database access deletes rows that would incriminate them.
3. **Storage corruption** silently alters audit data without anyone noticing.

A flat audit table with no integrity mechanism is detectable after the fact only if you have an external reference. A hash chain — where each event cryptographically commits to the previous event — makes modification detectable by re-verifying the chain. Any modification (insert, delete, update) breaks the chain at the point of modification.

Additional constraints:

- The platform supports three databases (PostgreSQL, MSSQL, MongoDB) with different atomic primitives.
- Hash chain computation must not become a global serialization bottleneck — concurrent writes to different workspaces must not contend.
- Hash computation must be deterministic across databases (same inputs → same hash).

## Decision

Use a **per-workspace SHA-256 hash chain** for the audit log.

**Chain structure:**

- Each workspace has an independent chain. Events are sequenced per-workspace with a monotonically increasing `sequence` number.
- Each event includes `prev_hash` (hash of the previous event in the same workspace chain) and `hash` (hash of this event's content plus `prev_hash`).
- The first event in a workspace's chain uses `GENESIS_HASH = '0'.repeat(64)` as `prev_hash`.
- Installation-level events (no workspace) use a sentinel workspace ID (`00000000-0000-0000-0000-000000000000`) and their own independent chain.

**Hash computation:**

- Inputs: `eventType`, `workspaceId`, `actorKind`, `actorId`, `resourceType`, `resourceId`, `action`, `outcome`, `correlationId`, `sequence`, `occurredAtMs` (epoch milliseconds, not ISO string), `prevHash`.
- Serialized as canonical JSON (deterministic key order), hashed with SHA-256, output as lowercase hex.
- Timestamps are stored as epoch milliseconds to avoid floating-point and timezone round-trip differences across databases.

**Chain state:**

- A separate `audit_chain_state` table/collection stores `last_sequence` and `last_hash` per workspace.
- On each event write: atomically read-and-increment `last_sequence`, read `last_hash`, compute new hash, insert event, update `last_hash`.
- Per-database atomicity: PostgreSQL uses `UPDATE ... RETURNING`; MSSQL uses `UPDATE ... OUTPUT`; MongoDB uses `findOneAndUpdate` inside a transaction.

**Verification:**

- `verifyChain(workspaceId)` re-reads all events in sequence order, recomputes hashes, and reports the first mismatch.
- Verification is a read-only operation safe to run against live data.
- A quarterly integrity drill is documented in the operational runbooks.

## Consequences

### Positive

- Any modification to audit data is detectable by re-running `verifyChain`.
- Per-workspace chain isolation means workspace A's verification doesn't require workspace B's data, and concurrent inserts to different workspaces don't contend.
- SHA-256 is widely supported, not deprecated, and accepted in compliance contexts (SOC 2, HIPAA, FedRAMP).

### Negative

- Within a single workspace, audit writes are serialized (chain state update is a serialization point). This is acceptable because workspace-level audit activity is bursty but not highly concurrent.
- Verification is O(n) in chain length — expensive for long-lived, high-activity workspaces. Quarterly drills are the intended cadence; not meant for real-time verification.
- The chain is **tamper-evident, not tamper-proof**. A database admin with full credentials can rewrite events and recompute hashes. Cold archival (ADR-0074) provides tamper-proof guarantees for customers who require them.

### Neutral

- Hash algorithm is SHA-256 by default. A configurable alternative (SHA-3, BLAKE3) can be added if a specific customer demands it; the chain must be restarted on algorithm change.
- The chain's `initialization_seed` (random per-workspace, stored in `audit_chain_state`) is never exposed to callers. It seeds the genesis hash and makes rainbow-table attacks against the chain computationally harder.

## Alternatives Considered

### Option A: No tamper evidence (flat append-only table)

Simpler to implement; relies entirely on database-level append-only permissions (ADR-0069) for integrity. Would not survive direct database access by a malicious insider. Rejected because enterprise security teams require tamper-evidence; "we have permissions set right" is not a sufficient answer.

### Option B: Single global chain (all workspaces in one sequence)

Simpler verification; every event globally ordered. Rejected because it creates a global serialization point — all audit writes across all workspaces compete for the same chain state lock. Unacceptable for multi-tenant performance.

### Option C: External audit service (write-once log store like AWS CloudTrail)

Would provide stronger guarantees. Rejected because the platform is self-hosted; introducing a required external dependency defeats the self-hosted value proposition. Cold archival (opt-in, ADR-0074) is the path to stronger guarantees for customers who want them.

## References

- [ADR-0069: Append-Only Database Permissions](./0069-append-only-database-permissions.md)
- [ADR-0074: Cold Archive as Optional](./0074-cold-archive-as-optional.md)
- `packages/ports/audit/src/hash.ts` — canonical hash implementation
- `packages/adapters/audit-postgres/src/audit.adapter.ts` — chain state management
- `docs/runbooks/audit-chain-integrity-drill.md`
- `docs/runbooks/audit-storage-corruption.md`
