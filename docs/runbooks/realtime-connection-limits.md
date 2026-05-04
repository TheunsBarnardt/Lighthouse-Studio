# Runbook: Adjusting Real-Time Connection Limits

## Default Limits

| Limit                            | Default           | Config key                               |
| -------------------------------- | ----------------- | ---------------------------------------- |
| Connections per workspace        | 1000              | `realtime.maxConnectionsPerWorkspace`    |
| Connections per principal        | 10                | `realtime.maxConnectionsPerPrincipal`    |
| Subscriptions per connection     | 50                | `realtime.maxSubscriptionsPerConnection` |
| Events per second per connection | 100 (burst: 1000) | `realtime.eventsPerSecond`               |
| Buffer per subscription          | 1000 events       | `realtime.bufferSize`                    |

## Symptoms Requiring Adjustment

- New connections rejected with `RATE_LIMIT` error despite legitimate load.
- Subscription attempts rejected with `RATE_LIMIT` ("Connection already has 50 subscriptions").
- Buffer overflows (see `realtime-buffer-overflows.md`) due to buffer being too small.

## Adjusting Workspace-Level Limits

Limits are configurable per workspace via workspace settings. Until the UI exposes these controls (Objective 18), adjust via the platform admin API:

```http
PATCH /api/v1/workspaces/<workspace-slug>/settings
Content-Type: application/json

{
  "realtime": {
    "maxConnectionsPerWorkspace": 2000,
    "maxConnectionsPerPrincipal": 20,
    "maxSubscriptionsPerConnection": 100,
    "bufferSize": 5000
  }
}
```

## Adjusting Platform-Wide Defaults

Edit `REALTIME_DEFAULTS` in `packages/core/src/services/data-management/realtime/types.ts` and redeploy. This affects all workspaces that haven't overridden the setting.

## Memory Impact

| Limit                          | Memory impact                                   |
| ------------------------------ | ----------------------------------------------- |
| +1000 connections              | ~4 MB (connection state only)                   |
| +1000 buffer slots             | ~1 MB per subscription (1000 × ~1KB event JSON) |
| +1 subscription per connection | ~1 KB (subscription state)                      |

Plan memory accordingly. For 1000 connections each with 50 subscriptions each with 1000 buffer slots:
`1000 × 50 × 1000 × 1KB = 50 GB` worst case (all buffers full). In practice, buffers are mostly empty.

## Monitoring

Alert on:

- `platform_realtime_active_connections / max_connections > 0.8` (80% of capacity).
- `rate_limit_exceeded` audit events occurring more than 10 times per minute.
