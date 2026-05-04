# Runbook: Real-Time Buffer Overflows

## Symptoms

- `platform_realtime_events_dropped_total` counter increasing.
- Clients receiving `gap` events with `totalDropped > 0`.
- Client application state diverging from database state (missed updates).

## Likely Causes

1. **Slow consumer** — client application can't process events fast enough (e.g., doing synchronous UI re-renders per event).
2. **Very bursty table** — a batch import, data migration, or bulk delete generating thousands of events in seconds.
3. **Low buffer limit** — the default 1000-event buffer is too small for the table's write rate at peak.
4. **Network issue** — client connection has high latency or low bandwidth; the delivery queue grows.

## Investigation Steps

```bash
# Find subscriptions with the most drops
grep 'realtime.events_dropped' /var/log/platform/app.log | jq '{subscriptionId: .subscriptionId, dropped: .totalDropped}' | sort -t: -k2 -rn | head -20

# Check the table that's generating events
grep 'realtime.events_dropped' /var/log/platform/app.log | jq -r '.table' | sort | uniq -c | sort -rn

# Check if it's a batch operation (short spike vs. sustained)
grep 'realtime.events_dropped' /var/log/platform/app.log | jq -r '.occurredAt' | head -50
```

## Mitigation

1. **Slow consumer:** Advise the client to batch UI updates (debounce or throttle). The SDK provides a `batchInterval` option to collect N events before emitting to the UI.
2. **Bursty table:** If the burst is a one-time data migration, no action needed. For recurring bursts, consider:
   - Increasing the buffer limit per subscription via workspace settings.
   - Filtering the subscription to only the operations the client needs (e.g., `operations: ['insert']` if deletes during the migration aren't relevant).
3. **Low buffer limit:** Adjust `REALTIME_DEFAULTS.BUFFER_SIZE` via workspace config. Note: larger buffers increase memory usage proportionally to the number of active subscriptions.
4. **Network issue:** Nothing to do server-side; the buffer absorbs the network delay. If the delay exceeds the buffer capacity, the client receives `gap` events. Advise the client to check network quality.

## Client Recovery

When a client receives a `gap` event:

1. The client should call the REST API to fetch the current state of the affected table.
2. Re-subscribe from the current position (the `gap` event includes the latest `position`).

The official SDK handles this automatically when `autoRecover: true` is set (the default).
