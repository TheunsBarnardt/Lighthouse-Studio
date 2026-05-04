# ADR-0113: graphql-ws over Deprecated subscriptions-transport-ws

**Status:** Accepted
**Date:** 2026-05-04
**Deciders:** solo

## Context

GraphQL subscriptions over WebSocket have two protocol implementations:

- **`subscriptions-transport-ws`** — the original; now deprecated and unmaintained. Has known security vulnerabilities. Still used by older Apollo Client versions.
- **`graphql-ws`** — the modern replacement; actively maintained, has a cleaner protocol handshake, better connection lifecycle semantics, and is supported by `graphql-yoga` v5.

`graphql-yoga` v5 (the platform's GraphQL server) supports `graphql-ws` natively. Supporting `subscriptions-transport-ws` would require a separate adapter and pulling in a deprecated dependency.

## Decision

The platform uses the **`graphql-ws`** protocol exclusively for WebSocket-based GraphQL subscriptions.

Clients using older Apollo Client versions (< 3.5) or other clients that only support `subscriptions-transport-ws` must upgrade. The platform's public documentation clearly states this requirement.

Internally, `graphql-yoga`'s built-in subscription support handles the `graphql-ws` handshake. The platform does not add `graphql-ws` as a direct dependency — it relies on `graphql-yoga`'s transitive inclusion.

## Consequences

**What becomes easier:**

- No deprecated dependency in the bundle.
- Security patches are maintained upstream.
- Clean connection lifecycle: `connection_init`, `subscribe`, `next`, `error`, `complete`, `connection_ack`, `ping/pong` — all well-specified.
- Multiplexing via subscription IDs is first-class in the protocol.

**What becomes harder:**

- Clients on legacy `subscriptions-transport-ws` must migrate. This is a one-time migration; Apollo Client ≥ 3.5 supports `graphql-ws` by default.

## Alternatives Considered

**Supporting both protocols:** Adds the deprecated dependency and significant complexity for a use case (legacy clients) that should be migrated. Rejected.

**Rolling a custom WebSocket subscription protocol:** Not justified. `graphql-ws` is well-specified, widely adopted, and solves the problems correctly. Rejected.
