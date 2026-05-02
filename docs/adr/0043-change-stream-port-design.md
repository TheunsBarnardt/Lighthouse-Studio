---
adr: 0043
title: ChangeStreamPort — AsyncIterable Interface and At-Least-Once Semantics
status: Accepted
date: 2026-05-02
deciders: Theuns Barnardt
---

## Context

Real-time data updates require a uniform interface for change events across all three databases. The interface must handle:

- Heterogeneous sources (logical replication, CDC polling, native change streams)
- Multiple concurrent subscribers
- Back-pressure (slow consumers)
- Resume after disconnect
- Schema evolution events

## Decision

`ChangeStreamPort.subscribe()` returns `AsyncIterable<ChangeEvent>`. Consumers use `for await … of`. Cancellation is via `break` or `.return()` on the iterator.

Semantics:

- **At-least-once delivery** — duplicates possible; subscribers must be idempotent
- **Per-key ordering preserved** — events for the same row arrive in order
- **Cross-key ordering not guaranteed** — especially in the MSSQL CDC polling adapter
- **Errors surfaced as `ErrorChangeEvent { fatal: true }`** — after which the iterable terminates naturally

The `resumeToken` field on each event is an opaque string that can be passed to a subsequent `subscribe({ resumeToken })` call to restart from that position.

## Consequences

- Subscribers need not handle exceptions from the iterable itself — errors arrive as events
- Buffer overflow triggers a `GapChangeEvent` — the consumer knows data was lost and must re-sync
- The in-process fan-out (`ChangeStreamFanout`) decouples the source connection from subscriber count
- Each process maintains one source connection per database; multiple subscribers share it
- Multi-process deployments result in each process having its own source connection (at-least-once is fine for this)

## Alternatives considered

- **EventEmitter**: Pull vs. push inversion; harder to compose; no built-in back-pressure
- **RxJS Observable**: Heavy dependency; more complex cancellation
- **Kafka/NATS integration**: Adds infrastructure dependency; deferred to a separate objective (message bus integration)
- **Exactly-once delivery**: Requires distributed coordination (sequence numbers + deduplication store); complexity not justified at this stage
