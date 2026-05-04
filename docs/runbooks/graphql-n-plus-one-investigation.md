# Runbook: GraphQL N+1 Investigation

**Trigger:** GraphQL queries with foreign-key traversal are slow; database shows many small queries in rapid succession.

---

## Background

The platform uses DataLoader to batch FK lookups. For a query like:

```graphql
{
  userList {
    edges {
      node {
        postsList {
          edges {
            node {
              id
              title
            }
          }
        }
      }
    }
  }
}
```

The ideal execution issues:

1. One query: `SELECT * FROM users LIMIT N`
2. One query: `SELECT * FROM posts WHERE user_id IN (id1, id2, ..., idN)`

If N+1 is occurring, you will see:

1. One query: `SELECT * FROM users LIMIT N`
2. N queries: `SELECT * FROM posts WHERE user_id = id1`, `... = id2`, etc.

---

## Diagnosis

### 1. Enable query logging on the database

**PostgreSQL:**

```sql
ALTER SYSTEM SET log_min_duration_statement = 0;  -- log all queries
SELECT pg_reload_conf();
-- Run the problematic GraphQL query
-- Check: SELECT query, calls, total_exec_time FROM pg_stat_statements ORDER BY calls DESC LIMIT 20;
ALTER SYSTEM SET log_min_duration_statement = 1000;  -- restore
SELECT pg_reload_conf();
```

**MSSQL:**

```sql
-- Run Extended Events session or use SQL Profiler
-- Look for rapid repetition of the same parameterised query with different ID values
```

**MongoDB:**

```javascript
db.setProfilingLevel(2); // log all operations
// Run the problematic GraphQL query
db.system.profile.find({ ns: /posts/ }).sort({ ts: -1 }).limit(50);
db.setProfilingLevel(0); // restore
```

### 2. Check DataLoader batch size (when metrics available)

When the `platform_graphql_dataloader_batch_size` histogram is implemented, check the P5 (5th percentile) of batch sizes for the affected table. If P5 is 1, DataLoader is batching poorly or not at all.

### 3. Trace the resolver

Add a temporary debug log in `dataloader-factory.ts` to print the batch keys:

```typescript
batchFn: async (ids: readonly string[]) => {
  console.debug(`[DataLoader byId] batch size: ${ids.length}, table: ${tableId}`);
  // ... existing code
};
```

A batch size of 1 on every call means the DataLoader is not merging requests — typically because resolvers are running in separate microtask frames (e.g., not awaited together).

---

## Root Causes

### A: DataLoader created outside request scope

DataLoaders must be created per request (in `DataLoaderFactory.forRequest()`) and passed through `GraphQLContext`. If a DataLoader is shared across requests or created inside a resolver, batching breaks.

**Check:** Verify `GraphQLRequestHandler.handle()` creates new loaders for every call and passes them via `contextValue`.

### B: FK resolver not using DataLoader

The to-one and to-many FK resolvers (`foreignKeyToOneResolver`, `foreignKeyToManyResolver`) must use `ctx.dataloaders.byId()` / `ctx.dataloaders.byForeignKey()`. If a resolver calls `repo.findMany()` directly, batching is bypassed.

**Check:** Read `resolvers.ts` and verify FK resolvers call the loader, not the repo.

### C: Batch size limit too low

The byId loader has `maxBatchSize: 500`; byForeignKey has `maxBatchSize: 200`. If a page contains more rows than the batch limit, DataLoader splits into multiple batches. This is not N+1 but may still be slow for very large pages.

**Fix:** Reduce page size (`first: N` with lower N) or raise batch limits in `DataLoaderFactory`.

---

## Verification

After fixing, rerun the query with database logging enabled and verify:

- The number of queries for the FK-populated list equals `1 (parent) + 1 (children batched)`, not `1 + N`.

---

## Related

- ADR-0107: DataLoader for N+1 Prevention
- `packages/core/src/services/data-management/graphql/dataloader-factory.ts`
- `packages/core/src/services/data-management/graphql/resolvers.ts`
