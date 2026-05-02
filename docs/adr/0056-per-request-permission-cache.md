---
adr: 0056
title: Per-Request Permission Cache — Not Global
status: Accepted
date: 2026-05-02
deciders: Theuns Barnardt
objective: objectives/06-multi-tenancy-rbac.md
---

## Context

Authorization checks happen on every service method call. A single HTTP request may trigger many service calls. Without caching, this means many round-trips to the database to load the user's roles and permissions.

Options:

1. No cache — every `authorize()` call hits the database.
2. Global in-memory cache with TTL — fast, but stale data possible.
3. Per-request cache — load once per request, use throughout.

## Decision

**Per-request permission cache.** The first `authorize()` call in a request loads the user's effective permissions for the workspace (one query) and stores the result in a `WeakMap` keyed by the `RequestContext` object. Subsequent calls in the same request hit the cache.

```typescript
const requestCache = new WeakMap<RequestContext, Map<string, CacheEntry>>();
```

`WeakMap` is used because:

- The cache is automatically garbage-collected when the `RequestContext` object is no longer referenced (when the request ends)
- No explicit cache invalidation is needed
- No TTL management is needed

## Consequences

- Performance target: p99 < 1ms cached (in-process map lookup), p99 < 10ms cold (one DB query)
- Role changes take effect on the next request — not mid-request. This is acceptable: it means a removed user's in-flight request completes, but the very next request is denied
- No cache stampede possible: each request has its own cache
- No cross-request information leakage via the cache
- The cache holds no mutable state — the underlying permissions data is read-only from the cache's perspective

## Alternatives Considered

**Global in-memory cache with TTL**: Faster for the cold path (no DB query after first population), but a removed user could continue to act for up to TTL seconds. That's a security trade-off the platform is not willing to make.

**No cache**: Correct but expensive. A service method that calls `authorize()` 5 times would do 5 DB queries. Not acceptable for p99 < 1ms.
