# Runbook: Real-Time Connection Storm

## Symptoms

- `platform_realtime_active_connections` spikes suddenly (> 800 in under 60 seconds).
- New connection registrations returning `429 RATE_LIMIT` in logs.
- CPU usage elevated; event loop lag increases.

## Likely Causes

1. **Client reconnect loop bug** — client code reconnects immediately on disconnect without backoff, flooding the platform with connections.
2. **Deployment event** — a new frontend version deployed; all browser tabs reconnect simultaneously.
3. **Load balancer reset** — load balancer restarted; all WebSocket connections dropped and clients reconnect.
4. **Denial of service** — external actor opening many connections with valid (or invalid) credentials.

## Investigation Steps

```bash
# Check active connection count per workspace
grep 'realtime.connection_opened' /var/log/platform/app.log | jq -r '.workspaceId' | sort | uniq -c | sort -rn | head -20

# Check per-principal connection count
grep 'realtime.connection_opened' /var/log/platform/app.log | jq -r '.principalId' | sort | uniq -c | sort -rn | head -20

# Check audit log for force-closes (security signal)
grep 'connection_force_closed' /var/log/platform/audit.log | tail -100
```

## Mitigation

1. **Identify the culprit workspace/principal** — use the queries above.
2. **If client bug:** The per-principal limit (10 connections) and per-workspace limit (1000) are already enforced. New connections beyond the limit receive `429`. No immediate server action needed; the limits absorb the storm.
3. **If DoS:** Revoke the API key or session via the admin panel. The `InternalEventBus` will broadcast `api_key.revoked` or `session.revoked` and all matching connections will be force-closed within 1 second.
4. **If deployment event:** Normal; connections stabilise within 60 seconds as clients reconnect successfully. No action needed.

## Prevention

- Ensure client SDKs implement exponential backoff on reconnect (the official SDK does this; custom clients may not).
- Set reasonable per-workspace connection limits via workspace settings for high-risk workspaces.
- Alert on `platform_realtime_active_connections > 900` to catch approaching limits before the ceiling is hit.
