# Runbook: Data Browser — Real-Time Updates Not Working

**Symptom:** The data browser shows stale data; other users' edits are not appearing without a manual refresh. The Live indicator in the toolbar is red or absent.

---

## 1. Verify the Symptom

Ask the user to open the browser console and check for:

- WebSocket connection errors (`ws://` or `wss://` connection failures)
- 401 / 403 errors on the realtime endpoint
- Network tab: is the `/api/v1/realtime/subscribe` call succeeding?

---

## 2. Check the Realtime Service

```bash
# Check realtime worker status
systemctl status platform-realtime   # Linux
# or on Windows:
Get-Service platform-realtime
```

If the service is down, restart it:

```bash
systemctl restart platform-realtime
```

---

## 3. Check the Change Stream (Postgres)

```sql
-- Are replication slots healthy?
SELECT slot_name, active, restart_lsn, confirmed_flush_lsn
FROM pg_replication_slots
WHERE slot_type = 'logical';
```

- If `active = false`, the logical replication slot is disconnected. The realtime worker needs to reconnect; restart the realtime service.
- If `restart_lsn` is very far behind `confirmed_flush_lsn`, the slot has large WAL lag — potential disk pressure.

---

## 4. Check the Subscription Count

```sql
-- From the audit log: how many subscriptions were recently started?
SELECT COUNT(*), DATE_TRUNC('minute', created_at) AS minute
FROM audit_log
WHERE event_type = 'data_management.realtime.subscription_started'
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY minute
ORDER BY minute DESC;
```

If subscriptions are being started but connections are not, the issue is at the WebSocket layer (reverse proxy config, timeout, etc.).

---

## 5. Reconnection

Instruct the user to:

1. Toggle the "Live" button off and on in the toolbar (forces a new subscription).
2. Hard-refresh the page (clears any stale connection state).

If the issue persists for all users, it is a server-side problem (steps 2–4).

---

## 6. Manual Refresh Fallback

While investigating, the user can use the ↻ refresh button in the toolbar to manually re-fetch the current page. The ↻ button always works regardless of realtime status.

---

## Prevention

- Monitor WebSocket connection count with an alert if it drops to 0 during business hours.
- Set `REALTIME_RECONNECT_INTERVAL=5000` in the realtime worker env to auto-reconnect.
- Ensure reverse proxy (IIS ARR / nginx) has WebSocket upgrade rules configured and `proxy_read_timeout` ≥ 120s.
