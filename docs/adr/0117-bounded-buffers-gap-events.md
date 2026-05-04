# ADR-0117: Bounded Buffers with Gap Events

**Status:** Accepted
**Date:** 2026-05-04
**Deciders:** solo

## Context

A fast producer (a busy table generating 1000 inserts/second) writing to a slow consumer (a mobile client on a 3G connection) creates a backpressure problem. The server must decide what to do when events accumulate faster than the client consumes them.

Options:

1. **Buffer unbounded:** Hold all events in memory until the client catches up. Risk: OOM if the client is permanently slow or disconnected.
2. **Disconnect slow clients:** If the client falls behind, close the connection. Simple; harsh.
3. **Bounded buffer + drop oldest + notify:** Buffer up to N events. When full, drop the oldest and emit a `gap` event so the client knows it missed events.

## Decision

The platform uses **bounded buffers** with a **1000-event limit** per subscription, dropping oldest events and emitting a `gap` event when the buffer overflows.

The `gap` event carries:

- `kind: "gap"`
- `totalDropped`: cumulative count of events dropped for this subscription
- `position`: the latest known position (so clients can decide to re-snapshot)

Clients receiving a `gap` event have three options:

1. **Ignore:** Accept that some events were missed. Appropriate for activity feeds and non-critical UI.
2. **Re-snapshot:** Request the current state of the table (paginated query) and resume from there.
3. **Reconnect with snapshot mode:** Close the subscription and re-subscribe with `snapshot: true`.

The metric `platform_realtime_events_dropped_total` increments per drop. Customers can dashboard this and alert if their app is regularly dropping events.

## Consequences

**What becomes easier:**

- Server memory is bounded. No OOM risk regardless of subscriber speed.
- Clients are notified of gaps; they can make intelligent decisions about how to recover.
- The metric gives operational visibility into backpressure.

**What becomes harder:**

- Clients must handle `gap` events. The SDK (Objective 19) will abstract this; raw consumers must implement it.
- The 1000-event default may be too small for very bursty tables or too large for memory-constrained deployments. It is configurable per workspace.

## Alternatives Considered

**Unbounded buffer:** Risk of OOM under sustained backpressure. Rejected — server stability is non-negotiable.

**Disconnect slow clients:** Harsh and poor UX. Reconnect + re-snapshot is more expensive than buffering. Rejected as primary strategy; used as last resort only (e.g., if the client is completely unresponsive for 60 seconds, the idle-timeout fires).

**Pause the change stream for the slow subscriber:** This would block other subscribers sharing the same source stream (the in-process fan-out model means one slow consumer can't block the fan-out; it only blocks its own delivery slot). Technically possible but adds complexity for the same outcome as bounded buffers. Rejected.
