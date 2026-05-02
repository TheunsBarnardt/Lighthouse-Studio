---
adr: 0047
title: Change Stream Fan-out — In-Process Bounded Buffer per Subscriber
status: Accepted
date: 2026-05-02
deciders: Theuns Barnardt
---

## Context

Multiple consumers need to subscribe to the same change stream (e.g. real-time table viewer, audit log forwarder, webhook dispatcher). We need a fan-out mechanism that doesn't require one database connection per subscriber.

## Decision

One source stream (replication slot / CDC poller / MongoDB cursor) per process. The `ChangeStreamFanout` class distributes events to all subscribers using a bounded in-memory buffer per subscriber.

When a subscriber's buffer overflows (subscriber too slow):

- The oldest event is dropped from the buffer
- A `GapChangeEvent` is queued for that subscriber (with `droppedCount`)
- The subscriber knows it must re-sync from the source

This is the "drop" strategy over the "block" strategy: the source never blocks waiting for a slow subscriber.

Default buffer size: 1 000 events per subscriber. Configurable per subscription.

## Consequences

- Slow subscribers don't slow down fast subscribers or the source reader
- Slow subscribers see gap events and must handle re-sync
- For most platform use cases (real-time UI, webhook dispatch) occasional gaps are acceptable — the UI shows "reconnecting…" and re-fetches
- The platform's SLO includes a metric for buffer overflow frequency; sustained overflows are a scaling signal
- Multi-process deployments: each process has its own fan-out and its own source connection — at-least-once semantics means the same event may be delivered to multiple processes, which is correct behavior

## Alternatives considered

- **Shared memory / IPC between processes**: Complex; not cross-platform; rejected for v1
- **Message broker (Redis, NATS)**: Would work well, but adds infrastructure dependency; deferred to a future objective
- **Unbounded buffer**: Risk of OOM if subscriber is consistently slow; rejected
- **Block source on slow subscriber**: Fan-out latency grows with slowest subscriber; one misbehaving consumer can stall the entire stream; rejected
