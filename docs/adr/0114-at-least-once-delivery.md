# ADR-0114: At-Least-Once Delivery with Idempotent Consumer Contract

**Status:** Accepted
**Date:** 2026-05-04
**Deciders:** solo

## Context

Real-time subscriptions deliver database change events. The question is: what delivery guarantee does the platform provide?

- **At-most-once:** Events may be dropped; no retries. Simple but lossy.
- **At-least-once:** Events are delivered one or more times. The consumer must handle duplicates. This is the standard for CDC (change data capture) systems.
- **Exactly-once:** Each event delivered exactly once. Requires distributed coordination (two-phase commit, idempotent message IDs, deduplication tables). Very expensive to implement correctly at scale.

The underlying change streams (Postgres logical replication, MSSQL CDC, MongoDB change streams) all provide at-least-once semantics. Building exactly-once on top would require tracking every delivered event ID per subscriber and deduplicating — a significant distributed systems problem.

## Decision

The platform delivers events **at-least-once**. Consumers are expected to be idempotent.

Duplicates can occur in these scenarios:

- Client reconnects with a resume token and a small window of events is replayed from before the last acknowledged position.
- A platform instance restarts mid-stream and replays from its last checkpoint.

Consumers deduplicate by row identity (primary key + position or a monotonic version column). The platform documentation makes this contract explicit.

## Consequences

**What becomes easier:**

- The platform does not need to maintain a delivered-event log per subscriber.
- Resume-after-disconnect is simply "replay from last known position" — safe under at-least-once.
- Retry on transient errors is safe.
- Scales to many concurrent subscribers without per-subscriber state explosion.

**What becomes harder:**

- Consumers must handle duplicate events. For most applications (UI updates, cache invalidation, activity feeds), this is trivial: applying the same row state twice is idempotent.
- Consumers that trigger side effects (send email, charge a payment) on change events must themselves deduplicate. This is standard practice in event-driven systems.

## Alternatives Considered

**Exactly-once:** Would require a distributed deduplication store (Redis or Postgres table) per subscriber. The complexity cost is not justified for a v1 feature where the primary consumers are UI clients and lightweight server workers. Can be added in a future objective if demand emerges.

**At-most-once:** Unacceptable for subscriptions used to drive UI state. A dropped event leaves the UI out of sync permanently (until the next explicit refresh). Rejected.
