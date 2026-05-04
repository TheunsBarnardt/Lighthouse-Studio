# ADR-0112: Two Real-Time Transports (WebSocket + SSE)

**Status:** Accepted
**Date:** 2026-05-04
**Deciders:** solo

## Context

The platform needs to expose change streams to browser clients, mobile apps, and server-side workers. The two standard transport options for server-push data are:

- **WebSocket** — bidirectional, full-duplex, well-suited to multiplexing many subscriptions on one connection, requires a protocol-level upgrade.
- **Server-Sent Events (SSE)** — unidirectional (server-to-client), pure HTTP, works through most reverse proxies and CORS setups without configuration, no protocol upgrade needed.

Both deliver the same underlying change events. The question is whether to implement one or both.

## Decision

Ship **both** transports from v1.

- **GraphQL subscriptions** use the `graphql-ws` protocol over WebSocket, served through the existing GraphQL endpoint upgraded to WebSocket. This is the standard for GraphQL clients (Apollo Client, urql).
- **SSE** is available at `/api/v1/data/<workspace>/<schema>/realtime` for non-GraphQL clients. Subscriptions are declared via URL query parameters.

Both transports consume the same `SubscriptionManager` and `EventFilterPipeline`. The only difference is delivery mechanism.

## Consequences

**What becomes easier:**

- GraphQL-native clients (Apollo, urql) use WebSocket and get multiplexing out of the box.
- Simple HTTP clients (vanilla fetch, curl, any HTTP library) can use SSE without WebSocket negotiation.
- SSE works reliably through most enterprise proxies that block WebSocket upgrades.
- The SDK (Objective 19) can choose the best transport per environment.

**What becomes harder:**

- Two transport implementations to maintain.
- SSE is unidirectional; adding new subscriptions after connect requires reconnect or declaring all subscriptions at connect time via URL params.
- Testing coverage must verify both transports.

## Alternatives Considered

**WebSocket only:** Eliminates SSE complexity. Rejected because SSE handles enterprise proxies better and is meaningfully simpler for server-side consumers.

**SSE only:** Simpler server side; avoids WebSocket complexity. Rejected because the GraphQL ecosystem expects WebSocket subscriptions and multiplexing is standard for SPAs watching many tables.

**GraphQL over SSE:** A lesser-known GraphQL transport (the `graphql-sse` protocol). Rejected — rare in practice, adds a dependency, provides no benefit over WebSocket for the use cases targeted.
