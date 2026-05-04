# Runbook: Real-Time Resume Failures

## Symptoms

- Clients reporting "Resume window expired. Re-subscribe with snapshot mode." errors after brief disconnects.
- Resume attempts returning `VALIDATION` error even within the 5-minute window.
- Clients losing subscription state more often than expected.

## How Resume Works

1. Client disconnects (network error, browser tab backgrounded, etc.).
2. `ConnectionManager.close` is called with `reason: 'client_disconnect'`.
3. `SubscriptionManager.detachConnection` saves subscription state for 5 minutes.
4. Client reconnects and sends resume token (subscription ID + filter hash).
5. `SubscriptionManager.resume` looks up saved state, validates the token, re-opens the change stream from `lastDeliveredPosition`, and resumes delivery.

## Common Failure Causes

### 1. Resume window expired (> 5 minutes offline)

**Symptom:** Error message "Resume window expired."

**Fix:** This is expected behaviour. The client must re-subscribe. If 5 minutes is consistently too short, increase the resume window via workspace settings.

### 2. Client reconnected to a different instance

**Symptom:** Resume fails with "Resume token expired or unknown" immediately after disconnect (< 5 minutes).

**Root cause:** In a multi-instance deployment without sticky sessions, the client reconnected to a different platform instance that has no saved state.

**Fix:** Configure sticky sessions at the load balancer (see ADR-0118). Until sticky sessions are configured, the client's SDK should fall back to re-subscribe + snapshot automatically.

### 3. Filter changed between disconnect and reconnect

**Symptom:** Resume fails with "Resume token filter mismatch."

**Root cause:** The client presented a resume token but changed the subscription filter. The filter hash in the token doesn't match the new filter.

**Fix:** This is correct behaviour — the client changed its intent, so resume is invalid. The client must re-subscribe with the new filter.

### 4. Server restart

**Symptom:** All clients fail to resume after a server restart.

**Root cause:** Resume state is in-process memory. A server restart clears it.

**Fix:** Expected. After a restart, all clients must re-subscribe. The client SDK handles this automatically by falling back to re-subscribe + snapshot. Ensure the SDK's `autoReconnect` option is enabled.

## Verifying Resume State

```bash
# Check how many detached (pending resume) subscriptions exist
# Use metrics: platform_realtime_detached_subscriptions gauge

# Check resume attempts
grep 'realtime.subscription_resumed' /var/log/platform/app.log | tail -50

# Check resume failures
grep 'Resume.*expired\|Resume.*mismatch\|Resume.*unknown' /var/log/platform/app.log | tail -50
```

## Adjusting the Resume Window

Via workspace settings:

```http
PATCH /api/v1/workspaces/<workspace-slug>/settings
Content-Type: application/json

{"realtime": {"resumeWindowMs": 600000}}
```

(10 minutes in milliseconds)

Increasing the window increases memory usage for disconnected subscriptions. Each detached subscription holds its buffer (up to 1000 events × ~1KB = ~1MB) for the duration of the window.
