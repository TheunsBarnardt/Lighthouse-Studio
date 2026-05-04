# ADR-0109: Query Complexity Scoring

**Status:** Accepted
**Date:** 2026-05-03
**Deciders:** solo

## Context

A GraphQL query can be syntactically valid yet computationally expensive. Clients can craft queries that fan out exponentially through FK relationships: `userList { users { postsList { users { postsList { ... } } } } }`. Without a cost gate, a single request can consume unbounded CPU and database resources.

The platform needs a lightweight, predictable guard that rejects obviously expensive queries before execution — without making the scoring algorithm opaque or non-overridable.

## Decision

Use a **static AST-walk complexity estimator** in `GraphQLRequestHandler`. The algorithm:

1. Walk the parsed query AST before execution.
2. Score `+1` for every scalar field, `+10` for every object/connection field, `+50` for every list connection field.
3. If the score exceeds the configured default (1000), return `429 Too Many Requests` with an `extensions.code = 'COMPLEXITY_EXCEEDED'` error before any DB I/O.
4. The limit is configurable at the handler level (future: per-workspace override).

A **depth limit** (default 10) is enforced in parallel as a GraphQL validation rule via `createDepthLimitRule(maxDepth)`. Depth > 10 returns `400` with `GRAPHQL_QUERY_DEPTH_EXCEEDED`.

Audit event `data_management.graphql.query_complexity_exceeded` is written when the gate fires.

## Consequences

**What becomes easier:**

- Complexity and depth rejection happens before any DB query — no database resources consumed on expensive queries.
- The algorithm is deterministic: the same query always gets the same score. Clients can compute the score themselves.
- The depth limit is implemented as a standard GraphQL validation rule (`ValidationRule`), which composites cleanly with other validation rules.

**What becomes harder:**

- Static scoring is a heuristic. It cannot account for actual row counts or selective indexes. A query that scores 950 might be fast (index scan on 10 rows) or slow (sequential scan on 10M rows). The complexity gate is a coarse first line of defence, not a substitute for database query planning.
- Customers who write legitimate complex reports may hit the default limit and need to contact support to raise it. The per-workspace override path mitigates this once implemented.
- The scoring constants (1, 10, 50) are chosen conservatively. Tuning them requires monitoring real query patterns.

## Alternatives Considered

**No complexity limit (depth only):** Depth 10 prevents infinite recursion but not wide queries. A query with 100 FK fields at depth 1 could still be expensive. Rejected as insufficient.

**graphql-query-complexity package:** A mature library with configurable field-level cost functions. The platform's needs are simpler (all fields of the same kind cost the same); the dependency overhead is not justified for v1. Can be adopted later if fine-grained per-field costs are needed.

**Execution-time timeout only:** A 30-second execution timeout catches slow queries but only after DB resources have been consumed. Static scoring catches expensive queries before any I/O. Both are good; the static gate is cheaper. The platform uses both (database queries have their own timeouts in the adapter layer).
