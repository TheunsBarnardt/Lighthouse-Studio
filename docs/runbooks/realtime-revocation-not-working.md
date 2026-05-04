# Runbook: Revocation Not Working (User Keeps Receiving Events)

## Symptoms

- A workspace member has been removed from the workspace but is still receiving real-time events.
- An API key has been revoked but the associated connection is still active.
- A session has been invalidated but the WebSocket connection remains open.

## How Revocation Should Work

1. The service action (e.g., `MemberService.remove`) publishes an `InternalRevocationEvent` to the `InProcessEventBus`.
2. `ConnectionManager.onRevocationEvent` receives the event synchronously (within the same Node.js event loop tick).
3. Connections matching the revocation criteria are force-closed with `reason: 'auth_revoked'` or `'session_expired'`.
4. `SubscriptionManager.cancelAllForConnection` immediately stops event delivery.
5. The audit log records `data_management.realtime.connection_force_closed`.

**Expected propagation time: < 1 second** (in-process; no network hops).

## Diagnosis Steps

### Step 1: Verify the revocation event was published

```bash
# Check service logs for the member removal
grep 'member.removed\|workspace.member_removed' /var/log/platform/app.log | grep '<userId>' | tail -20
```

### Step 2: Verify the connection was force-closed

```bash
# Check audit log for force-close
grep 'connection_force_closed' /var/log/platform/audit.log | grep '<userId>' | tail -20
```

If the audit entry is present, the connection was closed server-side. The client may be reconnecting automatically.

### Step 3: Check if the client is reconnecting

```bash
# Check for re-opens after the revocation
grep 'connection_opened' /var/log/platform/app.log | grep '<userId>' | awk '$time > <revocation_time>' | head -20
```

If the client is reconnecting successfully, the issue is that the client's session/API key is still valid despite the member removal. **Member removal does not invalidate the user's session** — it only removes workspace membership. The user's session may grant them workspace access through a different path.

### Step 4: Invalidate the session explicitly

If the user should have no access, revoke their session explicitly:

```http
POST /api/v1/sessions/<sessionId>/revoke
```

Or revoke all sessions for the user:

```http
POST /api/v1/users/<userId>/sessions/revoke-all
```

This publishes `session.revoked` to the `InternalEventBus`, closing all remaining connections.

## Common Root Causes

1. **Client reconnects with a still-valid session** — member removal doesn't invalidate sessions. Explicit session revocation is required.
2. **Multiple instances without sticky sessions** — the force-close event reached the instance that served the original connection. The client reconnected to a different instance that has no record of the revocation. Ensure sticky sessions are configured (see ADR-0118), or implement cross-instance revocation via the shared `EventBusPort`.
3. **Service forgot to publish to InternalEventBus** — the service calling `MemberService.remove` didn't wire up `InternalEventBus.publish`. Verify the `MemberService` publishes `workspace.member_removed` on every successful removal.
