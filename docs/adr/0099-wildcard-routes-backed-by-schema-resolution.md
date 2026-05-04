# ADR-0099: Wildcard Routes Backed by Schema Resolution

**Status:** Accepted
**Date:** 2026-05-03
**Deciders:** solo

## Context

Objective 12 requires that customer REST API endpoints appear immediately after a schema is deployed — no process restart, no build step. A customer defines a schema with tables `users`, `posts`, and `comments`; the API for those tables must be live the moment they deploy.

The two obvious implementation strategies are:

1. **Per-table static route registration**: on schema deploy, register new Fastify routes dynamically (e.g. `fastify.get('/api/v1/data/acme/main/users', handler)`).
2. **Wildcard routes with runtime resolution**: register a small set of wildcard routes once at startup; the handler resolves the workspace, schema, and table from URL segments at request time.

## Decision

Use **wildcard routes** backed by runtime schema resolution.

A single set of Fastify routes covers the entire customer API surface:

```
GET|POST        /api/v1/data/:workspace/:schema/:table
GET             /api/v1/data/:workspace/:schema/:table/count
POST            /api/v1/data/:workspace/:schema/:table/bulk
GET|PUT|PATCH|DELETE  /api/v1/data/:workspace/:schema/:table/:id
POST            /api/v1/data/:workspace/:schema/:table/:id/restore
GET             /api/v1/data/:workspace/openapi.json
```

These six route patterns are registered once at startup and never change. The handler resolves `:workspace`, `:schema`, and `:table` on every request using a request-scoped cache backed by a 60-second workspace-level TTL cache. On schema deploy, the cache is explicitly invalidated.

## Consequences

**What becomes easier:**

- Schema deploys are instant: no route registration delay, no Fastify plugin reload.
- A single code path handles all table access; per-table customization is data-driven.
- Testing: the full handler is exercised by any table test — no need to seed routes.

**What becomes harder:**

- Fastify cannot generate per-table OpenAPI specs natively (we generate them ourselves anyway via `OpenApiGenerator`).
- Route-level Fastify plugins (e.g., per-route auth middleware) don't apply per-table; all middleware must be handler-level.
- Invalid table names produce 404 from the handler, not from Fastify's router — the error path is slightly different from static routes.

## Alternatives Considered

**Per-table static route registration on deploy:** Rejected because Fastify does not support adding routes after `fastify.ready()` in a stable way. Route re-registration requires a restart or a custom plugin that bypasses Fastify's internal constraints. This approach also creates race conditions when multiple instances are running and a schema deploys.

**Compile-time code generation (build → deploy cycle per schema change):** Rejected. Objective 12 explicitly requires a runtime-driven system; the customer's iteration loop must be seconds, not minutes.
