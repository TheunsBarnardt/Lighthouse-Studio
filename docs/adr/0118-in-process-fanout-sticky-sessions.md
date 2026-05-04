# ADR-0118: In-Process Fan-Out with Sticky Sessions for Multi-Instance

**Status:** Accepted
**Date:** 2026-05-04
**Deciders:** solo

## Context

The platform is intended for self-hosted deployments. Most initial deployments are single-instance (one Node.js process). As customers grow, they may deploy multiple instances behind a load balancer.

For real-time subscriptions, there are two approaches to event fan-out:

1. **In-process fan-out:** Each instance maintains its own set of connections and its own change stream consumer. Events from the database arrive at each instance independently; each instance fans out to its own connected clients.
2. **Cross-instance fan-out via shared message bus:** A single change stream consumer publishes events to a message bus (Redis Pub/Sub, Kafka, etc.). All instances subscribe to the bus and deliver to their connected clients.

## Decision

The platform uses **in-process fan-out** for v1.

Each platform instance:

- Maintains its own registry of active connections.
- Consumes its own change stream from the database.
- Fans out events to its own subscribers only.

**Resume-after-disconnect in multi-instance deployments requires sticky sessions.** If a client disconnects and reconnects to the same instance, resume works transparently. If it reconnects to a different instance, resume fails (no state on the new instance) and the client falls back to re-subscribe + snapshot.

The platform documentation explicitly states this constraint. Operators deploying multi-instance should configure sticky sessions at the load balancer (by client IP or session cookie).

## Consequences

**What becomes easier:**

- Zero additional infrastructure for single-instance deployments (the primary target).
- No Redis or Kafka dependency for the real-time feature.
- Fan-out latency is in-process (nanoseconds), not network-hop latency.
- Each instance is fully self-contained; failure of one instance only affects its own connections.

**What becomes harder:**

- Multi-instance deployments without sticky sessions lose resume-after-disconnect. Sticky sessions fix this.
- If an instance crashes, all its connections are dropped. Clients must reconnect (and lose resume state if they connect to a different instance).
- Very large deployments (10k+ concurrent connections) may prefer cross-instance fan-out to distribute event processing. This is a future objective.

## Multi-Instance Configuration Guidance

For multi-instance deployments:

```nginx
# Nginx example: sticky sessions by client IP
upstream platform_realtime {
  ip_hash;
  server instance1:3000;
  server instance2:3000;
}
```

Or use a cookie-based sticky session (more reliable under NAT):

```nginx
upstream platform_realtime {
  sticky cookie srv_id expires=1h domain=.example.com path=/;
  server instance1:3000;
  server instance2:3000;
}
```

The `/api/v1/data/<workspace>/<schema>/realtime` endpoint should be in the sticky upstream group.

## Future: Cross-Instance Fan-Out

If customer deployments outgrow single-instance and sticky sessions are insufficient, a future objective will add cross-instance fan-out via the `EventBusPort` (the existing pub/sub abstraction). This would allow any instance to receive events for any workspace and fan out to its local subscribers. The in-process model is the correct starting point; add the complexity only when the scale justifies it.

## Alternatives Considered

**Redis Pub/Sub for cross-instance fan-out:** Eliminates the sticky session requirement; any instance can serve any client. Adds a Redis dependency (operational cost). Deferred to a future objective rather than included in v1.

**WebSocket connection state in shared Redis:** All connection state (subscription filters, positions, buffers) stored in Redis, shared across instances. Makes the instances stateless; enables seamless reconnect to any instance. Significantly more complex; deferred to a future objective.
