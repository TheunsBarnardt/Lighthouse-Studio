# ADR-0142: FK Batched Lookup in Data Browser

**Status:** Accepted
**Date:** 2026-05-07
**Deciders:** solo

## Context

The data browser displays rows from customer tables in a paginated grid. Many tables have foreign key columns (e.g., `author_id → users`, `category_id → categories`) where showing the raw integer or UUID is unhelpful — users expect to see a human-readable label (e.g., the user's display name instead of their UUID).

Naively resolving each FK value per-row as the grid renders produces an N+1 query pattern. For a page of 100 rows with 3 FK columns pointing to 3 distinct tables, that is 300 separate database queries per page load. At 1000 rows per page (the maximum), this is 3000 queries — unacceptably expensive and slow.

The FK resolution strategy must therefore batch these lookups to bound query count regardless of page size.

## Decision

All FK values in a result page are resolved in a **single batched lookup per referenced table**. The resolution algorithm in `DataBrowserService.resolveForeignKeys()` is:

1. After fetching the page of rows, scan all FK columns in the table schema.
2. For each FK column, collect the set of distinct non-null values across all rows in the page.
3. Group collected values by their target table: `Map<targetTable, Set<id>>`.
4. For each distinct target table, issue one `findMany({ ids: [...] })` call through the `PersistencePort`.
5. Receive a `Map<id, Record>` of display fields from each target.
6. Merge the display values back into the grid rows client-side, replacing raw FK values with their resolved labels.

Large batches (more than 500 distinct FK values for a single target table) are chunked into sub-batches of 500 to avoid binding too many parameters in a single query.

FK resolution runs after pagination, so it never inflates the row count or interacts with cursor state.

## Consequences

### Positive

- Query count per page load is bounded by the number of distinct FK targets in the schema, not by the number of rows. A table with 3 FK columns always makes at most 3 extra queries, regardless of page size.
- The PersistencePort `findMany({ ids })` call is already present for other uses; no new adapter surface is required.
- FK resolution can be disabled per column: if a user hides an FK column, its values are not fetched at all.

### Negative

- Each page load that includes FK columns pays the cost of 1 extra round-trip per FK target. For schemas with many FK references (5+), this is noticeable but still bounded.
- FK resolution is not lazy — all FK values for all visible FK columns on the page are resolved in one batch before the grid renders. There is no incremental / virtualized FK loading.

### Neutral

- FK resolution results are not cached between page navigations. The browser grid's React Query layer caches page results (including resolved FK values) with a 30-second stale time, so repeated visits to the same page are cheap.
- The batch is bounded by page size (default 50, max 1000), so the `findMany({ ids })` call never exceeds 1000 IDs per target per load.

## Alternatives Considered

### Option A: DataLoader (per-request batching and deduplication)

DataLoader is Facebook's standard solution for N+1 batching in GraphQL servers. It coalesces individual lookups that occur within the same event-loop tick into a single batch.

**Rejected:** DataLoader solves the concurrent-request batching problem, which is not the problem here. The data browser's FK resolution is sequential and server-side within a single request — there is no concurrent fan-out of individual lookups. Adding DataLoader would introduce a dependency and a mental model that doesn't map cleanly to this use case.

### Option B: Lazy loading per cell (client-side, on scroll)

Resolve FK values lazily as the user scrolls the grid, loading them in small batches as cells come into view.

**Rejected:** This produces a visually jarring experience (cells flash from raw ID to display value as the user scrolls). It also complicates the grid's data model significantly (cells must handle two states: unresolved and resolved). The page-bounded batch approach is simpler and fast enough.

### Option C: JOIN queries at the database layer

Push FK resolution into the primary query as SQL JOINs, so that resolved display values arrive in the same result set as the row data.

**Rejected:** The `PersistencePort` contract does not include a generic JOIN abstraction, and adding one would require significant adapter work across PostgreSQL, MSSQL, and MongoDB. MongoDB in particular does not support relational JOINs. Keeping resolution as a second pass in the service layer maintains cross-database compatibility with no adapter changes.

## References

- ADR-0235: TanStack Table for data browser grid
- ADR-0107: DataLoader for N+1 prevention (GraphQL layer — different context)
- ADR-0103: Cursor pagination as default
- Objective 18: Data Browser
