# ADR-0110: Persisted Queries as Opt-In

**Status:** Accepted
**Date:** 2026-05-03
**Deciders:** solo

## Context

Persisted queries (also called "automatic persisted queries" or APQ) allow clients to send a hash instead of the full query string. The server maps the hash to a stored query document. Benefits: smaller HTTP payloads, ability to allowlist known queries (security), and cache-friendly GET requests. Costs: added complexity (query registration endpoint, storage, cache invalidation), and a barrier for ad-hoc tooling like GraphiQL.

## Decision

Persisted queries are **opt-in** and **not implemented in v1**. The audit events `data_management.graphql.persisted_query_registered` and `data_management.graphql.persisted_query_revoked` are defined in the audit vocabulary as placeholders. The feature will be implemented in a later objective when customers request it.

In the meantime, all requests must include the full `query` string. Clients sending only a hash receive a `400` error.

## Consequences

**What becomes easier:**

- v1 implementation is simpler — no query store, no hash-to-document mapping, no registration API.
- GraphiQL and ad-hoc curl-based exploration work out of the box (no pre-registration required).
- The audit event vocabulary is forward-compatible: when persisted queries are implemented, the events are already named.

**What becomes harder:**

- Clients that use APQ by default (Apollo Client with APQ enabled) need to be configured to send full queries. This is a one-line config change on the client side.
- The security benefit of query allowlisting (blocking arbitrary introspection or mutation queries) is unavailable until persisted queries are implemented.

## Alternatives Considered

**Persisted queries enabled by default:** Adds meaningful complexity to v1 for a feature most customers won't use initially. The platform's primary users (developers building their first schema) want easy curl/GraphiQL access, not enforced query allowlisting. Deferred.

**Automatic persisted queries (APQ) via Redis:** APQ stores the hash→document mapping in a shared cache. This adds a Redis dependency that the platform does not yet have in the persistence stack. Deferred until an appropriate cache adapter is available.
