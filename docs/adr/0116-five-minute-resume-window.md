# ADR-0116: 5-Minute Resume Window

**Status:** Accepted
**Date:** 2026-05-04
**Deciders:** solo

## Context

When a client disconnects (network glitch, browser tab goes to background, mobile device sleeps), the subscription state on the server is lost. If the client reconnects, it has two options:

1. Re-subscribe from scratch (may miss events that occurred during the disconnect).
2. Resume from the last delivered position (no missed events, transparent reconnect).

Option 2 requires the server to keep per-subscription state after disconnect. The question is: for how long?

Trade-offs:

- **Too short:** Client reconnects but state is gone; must re-subscribe. Common for mobile apps with variable connectivity.
- **Too long:** Server holds state for disconnected clients; memory cost proportional to subscriber count × window duration.

## Decision

The platform retains subscription state for **5 minutes** after disconnect.

Within the 5-minute window:

- The client presents its previous subscription ID and a resume token.
- The server looks up the saved filter, last delivered position, and pending buffer.
- Events that occurred during the disconnect are fetched from the change stream (using `replay_from_position` when supported) and delivered.
- Delivery continues as normal from there.

After 5 minutes:

- The state is discarded; the server reclaims memory.
- The client's resume attempt returns `VALIDATION` error with message "Resume window expired. Re-subscribe with snapshot mode."
- The client must re-subscribe from scratch, optionally with `snapshot` mode to get current state.

The resume window is configurable per workspace (via workspace settings). The 5-minute default balances:

- Mobile and laptop sleep cycles (usually < 5 minutes for typical interruptions).
- Server memory cost: 5 minutes of events per disconnected subscriber is bounded by the 1000-event buffer cap.

## Consequences

**What becomes easier:**

- Brief network interruptions (cellular handoff, VPN reconnect, laptop sleep) are transparent to the client.
- The client SDK (Objective 19) can implement auto-reconnect with resume without any user-visible disruption for short outages.

**What becomes harder:**

- In multi-instance deployments, the subscription state is in-process. If the client reconnects to a different instance, resume fails (no state on the new instance). Sticky-session load balancer config makes this work (ADR-0118). Without sticky sessions, the client falls back to re-subscribe.
- The 5-minute window is a point-in-time choice. Workspaces with slow mobile users may need longer; workspaces with high subscriber counts may want shorter.

## Alternatives Considered

**10-minute window:** More generous for slow mobile; doubles server memory cost for disconnected subscribers. Available as a workspace configuration option; not the default.

**30-second window:** Very low memory cost; too short for typical mobile sleep cycles. Rejected as default.

**No resume (always re-subscribe):** Eliminates complexity. Rejected because seamless reconnect is a significant developer experience feature; the complexity cost is low.

**Persisting resume state to a shared store (Redis):** Makes resume work across instances without sticky sessions. Adds an infrastructure dependency; deferred to a future objective if customers demand it.
