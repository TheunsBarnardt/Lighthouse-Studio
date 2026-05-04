# ADR-0107: DataLoader for N+1 Prevention

**Status:** Accepted
**Date:** 2026-05-03
**Deciders:** solo

## Context

Auto-generated GraphQL schemas include foreign-key relationship fields. When a client queries a list of rows and includes related rows via FK fields (e.g., `postList { edges { node { users { email } } } }`), the naive resolver would issue one database query per row to fetch the related entity — the classic N+1 problem. With 100 posts in the result, this generates 100 individual lookups for the `users` table.

At scale this is both slow (100 round trips vs. 1) and expensive (100 DB connections held concurrently). The platform cannot ship FK resolution without a batching strategy.

## Decision

Use **DataLoader** (`dataloader` npm package) with one loader per `(tableId, fkColumn)` per HTTP request. Loaders are created by `DataLoaderFactory.forRequest()` and attached to `GraphQLContext` at the start of each `GraphQLRequestHandler.handle()` call.

- **byId loader**: batches up to 500 ID lookups for a table into a single `findMany({ filter: { id: { _in: [...ids] } } })` call.
- **byForeignKey loader**: batches up to 200 FK-column value lookups into a single `findMany({ filter: { [fkCol]: { _in: [...vals] } } })` call.

Loaders are request-scoped (created fresh per `handle()` call) to prevent stale data leaking between requests.

## Consequences

**What becomes easier:**

- FK fields in queries automatically batch — no special client knowledge needed.
- The number of DB queries for a list-with-relations query is O(depth), not O(rows × depth).
- `DataLoaderFactory` is pure (no I/O); easily tested by injecting mock repos.

**What becomes harder:**

- Results are unordered relative to the batch input — the loader must re-map results by key. Any key without a result returns `null`.
- Batching adds one tick of latency (DataLoader defers resolution to the next event loop tick). For simple single-entity queries with no FK fields, this is unnecessary overhead, though negligible in practice.
- The batch size limits (500 for by-ID, 200 for by-FK) are conservative. If a single page contains more rows than the batch limit, DataLoader will split into multiple batches. This is correct but not always obvious in profiling.

## Alternatives Considered

**Join-based resolution:** Issue a single SQL JOIN per FK field. This only works for relational databases (not MongoDB) and requires the resolver to construct raw SQL, bypassing the `CustomerRepository` abstraction. Rejected.

**No batching (naive N+1):** Acceptable for single-row queries, unacceptable for list queries with FK fields. Rejected as a production approach.

**Per-request query accumulation and single flush:** Conceptually the same as DataLoader but custom-built. DataLoader is battle-tested, well-typed, and handles the deferred execution model correctly. No reason to reinvent it.
