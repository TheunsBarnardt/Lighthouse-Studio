# ADR-0115: Per-Event Permission Checks vs. Once-at-Connect

**Status:** Accepted
**Date:** 2026-05-04
**Deciders:** solo

## Context

When a subscriber connects and starts receiving change events, the platform must decide when to enforce access control:

- **Once at connect:** Check permissions when the subscription is created; trust for the connection lifetime.
- **Per-event:** Check permissions for every event before delivery.

The "once at connect" approach is simpler and cheaper. However, subscriptions are long-lived (minutes to hours). If a user's permissions are revoked while they are connected, the "once at connect" approach would continue delivering events they should no longer see — a security violation.

## Decision

The platform uses **per-event permission checks** with a **30-second TTL cache** per connection.

Concretely:

1. At subscription start, permissions are checked (warm path).
2. For every subsequent event, the `PermissionCache` is consulted first (O(1) hash lookup).
3. If the cache entry is warm (< 30 seconds old), the cached result is used.
4. If the cache is cold (> 30 seconds), the `AuthorizationPort` is re-consulted.
5. On `permission.changed` events from the `InternalEventBus`, the cache is immediately invalidated.
6. On `workspace.member_removed` or `session.revoked` events, the connection is force-closed within 1 second.

The 30-second TTL means a permission revocation propagates in at most 30 seconds to any active subscriber (immediate for membership removal; up to 30 seconds for fine-grained permission changes).

## Consequences

**What becomes easier:**

- Revocation is propagated reliably — removed users stop receiving events.
- PII redaction is consistent with queries: the same `pii.read.<category>` permission gates both query responses and subscription events.
- Security review is straightforward: every event delivery path goes through the same authz layer.

**What becomes harder:**

- Higher CPU cost per event than "once at connect". The cache makes this O(1) per event in the common case; the impact is small (sub-microsecond map lookup).
- The 30-second window is a business trade-off: some customers may want immediate propagation for all permission changes. This can be achieved by publishing `permission.changed` events to the InternalEventBus on every ACL update.

## Alternatives Considered

**Once-at-connect with explicit revocation push:** Check at connect; maintain a revocation list published by the authz service; subscribers check the list per event. Equivalent in security posture but more complex than the cache approach. Rejected — the TTL cache achieves the same result with less infrastructure.

**Token refresh on every event:** Force the client to send a fresh token with every subscription message. Impractical and non-standard for streaming protocols. Rejected.
