# Objective 13: Auto-Generated GraphQL APIs

**Status:** Ready for development
**Prerequisites:** Objective 12 (Auto-Generated REST APIs) complete; all foundation objectives complete
**Blocks:** Objective 14 (Real-Time Subscriptions — uses GraphQL subscriptions for one of its delivery modes)

---

## 1. Purpose

Expose the same customer schemas, the same data, the same permission model as Objective 12's REST APIs — through a GraphQL surface. Customers who prefer GraphQL get a coherent, typed, batch-friendly query language. Customers who don't never have to look at it.

GraphQL isn't a replacement for REST; it's an alternative for clients that benefit from it. Specifically, GraphQL excels at:

- Fetching related data across tables in one request (saves round-trips)
- Letting the client choose exactly which fields to fetch (reduces over-fetching)
- Strongly-typed schemas that drive client-side type safety
- The same developer ergonomics across query, mutation, and subscription operations

The objective is **not** to ship a featureful, opinionated GraphQL platform with custom resolvers, persisted queries, query complexity scoring, dataloader batching, etc. — those are valuable but live in a future expansion. The objective IS to ship enough GraphQL that customers who already use it can adopt the platform without giving up their patterns, and customers exploring it can decide whether it fits their needs.

This objective produces a GraphQL endpoint that mirrors REST capability for capability, with one addition: cross-table queries via field traversal (which REST doesn't naturally express).

---

## 2. Scope

### In Scope

- GraphQL schema generated from the customer's data schema (same input as REST)
- Query operations: list, get-one, count, with filtering, pagination, sorting, field selection
- Mutation operations: create, update, archive, restore, hardDelete (matching the REST endpoints)
- Field resolvers for cross-table relationships (foreign-key follow)
- Permission enforcement at the resolver level (same RBAC as REST)
- Error handling: typed GraphQL errors with extensions
- DataLoader integration for N+1 query prevention
- Introspection query (returns the schema for tooling)
- A GraphQL playground/explorer page (Apollo Sandbox or similar)
- Rate limiting at the operation level (more nuanced than per-request)
- Query depth limiting (prevents pathological queries)
- Query complexity limiting (prevents expensive queries)
- Persisted queries (basic support — clients can register query templates)
- Audit events on every mutation
- Observability: per-operation metrics, traces, logs
- Conformance tests across all three databases
- ADRs

### Out of Scope (Belongs to Later Objectives)

- GraphQL subscriptions (Objective 14)
- Custom resolvers / "edge functions" (deferred to a separate objective)
- Federation across multiple GraphQL services (deferred; not an immediate need)
- File uploads via GraphQL multipart (deferred; REST handles file uploads via Objective 15)
- Server-side caching of query results beyond DataLoader's per-request scope (deferred; clients use HTTP caching where they need it)
- Apollo Federation specifics (the platform is a single GraphQL service)

---

## 3. Locked Decisions

| Decision                    | Choice                                                                                        | Rationale                                                                                      |
| --------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| GraphQL endpoint path       | `/api/v1/data/<workspace_slug>/<schema_slug>/graphql`                                         | Aligns with REST path; per-schema endpoint                                                     |
| GraphQL server library      | `graphql-yoga`                                                                                | Modern, lean, framework-agnostic, excellent TypeScript support                                 |
| Schema construction library | `@pothos/core` (Pothos)                                                                       | Code-first schema construction with strong types; easier than SDL-first for runtime generation |
| Schema generation timing    | Runtime (per request, cached per `(workspace, schema_version)`)                               | Same approach as REST OpenAPI                                                                  |
| Authentication              | Session token (cookie or Bearer) or API key — same as REST                                    | Reuse; no new auth path                                                                        |
| Authorization               | RBAC at the resolver level                                                                    | Same engine as REST                                                                            |
| DataLoader for batching     | Yes — one DataLoader per (request, table)                                                     | N+1 prevention                                                                                 |
| Query depth limit           | 10 by default; configurable per workspace                                                     | Prevents pathological deeply-nested queries                                                    |
| Query complexity scoring    | Implemented; default cap 1000 per query; configurable                                         | Each field has a complexity weight; sum capped                                                 |
| Persisted queries           | Optional; opt-in per workspace                                                                | Reduces payload + enables stricter guardrails                                                  |
| Introspection               | Enabled by default; can be disabled per workspace                                             | Useful for tooling; some prefer to disable in production                                       |
| Error format                | GraphQL standard `errors[]` array with `extensions.code` for typed errors                     | Standard                                                                                       |
| Mutation result types       | Tagged unions: `{ __typename: "Success", data } \| { __typename: "ValidationError", errors }` | Avoids exception-based error flow                                                              |
| Pagination style            | Relay-style cursor connections by default; offset variant for clients that need it            | Relay is the GraphQL standard; offset is escape hatch                                          |
| Field naming                | camelCase in GraphQL (translated from snake_case in DB)                                       | GraphQL convention; mapper handles translation                                                 |
| Type naming                 | PascalCase, derived from table name                                                           | GraphQL convention                                                                             |
| Mutation field naming       | `<verb><Type>` (e.g., `createUser`, `updatePost`)                                             | GraphQL convention                                                                             |
| Filter input                | Reuses Objective 4's Filter AST shape, expressed as GraphQL input types                       | Consistency                                                                                    |
| Subscription endpoint       | Path defined here; implementation in Objective 14                                             | Forward-compatible                                                                             |

---

## 4. Architectural Overview

```
                  Client
                  POST /api/v1/data/acme/main/graphql
                  { query: "{ users(filter: {active:{_eq:true}}, first: 50) { edges { node { id email posts { title } } } } }" }
                           │
                           ▼
                ┌────────────────────────┐
                │   Fastify HTTP Server   │
                │   - TLS, compression    │
                │   - Same middleware as  │
                │     REST                │
                └───────────┬────────────┘
                            │
                            ▼
                ┌────────────────────────┐
                │   Auth + Workspace +    │
                │   Schema Resolution     │
                │   (same code as REST)   │
                └───────────┬────────────┘
                            │
                            ▼
                ┌────────────────────────┐
                │   GraphQL Schema        │
                │   Builder                │
                │  - Reads CustomerSchema │
                │  - Builds Pothos schema │
                │  - Caches per           │
                │    (workspace, schema-  │
                │    version)             │
                └───────────┬────────────┘
                            │
                            ▼
                ┌────────────────────────┐
                │   graphql-yoga          │
                │   - Parses query        │
                │   - Validates against   │
                │     schema              │
                │   - Depth + complexity  │
                │     limits              │
                │   - Persisted query     │
                │     resolution           │
                └───────────┬────────────┘
                            │
                            ▼
                ┌────────────────────────┐
                │   Resolvers             │
                │   - Authorize           │
                │   - DataLoader-batched  │
                │   - Same repository     │
                │     factory as REST     │
                │   - Audit on mutation   │
                └───────────┬────────────┘
                            │
                            ▼
                       JSON Response
                       (GraphQL standard format)
```

The pipeline reuses every foundation piece: auth, workspace resolution, schema resolution, the per-workspace repository factory, the filter parser (with input adapted for GraphQL syntax), the audit emitter. GraphQL is a different surface on the same engine.

---

## 5. The Hard Parts

**5.1 Schema generation at runtime, again**

REST APIs were generated at runtime in Objective 12; GraphQL must do the same. Schema deploys must propagate to GraphQL clients within the cache TTL window.

The generation is more involved than REST because GraphQL types are interconnected:

- The `User` type references the `Post` type (foreign key relationship)
- The `UserFilterInput` type references `StringFilterInput`, `IntFilterInput`, etc.
- The `UserConnection` type wraps `UserEdge` which wraps `User`
- ... and so on

Pothos's code-first approach makes this manageable: types and fields are constructed in TypeScript with full type safety; the GraphQL schema is the output. The platform's generator walks the customer schema, calls Pothos APIs to construct types, and produces the schema.

The generated schema is cached per `(workspace, schema_version)`. Cache invalidation is the same as REST: schema deploy bumps the version, the next request misses cache and regenerates.

**5.2 Resolver authorization**

In REST, authorization happens once per endpoint. In GraphQL, a single query can touch multiple types — `users { posts { comments } }` traverses three tables. Authorization must run for each.

The platform's approach:

- Every resolver calls `authz.authorize()` with the table-specific permission
- A query for `users.posts.comments` results in three authorize calls (one per type)
- Permission failures translate to GraphQL errors at the field level, not the whole-query level — the rest of the query can succeed; the failed field gets `null` and an entry in `errors`

This is GraphQL's standard partial-error model. Clients see what they have access to; what they don't, they see why.

The performance cost of three authorize calls per query is real but bounded: the per-request permission cache from Objective 6 means the second and third checks are O(1) hash lookups against the user's effective permissions for the workspace.

**5.3 The N+1 problem**

A naive resolver implementation for `users { posts }` would:

1. Fetch all users (1 query)
2. For each user, fetch their posts (N queries)

This is the canonical GraphQL pitfall. The platform prevents it via DataLoader:

- For each request, a DataLoader is constructed per table
- The `posts` resolver, instead of querying directly, calls `postsLoader.load(userId)`
- DataLoader collects all the userId values from the resolvers, then fires ONE query: `WHERE userId IN (...)`
- Results are dispatched back to the appropriate resolver instances

The repository layer must support a `findManyByForeignKey(table, fkColumn, fkValues)` operation efficient on all three databases. Postgres and MSSQL handle `WHERE x IN (...)` natively; Mongo handles `$in` natively.

**5.4 Query depth and complexity limits**

A pathological query: `users { posts { author { posts { author { posts { ... } } } } } }`. Without limits, this can be unbounded.

Two protections:

- **Depth limit**: maximum 10 levels of nesting by default; configurable per workspace
- **Complexity scoring**: every field has a weight; the query's total weight must not exceed a budget

Field weights:

- Scalar fields: 0 (free)
- Single-object fields (e.g., a foreign key to one row): 1
- Connection fields (lists with pagination): max(estimatedRows, 1) — where `estimatedRows` defaults to the page size
- Filter complexity: each operator costs 1; nested logical operators add up

A query exceeding either limit is rejected at validation time, before any resolver runs. The error message points at the offending field.

**5.5 Pagination via Relay-style connections**

GraphQL's de facto pagination standard is the Relay Connection spec:

```graphql
type UserConnection {
  edges: [UserEdge!]!
  pageInfo: PageInfo!
  totalCount: Int  # optional; expensive on large tables
}

type UserEdge {
  node: User!
  cursor: String!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}

# Used as:
users(first: 50, after: "cursor", filter: {...}, sort: [...]) { ... }
```

The cursor encoding is the same as REST (UUID-based for default sort by creation time). The platform provides a generic Connection helper that wraps any list query with this structure.

For workspaces that prefer offset pagination, an alternative `offsetUsers(offset: 0, limit: 50, ...)` field is also generated, with the same warnings as REST.

`totalCount` is included only when explicitly requested by the client (it's a separate count query; expensive on large tables).

**5.6 Mutation result types as tagged unions**

A common GraphQL antipattern: mutations return the created/updated object plus a flat `error` field that's null on success. Clients often forget to check the error field.

The platform's pattern: every mutation returns a tagged union:

```graphql
union CreateUserResult = CreateUserSuccess | ValidationError | ConflictError | AuthorizationError

type CreateUserSuccess {
  user: User!
}

type ValidationError {
  errors: [FieldError!]!
}

type ConflictError {
  message: String!
  conflictingField: String
}

type AuthorizationError {
  message: String!
  requiredPermission: String!
}
```

Clients use a `__typename` discriminator to handle each case. Forgetting to handle an error case is a TypeScript compile error in the SDK (Objective 19).

This is more verbose than the flat-error pattern but dramatically more robust. Worth it.

**5.7 Persisted queries**

A persisted query is a server-registered query template: the client sends `{persistedQueryId: "abc"}` and the server runs the registered query.

Benefits:

- Smaller request payloads
- Server can reject any query that isn't pre-approved (security)
- Easier to apply per-query rate limits

The platform supports persisted queries optionally:

- A workspace admin can enable "persisted queries only" mode, which rejects ad-hoc queries
- Queries can be registered via the management UI or programmatically
- A registered query has an ID; clients reference it; the server runs it

For Phase 1, persisted queries are an opt-in convenience, not the default. The default mode allows ad-hoc queries with depth and complexity limits.

**5.8 Errors with structured extensions**

GraphQL errors traditionally have `message` and `path`. The platform's errors include `extensions` with structured details:

```json
{
  "errors": [
    {
      "message": "Validation failed",
      "path": ["createUser"],
      "extensions": {
        "code": "VALIDATION_ERROR",
        "fieldErrors": [{ "field": "email", "code": "INVALID_FORMAT", "message": "Not a valid email" }],
        "correlationId": "abc123"
      }
    }
  ]
}
```

The `code` is stable (matches the REST API's error codes); the `correlationId` matches the audit log; clients can programmatically handle errors by code.

**5.9 Foreign key relationships in the schema**

Customer schemas declare foreign keys; GraphQL schemas need fields traversing them.

For each foreign key `posts.author_id → users.id`:

- A field `author` is added to `Post` returning `User` (the to-one direction)
- A field `posts` is added to `User` returning `PostConnection` (the to-many direction)

The to-one direction uses DataLoader keyed by the FK column. The to-many direction uses a connection with filter `where { authorId: { _eq: $userId } }`, also via DataLoader.

For Mongo schemas with advisory FKs (capability flag from Objective 4b), the same fields are generated, but with a comment in the schema that referential integrity is not database-enforced.

For schemas without an explicit FK, the platform doesn't generate cross-table fields. The customer adds an FK to enable them.

**5.10 GraphQL playground**

A page at `/data-management/<schema>/graphql-playground` provides:

- A query editor with auto-completion based on the schema
- A response panel
- An auth picker (use current session, or specify an API key)
- Schema documentation panel
- History of recent queries

This uses the `@graphiql/react` library or Apollo Sandbox embedded. It's a development/exploration tool, not a primary user-facing surface.

---

## 6. Component Specifications

### 6.1 GraphQL Schema Builder

```typescript
// packages/core/src/services/data-management/graphql/schema-builder.ts

export class GraphQLSchemaBuilder {
  build(customerSchema: CustomerSchema, capabilities: CapabilitySet): GraphQLSchema;
}
```

Pure function; takes the customer schema and capability set, produces a complete GraphQL schema using Pothos. No I/O. Cached per `(workspace, schema_version)`.

For each table:

- A type with all columns as fields (camelCase from snake_case)
- A filter input type with all valid operators per column
- A sort input type
- A connection type (Relay-style)
- An edge type
- For mutations: input types for create and update

For each foreign key:

- A relationship field on each side
- DataLoader registration

For each schema:

- A `Query` root type with `<table>`, `<table>List` (Relay connection), `<table>Count` fields
- A `Mutation` root type with `create<Table>`, `update<Table>`, `archive<Table>`, `restore<Table>`, `hardDelete<Table>` fields
- A `Subscription` root type stub (filled by Objective 14)

### 6.2 GraphQL Request Handler

```typescript
// packages/core/src/services/data-management/graphql/request-handler.ts

export class GraphQLRequestHandler {
  constructor(
    private readonly schemaBuilder: GraphQLSchemaBuilder,
    private readonly schemas: SchemaService,
    private readonly authz: AuthorizationPort,
    private readonly repos: PerWorkspaceRepositoryFactory,
    private readonly audit: AuditPort,
    private readonly logger: LoggerPort,
    private readonly metrics: MetricsPort,
    private readonly rateLimiter: RateLimiterPort,
  ) {}

  async handle(request: GraphQLApiRequest): Promise<GraphQLApiResponse>;
}
```

Wraps `graphql-yoga` with the platform's middleware: auth, workspace resolution, schema resolution, schema build (cached), then yoga executes.

### 6.3 DataLoader Factory

```typescript
// packages/core/src/services/data-management/graphql/dataloader-factory.ts

export class DataLoaderFactory {
  /**
   * Create a request-scoped collection of DataLoaders for a given workspace and schema.
   * One loader per (table, foreign_key_column) pair used in the query.
   */
  forRequest(ctx: RequestContext, schema: CustomerSchema, repos: PerWorkspaceRepositoryFactory): RequestLoaders;
}

export interface RequestLoaders {
  /** Get a loader for "fetch <table> rows by primary key". */
  byId<T>(tableId: string): DataLoader<string, T | null>;

  /** Get a loader for "fetch <table> rows by a foreign key column". */
  byForeignKey<T>(tableId: string, fkColumn: string): DataLoader<string, T[]>;
}
```

One factory at startup; one set of loaders per request. Loaders are GC'd at request end.

### 6.4 Resolver Implementations

Resolvers are constructed from schema metadata, not hand-written per table. A small set of generic resolvers handles all tables:

```typescript
// packages/core/src/services/data-management/graphql/resolvers.ts

export const resolvers = {
  // For Query.<table>List
  listResolver: async (parent, args, context, info) => {
    await context.authz.authorize(context.ctx, 'data_table.read', `data_table:${context.schema.slug}:${tableName}`);
    const filter = parseGraphQLFilter(args.filter, context.tableDef);
    const sort = parseGraphQLSort(args.sort, context.tableDef);
    const repo = context.repos.getRepository(context.workspace.id, context.schema, tableId);
    // Fetch with cursor pagination; wrap in connection
    return makeConnection(repo, filter, sort, args);
  },

  // For Query.<table>(id: ID!)
  getOneResolver: async (parent, args, context) => {
    /* ... */
  },

  // For Mutation.create<Table>
  createResolver: async (parent, args, context) => {
    /* validate, authorize, execute, audit */
  },

  // For Mutation.update<Table>
  updateResolver: async (parent, args, context) => {
    /* ... */
  },

  // ... etc
};
```

The schema builder wires these to the Pothos type definitions for each table.

### 6.5 Filter and Sort GraphQL Input Types

Filter inputs are generated per table:

```graphql
input UserFilter {
  id: UUIDFilter
  email: StringFilter
  active: BooleanFilter
  createdAt: DateTimeFilter
  _and: [UserFilter!]
  _or: [UserFilter!]
  _not: UserFilter
}

input StringFilter {
  _eq: String
  _neq: String
  _in: [String!]
  _nin: [String!]
  _contains: String
  _icontains: String
  _starts_with: String
  _ends_with: String
  _is_null: Boolean
}
```

The filter parser (extending Objective 12's REST filter parser) translates these into the platform's Filter AST.

### 6.6 Connection Helper

```typescript
// packages/core/src/services/data-management/graphql/connection.ts

export async function makeConnection<T extends { id: string }>(repo: RepositoryPort<T>, filter: Filter<T>, sort: SortSpec, args: ConnectionArgs): Promise<Connection<T>> {
  // 1. Decode the cursor (if provided) into a pagination position
  // 2. Apply filter + sort + cursor-derived constraint
  // 3. Fetch first/last + 1 to determine hasNext/hasPrevious
  // 4. Construct edges with cursors
  // 5. Construct PageInfo
  // 6. Optionally fetch totalCount if requested
  // 7. Return connection
}
```

Same helper used by every list field. The "fetch first+1 to determine hasNext" pattern is standard.

### 6.7 Mutation Result Types

For each mutating operation, a tagged union result type:

```typescript
// Generator produces, for each table, types like:

interface CreateUserSuccess {
  __typename: 'CreateUserSuccess';
  user: User;
}

interface ValidationErrorResult {
  __typename: 'ValidationError';
  errors: FieldError[];
}

// ... and the union:
type CreateUserResult = CreateUserSuccess | ValidationErrorResult | ConflictError | AuthorizationErrorResult;
```

The resolver returns the appropriate variant; the GraphQL schema picks the right type based on `__typename`.

### 6.8 Persisted Query Storage

```typescript
persisted_queries: {
  ...standardColumns,
  workspace_id: uuid,
  schema_id: uuid,
  query_hash: char(64),       // SHA-256 of the normalized query string
  query_text: text,
  name: string(255)?,
  description: text?,
  registered_by_user_id: uuid,
}
unique: [workspace_id, schema_id, query_hash]
```

When persisted-queries-only mode is enabled, the request handler rejects queries whose hash isn't in this table.

### 6.9 GraphQL Playground UI

A new page in the data management module: `/data-management/<schema>/graphql-playground`. Embeds GraphiQL with:

- Endpoint pre-configured to the workspace's GraphQL URL
- Auth bearer token pulled from the current session
- Schema introspection enabled
- History stored in the browser (not the platform)

Permission: requires `schema.read` on the schema. The playground runs queries as the authenticated user, with all the usual permission checks.

### 6.10 Audit Events

GraphQL-specific audit events extending Objective 12's:

```
data_management.graphql.query_executed (sampled, not on every query)
data_management.graphql.mutation_executed (always; includes mutation name)
data_management.graphql.query_complexity_exceeded
data_management.graphql.query_depth_exceeded
data_management.graphql.persisted_query_registered
data_management.graphql.persisted_query_revoked
data_management.graphql.introspection_query (sampled, useful for security review)
```

Mutation events use the same event types as REST mutations (`data_management.api.row_created`, etc.) — the platform doesn't care which surface created the row, just that one was created.

### 6.11 Observability

GraphQL-specific metrics:

- `platform_graphql_queries_total{workspace, operation_name, status}` — counter
- `platform_graphql_query_duration_seconds{workspace, operation_name}` — histogram
- `platform_graphql_query_complexity{workspace}` — histogram
- `platform_graphql_query_depth{workspace}` — histogram
- `platform_graphql_resolver_calls_total{workspace, type, field}` — counter
- `platform_graphql_dataloader_batch_size{workspace, table}` — histogram
- `platform_graphql_persisted_query_hits_total{workspace}` — counter
- `platform_graphql_complexity_exceeded_total{workspace}` — counter

Slow queries (> 2s) emit warnings; > 10s emit errors.

### 6.12 Operational Runbooks

New files in `docs/runbooks/`:

- `graphql-query-too-complex.md` — diagnosing complexity-limit rejections; how to adjust limits per workspace
- `graphql-n-plus-one-investigation.md` — using DataLoader metrics to find N+1 patterns
- `graphql-persisted-query-management.md` — registering, listing, revoking persisted queries
- `graphql-introspection-disabled.md` — when and why to disable introspection

---

## 7. Implementation Order

1. **Pothos schema generator** — given a CustomerSchema, produce a GraphQL schema with types for one simple test schema. Verify with introspection.

2. **Wire graphql-yoga into Fastify** — single test endpoint that runs against a hand-constructed schema; verify auth, workspace resolution, request handling.

3. **Generic list resolver** — implement once; wire it to all tables. Verify pagination, filter, sort.

4. **Get-one resolver** with field selection. Verify N+1 absence with DataLoader.

5. **Create, update, archive, restore mutations** with tagged union result types. Verify validation errors propagate correctly.

6. **Foreign key field resolvers** with DataLoader batching. Verify single SQL query for `users { posts }`.

7. **Filter input type generation** — every operator per column type, validated at GraphQL parse time.

8. **Sort input type generation.**

9. **Connection helper** with cursor encoding/decoding.

10. **Depth and complexity limiting** — enforce at validation time.

11. **Authorization at every resolver** — partial errors for forbidden fields.

12. **Persisted query support** — registration, lookup, "persisted-queries-only" mode.

13. **GraphQL playground UI page.**

14. **Audit events on every mutation.**

15. **Observability** — metrics, traces, slow-query alerting.

16. **Conformance tests** — same query, three databases, equivalent results.

17. **Performance tests** — typical queries against a schema with 5 tables and 100k rows total; baseline established.

18. **Documentation**: runbooks, ADRs, customer-facing docs.

19. **Verify Definition of Done.**

---

## 8. ADRs to Write

- **ADR-0105: Pothos for Code-First Schema Construction** — alternatives (graphql-tools SDL-first, TypeGraphQL); why Pothos
- **ADR-0106: graphql-yoga as the Server** — alternatives (Apollo Server, mercurius); why yoga
- **ADR-0107: DataLoader for N+1 Prevention** — request-scoped, per-table loaders; why mandatory
- **ADR-0108: Tagged Union Mutation Results** — vs. flat-error; client safety rationale
- **ADR-0109: Query Complexity Scoring** — algorithm, defaults, customer override path
- **ADR-0110: Persisted Queries as Opt-In** — when to enable; what it gains and costs
- **ADR-0111: Introspection On by Default** — security trade-off; how to disable per workspace

---

## 9. Verification Steps

1. **GraphQL endpoint responds** to a simple query; returns valid data.

2. **Introspection** returns the expected schema for a sample customer schema.

3. **List queries** return correctly with filter, sort, pagination.

4. **Cursor pagination** delivers all rows iteratively without duplicates or gaps.

5. **Connection types** include correct `pageInfo` (hasNextPage, hasPreviousPage, cursors).

6. **Foreign key traversal** works: `users { posts { title } }` returns user with their posts.

7. **DataLoader prevents N+1**: query for 100 users with posts produces ~2 database queries (one for users, one for all their posts), not 101.

8. **Mutation success** returns the typed Success variant.

9. **Mutation validation failure** returns the ValidationError variant; original data unchanged.

10. **Mutation conflict** returns ConflictError variant for optimistic-lock conflicts.

11. **Authorization at field level**: a query with one forbidden field returns the rest of the data plus an error for the forbidden field.

12. **Depth limit enforcement**: a query with depth > 10 is rejected at validation time.

13. **Complexity limit enforcement**: a query with too-high complexity is rejected at validation time.

14. **Persisted query registration and execution** works.

15. **Persisted-queries-only mode** rejects ad-hoc queries when enabled.

16. **Introspection can be disabled** per workspace; introspection queries return appropriate error.

17. **GraphQL playground page** loads and runs queries against the live API.

18. **Audit events**: every mutation produces an audit entry; complexity exceeded events fire when triggered.

19. **Performance**: a typical query (3 tables, 50 rows each) p95 < 200ms.

20. **Cross-database conformance**: same query, same data, equivalent results on Postgres, MSSQL, Mongo (modulo capability gaps).

21. **Schema change propagation**: deploy a schema change; subsequent GraphQL requests reflect new schema within cache TTL.

22. **Error format**: errors include extensions with `code` and `correlationId`.

23. **REST and GraphQL parity**: a row created via REST is visible via GraphQL; a row created via GraphQL is visible via REST. Same audit chain.

24. **Mongo advisory FKs**: GraphQL relationship fields work; resolver doesn't crash on a missing referenced row (returns null with appropriate error).

If all 24 pass, the objective is met.

---

## 10. Definition of Done

**Schema Building**

- [ ] Pothos-based GraphQL schema generator
- [ ] Filter input types per column type
- [ ] Sort input types
- [ ] Connection types (Relay-style)
- [ ] Mutation result tagged unions
- [ ] Foreign key relationship fields generated
- [ ] Schema cached per (workspace, version)

**Request Pipeline**

- [ ] graphql-yoga integration with Fastify
- [ ] Auth, workspace, schema resolution shared with REST
- [ ] DataLoader factory and per-request loaders
- [ ] Depth limiting
- [ ] Complexity scoring and limiting

**Operations**

- [ ] List with filter, sort, pagination, field selection
- [ ] Get-one with field selection
- [ ] Count
- [ ] Create, update, archive, restore, hardDelete mutations
- [ ] Foreign key traversal in queries

**Persisted Queries**

- [ ] persisted_queries schema migrated
- [ ] Registration / lookup / revocation
- [ ] Persisted-queries-only mode

**Playground**

- [ ] GraphQL playground page
- [ ] Schema introspection working (and disable-able)

**Authorization**

- [ ] Field-level authorization
- [ ] Partial errors for forbidden fields
- [ ] Same RBAC as REST

**Audit & Observability**

- [ ] Audit events emitted
- [ ] Metrics for queries, complexity, depth, DataLoader batches
- [ ] Slow query alerts

**Conformance**

- [ ] Cross-database conformance tests pass
- [ ] REST/GraphQL parity tests (row created in one visible in the other)
- [ ] N+1 absence verified

**Performance**

- [ ] Typical query p95 < 200ms
- [ ] DataLoader batch size > 10 average for foreign-key heavy queries

**Documentation**

- [ ] ADRs 0105–0111 written and Accepted
- [ ] All runbooks in Section 6.12 written
- [ ] Customer-facing GraphQL guide
- [ ] Introspection disable rationale documented

**Verification**

- [ ] All 24 verification steps in Section 9 pass

---

## 11. Anti-Patterns to Refuse

- **Skipping DataLoader because "it works without it for small data."** N+1 is invisible until production. DataLoader from day one.
- **Returning errors via a flat `error` field on the mutation type.** Tagged unions force handling. Worth the verbosity.
- **Hand-writing resolvers per table.** Generic resolvers driven by schema metadata. Per-table specifics (custom logic) are deferred to edge functions.
- **Allowing unbounded query depth or complexity.** Limits protect the server. Configurable per workspace, but always bounded.
- **Caching queries server-side beyond the request scope.** Per-request DataLoader is fine; cross-request caching is a separate, opt-in feature with cache invalidation concerns.
- **Adding subscriptions to this objective.** Objective 14 owns subscriptions; this objective leaves the placeholder.
- **Skipping introspection in production.** It's useful for tooling. Customers can disable it per workspace if their threat model requires.
- **Letting persisted queries be the only mode by default.** Opt-in per workspace; default is open with limits.
- **Ignoring the audit events for queries "because volume."** Mutations are always audited; queries are sampled (configurable rate); high-security workspaces enable full query audit.
- **Returning internal database errors in GraphQL extensions.** Same discipline as REST: errors go through the central formatter; internal details stay in logs.

---

## 12. Open Questions for Confirmation Before Starting

1. **Pothos vs. SDL-first** — Pothos is code-first (TypeScript constructs the schema). SDL-first (write GraphQL strings, attach resolvers) is more familiar to many developers. Recommendation: Pothos for runtime generation. Confirmed?

2. **Default depth limit of 10** — too tight, too loose? Recommendation: 10 covers 99% of legitimate queries; high-end use cases configurable per workspace.

3. **Default complexity budget of 1000** — calibration needed against realistic queries. Recommendation: start at 1000; tune after seeing real-world traffic.

4. **Persisted queries in v1** — proposing it ships as opt-in. Some platforms make it always-on; others defer it entirely. Recommendation: ship the infrastructure; default to opt-in.

5. **Introspection default** — proposing on by default. Some prefer off in production. Recommendation: on by default; per-workspace toggle. Document the trade-offs.

6. **GraphQL playground** — proposing it's part of v1. Alternative: defer to a follow-up. Recommendation: ship a basic GraphiQL embed; it's table stakes for GraphQL adoption.

7. **Subscription stub** — proposing the GraphQL schema generates a `Subscription` root type with placeholder fields, filled in Objective 14. Confirmed?

---

## 13. What Comes Next

With Objective 13 complete, customers have **two API surfaces** for the same data: REST for simple cases, GraphQL for clients that benefit from typed cross-table queries. Both share authentication, authorization, audit, observability — they're different surfaces on the same engine.

**Objective 14: Real-Time Subscriptions** is next. The killer feature. Using the change streams from Objective 4d, expose live updates to clients via WebSocket — both as REST-style server-sent events and as GraphQL subscriptions. This is the feature that separates the platform from "just a CRUD generator" — live tables, live queries, live UI updates, on Postgres, MSSQL, AND Mongo.

After 14, the data plane is complete. Then come the user-facing surfaces:

- **15**: Storage browser and file management
- **16**: Auth and user management UI
- **17**: Query console
- **18**: Data browser and editor
- **19**: Public SDK (the "Supabase client equivalent")

By Objective 19, the Data Management Module is a complete product.

---

_This document is the contract. Every checkbox in Section 10 must be true before moving on to Objective 14._
