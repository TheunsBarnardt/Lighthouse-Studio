# Runbook: GraphQL Query Too Complex

**Trigger:** Client receives `400` with `extensions.code = "QUERY_TOO_COMPLEX"`.

---

## What is happening

The platform's GraphQL layer rejects queries whose static complexity score exceeds the workspace's configured limit (default: 1000). Complexity is computed by walking the parsed AST and scoring each field that has child fields (+1 per nested object or connection). The check runs before execution — no database I/O occurs.

The scoring formula:

- Each field with a non-empty `selectionSet` adds **+1** to the total.
- Scalar fields (leaf nodes) add **+0**.

A query with deeply nested FK traversal or many top-level fields can accumulate a high score.

---

## Diagnosis

### 1. Identify the query

Check the audit log for the event:

```
eventType: data_management.graphql.query_complexity_exceeded
metadata.complexity: <actual score>
metadata.maxComplexity: <configured limit>
```

The `correlationId` in the error response links to this audit event.

### 2. Estimate the complexity

Count the query's nested object fields manually or use the formula: every `{...}` block in the query increments the counter by 1. A list-with-edges-node structure costs at minimum 3 (list field + edges + node).

### 3. Determine root cause

- **Legitimate complex query**: The workspace has a schema with many FK relationships and the client is traversing several levels in a single query.
- **Client bug**: The client is constructing queries programmatically and including more fields than intended.
- **Malicious/probing request**: An external caller is testing depth/complexity limits.

---

## Resolution

### Option A: Rewrite the query (recommended)

Split the query into multiple cheaper queries. Instead of a single query that traverses users → posts → comments → authors, fetch each level in separate queries and stitch client-side.

### Option B: Raise the workspace complexity limit

> **Caution**: Raising the limit increases the risk of expensive database queries. Verify the query is legitimate before raising.

The complexity limit is configured per `GraphQLRequestHandler` instance in the composition root. Locate the handler construction (typically in `apps/*/src/composition-root.ts`) and adjust `maxQueryComplexity`:

```typescript
new GraphQLRequestHandler(
  schemas,
  authz,
  repos,
  audit,
  logger,
  metrics,
  rateLimiter,
  { maxQueryComplexity: 2000 }, // raised from default 1000
);
```

Restart the application process for the change to take effect.

### Option C: Use pagination to reduce per-query scope

Queries that request large connection fields can be reduced by setting `first: N` on connection arguments, lowering the number of edges fetched. This does not reduce the complexity score (which is structural, not data-count-based), but it reduces database load for queries near the limit.

---

## Escalation

If the limit needs to be per-workspace and configurable via the API (not a code change), this requires implementing the per-workspace override path (referenced in ADR-0109). Open a feature request.

---

## Related

- ADR-0109: Query Complexity Scoring
- Runbook: `graphql-n-plus-one-investigation.md`
- Audit event: `data_management.graphql.query_complexity_exceeded`
