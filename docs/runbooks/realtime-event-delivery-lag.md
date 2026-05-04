# Runbook: Real-Time Event Delivery Lag

## Symptoms

- `platform_realtime_event_delivery_lag_seconds` p95 > 2 seconds under normal load.
- Clients report events appearing "late" compared to database writes.
- Warning logs: `realtime.slow_delivery` (lag > 5s) or errors (lag > 30s).

## Likely Causes

1. **Slow change stream from the database** — Postgres logical replication, MSSQL CDC, or MongoDB change streams are backed up.
2. **Slow `EventFilterPipeline`** — permission checks or PII redaction taking too long (slow `AuthorizationPort` response).
3. **Slow subscribers holding up fan-out** — one slow consumer building up a large buffer.
4. **High event volume overwhelming the in-process fan-out** — too many events/second for the number of CPU cores.
5. **Event loop saturation** — other platform components consuming the event loop thread.

## Investigation Steps

```bash
# Check change stream lag (time from DB write to platform receipt)
grep 'realtime.change_stream_event' /var/log/platform/app.log | jq '{lag: (.occurredAt | fromdateiso8601) - (.receivedAt | fromdateiso8601)}' | jq -s 'add / length'

# Check permission cache hit rate
grep 'permission_cache' /var/log/platform/app.log | jq -r '.hit' | sort | uniq -c

# Check buffer sizes
# Use metrics: platform_realtime_buffer_used gauge

# Check for slow auth port
grep 'authz.authorize' /var/log/platform/app.log | jq '.durationMs' | jq -s 'add / length'
```

## Mitigation

1. **Change stream lag:** Check database replication health. For Postgres, check `pg_replication_slots` for slot lag. For MSSQL, check CDC latency. For MongoDB, check oplog lag.
2. **Slow permission checks:** If `AuthorizationPort` is slow (> 10ms per call), the permission cache will still take 30 seconds × N events/second to warm. Consider lowering the permission cache TTL to 10 seconds if cache hit rate is low, or investigating the auth adapter's database.
3. **Slow subscribers:** Check `platform_realtime_buffer_used` for specific subscriptions. If a subscription's buffer is consistently > 500, that subscriber is slow. Consider closing the connection after a 60-second idle timeout (already configured in `REALTIME_DEFAULTS.IDLE_TIMEOUT_MS`).
4. **High volume:** Scale horizontally. Add another platform instance; configure sticky sessions. The in-process model means each instance handles its own subscribers independently.

## Prevention

- Alert on p95 delivery lag > 2 seconds.
- Monitor `platform_realtime_events_dropped_total` — sustained drops indicate a buffer/lag problem.
