# ADR-0106: graphql-yoga as the GraphQL HTTP Transport

**Status:** Accepted
**Date:** 2026-05-03
**Deciders:** solo

## Context

The platform needs an HTTP transport layer that takes a raw `GraphQLSchema` and serves it over HTTP. The transport must integrate cleanly with the existing Fastify-based API server (`packages/adapters/http-fastify`), support multipart requests (for future file upload), and have a minimal, well-maintained dependency tree.

The objective named graphql-yoga as the transport to evaluate.

## Decision

Install **graphql-yoga** (`graphql-yoga` npm package) as the registered transport. However, the `GraphQLRequestHandler` in core calls `graphql-js`'s `execute()` directly — it handles parse, validate, and execute itself. The Fastify plugin (`graphql-plugin.ts`) handles HTTP concerns (auth, body parsing, response sending) and delegates to `GraphQLRequestHandler`. graphql-yoga is available if a future change needs its envelop plugin pipeline or subscription transport (Objective 14).

## Consequences

**What becomes easier:**

- Core's `GraphQLRequestHandler` has no HTTP dependency — it's testable with plain function calls (demonstrated in `request-handler.test.ts`).
- If graphql-yoga's envelop plugins are needed (e.g., persisted queries, tracing), the plugin can adopt them without rewriting the core handler.
- graphql-yoga's built-in GraphiQL can replace the hand-rolled playground HTML if needed.

**What becomes harder:**

- Two layers (Fastify plugin + core handler) add indirection. The split is justified by testability; future engineers must understand that the Fastify plugin is thin glue.
- Not using graphql-yoga's request lifecycle means its plugins (rate limiting, depth limiting) are not available automatically; those concerns are implemented in the core handler.

## Alternatives Considered

**Apollo Server 4:** Mature, widely used. But its integration with Fastify requires `@as-integrations/fastify` and its plugin model (Apollo plugins) differs from the envelop standard. The graphql-yoga + Fastify integration is simpler.

**Mercurius (Fastify-native):** Mercurius is a Fastify plugin that directly serves GraphQL. It is tightly coupled to Fastify's request/reply lifecycle, which would make the core handler untestable without a real Fastify instance. Rejected for the same testability reason.

**Bare graphql-js with no yoga:** Using `graphql-js` `execute()` directly in the Fastify route would work but would require manually writing the playground HTML, multipart support, and subscription transport. graphql-yoga provides these for free as a future upgrade path.
