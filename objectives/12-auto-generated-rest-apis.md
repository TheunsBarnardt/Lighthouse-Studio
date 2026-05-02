# Objective 12: Auto-Generated REST APIs

**Status:** Ready for development
**Prerequisites:** Objective 11 (Schema Designer) complete; all foundation objectives complete
**Blocks:** Objective 13 (GraphQL — shares some infrastructure), Objective 14 (Real-time — uses similar permission model), Objective 19 (Public SDK)

---

## 1. Purpose

Given a customer-defined schema, automatically expose a complete, typed, paginated, filterable, permission-enforced REST API. The customer's developers should be able to call these endpoints from any client (web app, mobile app, server-side script) and get the same correctness, performance, and observability guarantees the platform itself uses internally.

This is the second visible feature of the Data Management Module, and it is the one that turns "we have a nice schema designer" into "we are a Supabase competitor." Without auto-generated APIs, the schema designer is a fancy ER diagram tool. With them, the platform becomes a backend customers can build real applications on top of.

The generation is **runtime-driven**, not codegen — the customer doesn't compile and deploy code; they edit a schema in the UI and the new endpoints appear immediately. This is what makes the iteration loop tight: schema change → API change in seconds, not minutes.

This objective produces no new infrastructure — every piece it depends on already exists from earlier objectives. It produces the **API surface** that turns those pieces into a product.

---

## 2. Scope

### In Scope

- A request handler factory that, given a schema, produces routes per table
- CRUD endpoints per table: list, get-one, create, update, archive (soft-delete), restore, hard-delete
- Filtering via the Filter AST translated to URL query parameters
- Pagination: cursor-based and offset-based
- Sorting: per-column, multi-column
- Field selection (sparse fieldsets): clients can request a subset of columns
- Permission enforcement at every endpoint, leveraging the RBAC from Objective 6
- Per-row permissions where applicable (resource ownership, column-level access)
- Rate limiting per workspace and per API key
- API key management (a basic version; full service-account work is a separate later objective)
- Auto-generated OpenAPI specification per workspace
- Auto-generated TypeScript client types per workspace (for the SDK in Objective 19)
- Validation: every input validated against the schema's column types and constraints
- Error responses: typed, structured, RFC 7807-style problem details
- Audit events on every mutation
- Observability: per-endpoint metrics, traces, logs
- Versioning: a schema version number in the URL path enables backwards-compatibility windows
- Conformance tests: the same generated API works equivalently across all three databases
- ADRs

### Out of Scope (Belongs to Later Objectives)

- GraphQL (Objective 13)
- Real-time subscriptions / WebSocket (Objective 14)
- File upload endpoints (Objective 15 — storage)
- Auth endpoints (Objective 16 — uses the auth from Objective 5; just exposed)
- Custom RPC-style endpoints (deferred; if a customer needs custom logic, they write a function — covered by a later "edge functions" objective)
- Stored procedure / function calling via API (deferred until clear customer demand)
- Cross-table joins via API parameters (e.g., `?include=related_table`) — deferred to Objective 13's GraphQL where it's natural
- Full-text search endpoints (deferred; enabled by Section 5.13 in this objective at a basic level, expanded later)
- Aggregation endpoints (count, sum, avg, group by) — basic count is in scope; full aggregation deferred

---

## 3. Locked Decisions

| Decision                      | Choice                                                                                           | Rationale                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| Path prefix for customer APIs | `/api/v1/data/<workspace_slug>/<schema_slug>/<table_name>`                                       | Workspace-scoped; clear; versioned          |
| API versioning                | URL-path versioning (`/v1/`, `/v2/`); current version follows the schema's deployed version      | Simple, debuggable, customer-readable       |
| HTTP framework                | Fastify (already established in Objective 1.5)                                                   | Fast, schema-aware, OpenAPI-friendly        |
| Authentication                | Session token (cookie or Bearer); API keys for server-to-server                                  | Two paths covered                           |
| Authorization                 | RBAC from Objective 6, scoped to workspace                                                       | Reuse, not reinvent                         |
| API key storage               | Hashed (HMAC-SHA-256) with a key-id prefix for lookup                                            | Standard pattern; revocable                 |
| Rate limiting                 | Token bucket per (workspace, principal); configurable per workspace                              | Reasonable defaults; tunable                |
| Filter parameter syntax       | `?filter[field][operator]=value` style; e.g., `?filter[email][_eq]=alice@example.com`            | Simple; encodes the Filter AST cleanly      |
| Pagination                    | Cursor-based default; offset supported with caveats (slow on large tables)                       | Cursor for production; offset for ad-hoc    |
| Default page size             | 50; max 1000                                                                                     | Reasonable; configurable by workspace admin |
| Sort syntax                   | `?sort=field` ascending; `?sort=-field` descending; multiple via comma                           | Standard convention                         |
| Field selection               | `?fields=col1,col2,col3`                                                                         | Standard convention                         |
| Response envelope             | `{ data: [...], meta: { ... }, errors: [...] }` for collections; raw object for single resources | Pragmatic; metadata for pagination/etc.     |
| Error format                  | RFC 7807 Problem Details JSON                                                                    | Standard; structured; debuggable            |
| OpenAPI version               | 3.1                                                                                              | Current; supports JSON Schema draft 2020-12 |
| OpenAPI surface               | Per-workspace, generated on demand at `/api/v1/data/<workspace_slug>/openapi.json`               | Always reflects the live schema             |
| Idempotency                   | `Idempotency-Key` header on mutating endpoints; uses the idempotency table from Objective 8      | Standard; safe retry                        |
| CORS                          | Configurable per workspace; default deny; admin enables specific origins                         | Defense by default                          |
| Response compression          | gzip / brotli when client supports                                                               | Standard                                    |
| Request size limits           | 10 MB default body; configurable                                                                 | Sane default                                |
| Bulk operations               | Bulk create (`POST /<table>/bulk`); bulk update / delete via filter; with explicit limits        | Common need; bounded                        |

---

## 4. Architectural Overview

```
                  Client Request
                  GET /api/v1/data/acme/main/users?filter[active][_eq]=true&fields=id,email&sort=-created_at&limit=50
                           │
                           ▼
                ┌────────────────────────┐
                │   Fastify HTTP Server   │
                │   - TLS, compression    │
                │   - Request logging     │
                └───────────┬────────────┘
                            │
                            ▼
                ┌────────────────────────┐
                │   Auth Middleware       │
                │   - Validates session   │
                │     or API key          │
                │   - Loads RequestContext│
                └───────────┬────────────┘
                            │
                            ▼
                ┌────────────────────────┐
                │  Workspace Resolver     │
                │  - acme → workspaceId   │
                │  - Verifies membership  │
                └───────────┬────────────┘
                            │
                            ▼
                ┌────────────────────────┐
                │   Schema Resolver       │
                │  - main → schemaId      │
                │  - Loads current schema │
                │  - Caches per request   │
                └───────────┬────────────┘
                            │
                            ▼
                ┌────────────────────────┐
                │   Table Resolver        │
                │  - users → table def    │
                │  - Verifies exists      │
                └───────────┬────────────┘
                            │
                            ▼
                ┌────────────────────────┐
                │   Authorization        │
                │  - data_table.read on   │
                │    cust_acme.users      │
                └───────────┬────────────┘
                            │
                            ▼
                ┌────────────────────────┐
                │   Query Builder         │
                │  - Translates URL params│
                │    into Filter AST,     │
                │    SortSpec, etc.       │
                │  - Validates fields     │
                │    against schema       │
                └───────────┬────────────┘
                            │
                            ▼
                ┌────────────────────────┐
                │   Repository Call       │
                │  - findMany via the     │
                │    persistence port     │
                │  - Workspace filter     │
                │    auto-injected        │
                └───────────┬────────────┘
                            │
                            ▼
                ┌────────────────────────┐
                │   Response Shaper       │
                │  - Field projection     │
                │  - Cursor encoding      │
                │  - Audit emission       │
                │    (read events at      │
                │    debug, mutations     │
                │    at info)             │
                └───────────┬────────────┘
                            │
                            ▼
                       JSON Response
```

This pipeline is the same for every endpoint. The endpoint's specific behavior is determined by the table's schema definition and the operation's HTTP method. Code is shared aggressively; per-table customization is data-driven, not code-driven.

---

## 5. The Hard Parts

**5.1 Generating routes at runtime, not at startup**

Customer schemas change. New tables appear; columns are added; the API must reflect this without a process restart. The platform's approach:

- Endpoints are **not** registered as static Fastify routes
- Instead, a small set of **wildcard routes** (`/api/v1/data/:workspace/:schema/:table` and variants) catches all customer API calls
- The handler resolves the schema and table at request time, dispatches accordingly
- A **request-scoped cache** (lifetime: one request) holds the resolved schema; a **workspace-scoped cache** (TTL: 60 seconds, invalidated on schema deploy) holds the schema definition

This means a schema deploy at time T causes all subsequent requests at time T+1 to see the new schema. Old in-flight requests complete with the old schema. No restart required.

**5.2 Permission enforcement at three levels**

Permissions for customer APIs operate at three nesting levels:

1. **Workspace-level**: the principal must be a member of the workspace whose API they're calling
2. **Schema-level**: the principal must have `data_table.read` (or equivalent) permission on the schema
3. **Table-level / row-level**: the principal must have permission on the specific table; for row-level constraints, the filter is augmented automatically

Workspace and schema levels reuse RBAC from Objective 6. Table-level adds a new permission resource: `data_table:<schema>:<table>` with actions `read`, `create`, `update`, `delete`. Default role mappings are workspace-wide; per-table grants are an advanced capability that the platform supports but doesn't surface in the basic UI.

Row-level permissions in this initial objective are limited to "owner ID matches the requesting user." More general row-level rules (RLS-style policies) are deferred unless customer demand justifies the complexity.

**5.3 Filter parameter parsing safely**

URL query parameters are untrusted. The filter parameter syntax `?filter[email][_eq]=alice@example.com` must:

- Parse to the platform's Filter AST
- Validate that field names exist in the table schema
- Validate that operators are valid for the column types
- Validate that values are valid for the column types (`?filter[count][_eq]=not_a_number` rejected)
- Reject any expression that exceeds depth or breadth limits (DoS protection)
- Never allow string interpolation into SQL or Mongo queries

The parsing happens in the API layer; the resulting Filter AST goes through the existing Filter translator from Objective 4 family, which has had property-based testing for safety.

**5.4 Pagination correctness across databases**

Cursor pagination works the same on Postgres, MSSQL, and Mongo:

- Sort by a stable key (default: primary key, which is UUID v7 / time-ordered)
- The cursor is `{ key: <value>, direction: 'after' | 'before' }`, encoded as a base64url string
- On the next page, filter `WHERE key > cursor_value` (or `<` for before)
- The cursor is opaque to clients; clients pass it back unchanged

Offset pagination works but is documented as inferior:

- `?offset=N&limit=M` translates to `OFFSET N LIMIT M` (Postgres/MSSQL) or `skip(N).limit(M)` (Mongo)
- For large offsets, this is slow on every database
- The API includes a warning header (`X-Pagination-Performance-Warning`) when offset > 1000

The OpenAPI spec describes both options; the SDK uses cursor by default.

**5.5 Bulk operations with bounds**

Customers occasionally need to create many records at once, or update / delete by filter. The platform supports:

- `POST /<table>/bulk` with an array of records — limited to 1000 records per request
- `PATCH /<table>?filter=...` — updates all matching records, limited by a `Max-Affected-Rows` header (default 10,000; configurable per workspace)
- `DELETE /<table>?filter=...` — same constraints as bulk update

For larger operations, the customer uses the data export/import paths or writes a script that calls the API in chunks.

These bulk operations:

- Wrap in a transaction
- Audit ONE event per bulk operation (with the count and filter), not one per row
- Return per-record results in the response so failures within a bulk are visible

**5.6 OpenAPI generation**

The platform generates an OpenAPI 3.1 document for every workspace's schema. Endpoint at:

```
GET /api/v1/data/<workspace_slug>/openapi.json
```

The document is generated on demand from the schema. Caching: the generated spec is cached per (workspace, schema_version) tuple; cache invalidates on schema deploy.

The spec includes:

- Per-table CRUD endpoints with full type information
- Authentication schemes (bearer token, API key)
- Error schemas (RFC 7807 problem details)
- Pagination parameters
- Filter parameter syntax (described as a custom parameter style)
- Server URL pointing at the live API endpoint

This is the document that powers the SDK generation in Objective 19, the API documentation page (referenced in Section 5.7), and any external tooling the customer uses (Postman, Insomnia, etc.).

**5.7 API explorer / docs page**

A dedicated page at `/data-management/<schema>/api-explorer` shows:

- The full endpoint list with descriptions
- Per-endpoint try-it-now form (auth-aware)
- Sample requests in curl, JavaScript, Python
- The OpenAPI JSON download link

This is generated from the same OpenAPI spec, using a Swagger UI / Redoc-style component.

**5.8 Idempotency**

Mutating endpoints (POST, PUT, PATCH, DELETE) accept an `Idempotency-Key` header. The platform's idempotency layer from Objective 8 handles the rest:

- Same key + same operation within window → return cached response
- Same key + different operation → 409 Conflict
- Window expired → fresh execution

This is what enables clients to retry safely after network failures.

**5.9 The "RPC" temptation**

A common request will be: "let me expose a custom function as an endpoint." The platform deliberately defers this for now:

- Custom code raises questions about isolation, resource limits, runtime, deployment
- "Edge functions" or "database functions" are a meaningful product feature in their own right
- For the initial scope, customers needing custom logic write client-side code that orchestrates multiple API calls

A future objective will add edge functions; this objective doesn't preclude that but doesn't include it.

**5.10 Response shaping and serialization**

Every response goes through a shaping step that:

- Projects requested fields (sparse fieldsets)
- Strips PII fields if the requesting principal lacks `pii.read` permission for that PII category
- Converts dates to ISO 8601 strings
- Converts decimals to strings (avoid JSON number precision issues)
- Encodes binary as base64
- Encodes UUIDs as canonical hyphenated form

The shaping is data-driven: the schema's column metadata determines how each field is serialized. PII redaction is mechanical: if a column is tagged PII and the principal lacks read access to that category, the value is replaced with `null` (and the response includes `"redacted": ["email", "phone"]` in the meta block so the client knows what's hidden).

**5.11 Error responses**

All errors follow RFC 7807 Problem Details:

```json
{
  "type": "https://platform.example.com/errors/validation",
  "title": "Request validation failed",
  "status": 400,
  "detail": "The 'email' field is required",
  "instance": "/api/v1/data/acme/main/users",
  "errors": [{ "field": "email", "code": "REQUIRED", "message": "Email is required" }],
  "correlationId": "abc123"
}
```

The `type` URL points to platform documentation explaining each error type. The `correlationId` matches the audit log entry; support can find the request by it.

Error responses never leak internal details (stack traces, SQL, internal IDs other than correlationId). All error generation goes through a centralized formatter.

---

## 6. Component Specifications

### 6.1 The Endpoint Generator Service

Services don't exist for "the API"; the API is generated. But the generation logic itself is a service-like component:

```typescript
// packages/core/src/services/data-management/api-generator.ts

export class ApiRequestHandler {
  constructor(
    private readonly schemas: SchemaService,
    private readonly authz: AuthorizationPort,
    private readonly repos: PerWorkspaceRepositoryFactory,
    private readonly audit: AuditPort,
    private readonly logger: LoggerPort,
    private readonly idempotency: IdempotencyPort,
    private readonly rateLimiter: RateLimiterPort,
    private readonly metrics: MetricsPort,
  ) {}

  async handle(request: ApiRequest): Promise<ApiResponse> {
    // 1. Resolve workspace, schema, table
    // 2. Authorize
    // 3. Rate limit
    // 4. Check idempotency
    // 5. Parse and validate request (filter, pagination, body)
    // 6. Dispatch to operation handler (list/get/create/update/...)
    // 7. Shape response
    // 8. Audit (mutations always; reads at debug)
    // 9. Return
  }
}
```

This handler is registered behind the wildcard Fastify route. Per-operation logic lives in operation handlers (`ListOperation`, `GetOperation`, `CreateOperation`, etc.) that share infrastructure.

### 6.2 Per-Workspace Repository Factory

Customer tables live in workspace-scoped database namespaces (from Objective 11). The repository for a customer table is constructed on demand per workspace and table:

```typescript
// packages/core/src/services/data-management/per-workspace-repository-factory.ts

export class PerWorkspaceRepositoryFactory {
  constructor(
    private readonly persistence: PersistenceContainer,
    private readonly logger: LoggerPort,
  ) {}

  /**
   * Get a repository for a customer table in a specific workspace.
   * Cached per (workspace, table_id) pair; cache invalidated on schema deploy.
   */
  getRepository<T>(workspaceId: string, schema: CustomerSchema, tableId: string): RepositoryPort<T> {
    // Builds an adapter-specific repository with:
    // - The right database connection (with the workspace-scoped role)
    // - The right table/collection name (cust_<workspace_slug>.<table_name>)
    // - The right column mapping (from the schema's TableDefinition)
  }
}
```

This factory is the bridge between schema metadata and the actual data plane.

### 6.3 Filter Parameter Parser

```typescript
// packages/core/src/services/data-management/filter-parser.ts

export interface FilterParser {
  parse(queryParams: Record<string, string | string[]>, schema: TableDefinition): Result<Filter<unknown>, FilterParseError>;
}

export interface FilterParseError {
  field?: string;
  operator?: string;
  reason: 'unknown_field' | 'invalid_operator' | 'invalid_value' | 'too_complex';
  message: string;
}
```

The parser:

- Walks the query parameters looking for `filter[*][*]=*` patterns
- Validates each against the table's column definitions
- Builds the Filter AST recursively for nested logical operators (`filter[_and][0][...]`, etc.)
- Rejects expressions exceeding depth (10) or breadth (100 conditions) limits

### 6.4 OpenAPI Generator

```typescript
// packages/core/src/services/data-management/openapi-generator.ts

export class OpenApiGenerator {
  generate(workspace: Workspace, schema: CustomerSchema): OpenApiDocument;
}
```

Pure function; no I/O. Given a schema, produces the full OpenAPI 3.1 document. Used by both the `/openapi.json` endpoint and the SDK generation (Objective 19).

### 6.5 API Key Management

A minimal API key system for now (full service-account work is later):

```typescript
// packages/core/src/services/data-management/api-key.service.ts

export class ApiKeyService {
  async create(ctx: RequestContext, input: { name: string; workspaceId: string; expiresAt?: Date; permissions?: string[] }): Promise<Result<{ id: string; key: string }, AppError>>;
  // Returns the plaintext key ONCE; subsequent reads only show the key id and prefix

  async list(ctx: RequestContext, workspaceId: string): Promise<Result<ApiKey[], AppError>>;
  async revoke(ctx: RequestContext, keyId: string): Promise<Result<void, AppError>>;
  async verify(rawKey: string): Promise<Result<ApiKeyPrincipal, AppError>>;
}
```

Schema:

```typescript
api_keys: {
  ...standardColumns,
  workspace_id: uuid,
  name: string(255),
  key_prefix: string(8),     // first 8 chars of the key, for display
  key_hash: char(64),        // HMAC-SHA-256 of the full key
  permissions: json,         // optional permission overrides
  expires_at: timestamp?,
  last_used_at: timestamp?,
  revoked_at: timestamp?,
  created_by_user_id: uuid,
}
unique: [key_hash]
indexes: [workspace_id, key_prefix]
```

API keys are bearer tokens: `Authorization: Bearer pkey_<prefix>_<rest>`. The prefix lets the platform look up by `key_prefix` index; the rest is verified via HMAC against `key_hash`.

### 6.6 Rate Limiting

Token bucket per (workspace, principal):

```typescript
// packages/ports/rate-limiter/src/rate-limiter.port.ts

export interface RateLimiterPort {
  check(opts: {
    bucketKey: string;
    capacity: number; // bucket size
    refillRate: number; // tokens per second
    cost: number; // tokens consumed by this request
  }): Promise<Result<{ allowed: boolean; retryAfterMs?: number }, RateLimitError>>;
}
```

Adapters:

- **In-memory** (development; single-process)
- **Redis** (recommended for production; enables sharing across multiple instances)
- **Database-backed** (fallback; works without Redis, slower)

Default limits per workspace:

- 1000 requests per minute per principal
- Bulk endpoints count as 10x

Workspace admins can adjust per workspace; per-API-key custom limits are also supported.

### 6.7 Operation Handlers

Each operation type is a class that handles its specific logic:

```typescript
abstract class OperationHandler {
  abstract execute(ctx: RequestContext, schema: CustomerSchema, table: TableDefinition, request: ApiRequest): Promise<Result<unknown, AppError>>;
}

class ListOperation extends OperationHandler {
  /* handles GET /<table> */
}
class GetOneOperation extends OperationHandler {
  /* handles GET /<table>/<id> */
}
class CreateOperation extends OperationHandler {
  /* handles POST /<table> */
}
class BulkCreateOperation extends OperationHandler {
  /* handles POST /<table>/bulk */
}
class UpdateOperation extends OperationHandler {
  /* handles PUT/PATCH /<table>/<id> */
}
class BulkUpdateOperation extends OperationHandler {
  /* handles PATCH /<table>?filter=... */
}
class ArchiveOperation extends OperationHandler {
  /* handles DELETE /<table>/<id> (soft) */
}
class RestoreOperation extends OperationHandler {
  /* handles POST /<table>/<id>/restore */
}
class HardDeleteOperation extends OperationHandler {
  /* handles DELETE /<table>/<id>?hard=true */
}
class CountOperation extends OperationHandler {
  /* handles GET /<table>/count */
}
```

Each follows the canonical service pattern from Objective 8: validate input, authorize, execute, audit, return.

### 6.8 Audit Events

API-specific audit events:

```
data_management.api.row_created
data_management.api.row_updated
data_management.api.row_archived
data_management.api.row_restored
data_management.api.row_hard_deleted
data_management.api.bulk_created (with count)
data_management.api.bulk_updated (with count + filter)
data_management.api.bulk_deleted (with count + filter)
data_management.api.read_denied (when authorization fails)
data_management.api.rate_limited
data_management.api.api_key_created
data_management.api.api_key_revoked
data_management.api.api_key_used (sampled, not on every request)
```

Read operations are NOT audited by default (volume); when a workspace enables elevated audit (e.g., for HIPAA), reads of PII-tagged columns are audited.

### 6.9 Observability

Per-endpoint metrics:

- `platform_api_requests_total{workspace, schema, table, method, status}` — counter
- `platform_api_request_duration_seconds{workspace, schema, table, method}` — histogram
- `platform_api_active_requests{workspace}` — gauge
- `platform_api_rate_limit_rejections_total{workspace, principal_kind}` — counter
- `platform_api_validation_errors_total{workspace, table, error_code}` — counter
- `platform_api_response_size_bytes{workspace, table}` — histogram

Slow requests (> 2s) emit warnings; > 10s emit errors. Bulk operations have separate thresholds (10s warn, 60s error).

Trace spans wrap every endpoint call; the trace ID is in the response header so support can correlate across systems.

### 6.10 Operational Runbooks

New files in `docs/runbooks/`:

- `api-rate-limit-tuning.md` — adjusting per-workspace limits; troubleshooting rate-limit-storm
- `api-key-compromise.md` — incident response for leaked API key
- `api-slow-endpoint-diagnosis.md` — diagnosing slow customer API calls
- `api-bulk-operation-stuck.md` — when a bulk op hangs; how to cancel safely
- `api-versioning-deprecation.md` — how to deprecate an old API version when a schema changes

---

## 7. Implementation Order

1. **Wildcard Fastify routes** registered for the API path patterns; main handler stub.

2. **Workspace, schema, table resolvers** with appropriate caching.

3. **Per-workspace repository factory** that produces table-specific repositories.

4. **Filter parameter parser** with property-based testing.

5. **Operation handlers**: List first, then GetOne, then Create. The simplest path end-to-end before adding more.

6. **Authentication middleware** that handles both session tokens and API keys.

7. **Authorization checks** at each operation handler.

8. **Rate limiter port + in-memory adapter**; Redis adapter as a follow-up.

9. **Idempotency integration** for mutating endpoints.

10. **Pagination** (cursor and offset).

11. **Sorting and field selection.**

12. **Update, Archive, Restore, HardDelete operations.**

13. **Bulk operations** with bounded sizes.

14. **Count operation.**

15. **OpenAPI generator** producing the spec on demand.

16. **API key service** with creation, listing, revocation, verification.

17. **Audit events** integrated through every operation.

18. **PII redaction** in response shaping.

19. **API explorer page** in the web UI.

20. **Conformance tests**: every operation tested against all three database adapters.

21. **Performance tests**: load against generated APIs from sample schemas; ensure baselines are met.

22. **Documentation**: runbooks, ADRs, customer-facing docs.

23. **Verify Definition of Done.**

---

## 8. ADRs to Write

- **ADR-0098: Runtime API Generation, Not Build-Time Codegen** — schema → endpoints in real-time; cache invalidation strategy
- **ADR-0099: Wildcard Routes Backed by Schema Resolution** — why; alternatives considered (per-schema route registration)
- **ADR-0100: Filter Parameter Syntax** — `filter[field][operator]=value`; alternatives (RSQL, GraphQL-style)
- **ADR-0101: RFC 7807 Problem Details for Errors** — standard, structured, debuggable
- **ADR-0102: API Key Storage as HMAC, Not Encrypted** — same rationale as session tokens; revocable
- **ADR-0103: Cursor Pagination as Default** — performance characteristics; offset still supported
- **ADR-0104: Bulk Operations with Bounded Sizes** — operational sanity; explicit limits

---

## 9. Verification Steps

1. **List endpoint works** for a simple schema; correct rows returned in correct format.

2. **Filtering works** for every operator (`_eq`, `_neq`, `_in`, `_lt`, etc.) on every supported column type.

3. **Field selection** projects correctly; unrequested fields not in response.

4. **Cursor pagination** delivers all rows when iterating; no duplicates, no gaps.

5. **Offset pagination** works for small offsets; warns at large.

6. **Sorting** works for single and multi-column, ascending and descending.

7. **Create endpoint** validates input against the schema; returns the created row.

8. **Update endpoint** with optimistic locking; concurrent updates produce 409.

9. **Archive (soft delete)** marks the row but keeps it; not returned in default list; returned with `?include_archived=true`.

10. **Hard delete** removes the row entirely; gated by permission.

11. **Bulk create** with 1000 rows succeeds; with 1001 rows rejected.

12. **Bulk update by filter** affects matching rows; bounded by max-affected.

13. **Permission enforcement**: a member without `data_table.read` on a specific table gets 403.

14. **Cross-workspace isolation**: a member of workspace A calling workspace B's API gets 404 (workspace appears not to exist for them) or 403.

15. **Authentication paths**: session token works; API key works; missing or invalid auth gets 401.

16. **OpenAPI spec** generated correctly; valid against the OpenAPI 3.1 schema.

17. **Idempotency**: same `Idempotency-Key` returns cached response; different key creates duplicate.

18. **Rate limiting**: exceeding the limit returns 429 with `Retry-After` header.

19. **PII redaction**: a principal without `pii.read` for `email` category sees `null` for email column with redaction note in meta.

20. **All three databases**: every operation works equivalently on Postgres, MSSQL, Mongo (modulo capability flags).

21. **Performance**: simple list query against 100k-row table p95 < 200ms.

22. **Audit events**: every mutation produces the expected audit entry; reads do not unless elevated audit is enabled.

23. **Schema change propagation**: deploy a schema change; subsequent API requests reflect new schema within 60 seconds (cache TTL).

24. **Error format**: every error response is valid RFC 7807 problem details JSON; correlationId present.

25. **API explorer page** displays endpoints; try-it-now works for authenticated users.

If all 25 pass, the objective is met.

---

## 10. Definition of Done

**Request Pipeline**

- [ ] Wildcard Fastify routes registered
- [ ] Workspace, schema, table resolvers with caching
- [ ] Per-workspace repository factory
- [ ] Authentication middleware (session + API key)
- [ ] Authorization at every endpoint
- [ ] Rate limiting per workspace and principal
- [ ] Idempotency for mutating endpoints

**Operations**

- [ ] List with filter, pagination, sort, field selection
- [ ] GetOne with field selection
- [ ] Create with validation
- [ ] Update with optimistic locking
- [ ] Archive / Restore / HardDelete
- [ ] Count
- [ ] Bulk Create / Update / Delete with bounds

**Cross-Cutting**

- [ ] Filter parameter parser with property tests
- [ ] Response shaping with PII redaction
- [ ] RFC 7807 error responses
- [ ] OpenAPI 3.1 spec generation
- [ ] API explorer UI page

**API Keys**

- [ ] ApiKeyService implemented
- [ ] api_keys schema migrated on all three databases
- [ ] Creation returns plaintext key once; storage as HMAC
- [ ] Verification path

**Conformance**

- [ ] All operations work on Postgres, MSSQL, Mongo
- [ ] Capability gaps documented (e.g., features unavailable per database)
- [ ] Cross-database conformance tests pass

**Audit & Observability**

- [ ] All audit events emitted
- [ ] All metrics emitted
- [ ] Trace spans on every endpoint
- [ ] Slow request alerts configured

**Permissions**

- [ ] data_table permissions added to vocabulary
- [ ] Default role grants updated

**Performance**

- [ ] List p95 < 200ms on 100k rows
- [ ] Create p95 < 100ms
- [ ] Bulk create 1000 rows p95 < 5s

**Documentation**

- [ ] ADRs 0098–0104 written and Accepted
- [ ] All runbooks in Section 6.10 written
- [ ] Customer-facing API documentation page
- [ ] OpenAPI spec exposed at known endpoint

**Verification**

- [ ] All 25 verification steps in Section 9 pass

---

## 11. Anti-Patterns to Refuse

- **Generating routes at startup based on existing schemas.** Schemas change; that's the whole point.
- **Caching schemas indefinitely.** TTL with invalidation on deploy is the discipline.
- **Allowing arbitrary SQL/Mongo through the filter parameter.** The Filter AST is the only path; the parser validates every operator and field.
- **Skipping the workspace filter in customer table queries.** Workspace isolation must be enforced at the query layer, not just the auth layer.
- **Returning internal database errors to the client.** Every error goes through the centralized formatter; internal details stay in logs.
- **Using offset pagination as the default in the SDK.** Cursor is the default; offset is documented but not recommended.
- **Implementing bulk operations without size limits.** A 10M-row bulk delete locks the database. Bounds always.
- **Sharing API keys across workspaces.** API keys are workspace-scoped.
- **Storing API keys in plaintext.** HMAC at rest, plaintext only at creation.
- **Skipping rate limiting "because we're small."** Limits stay; default values can be generous.
- **Letting the OpenAPI spec drift from reality.** Generated on demand from the live schema; never hand-edited.
- **Adding RPC-style endpoints under the customer API umbrella.** They're a separate feature; don't pollute this one.
- **Returning PII to a principal without permission.** Redaction is mechanical; never discretionary.

---

## 12. Open Questions for Confirmation Before Starting

1. **Path versioning vs. header versioning** — proposing path (`/v1/`). Some platforms use headers (`Accept: application/vnd.api+json; version=1`). Path is more debuggable and customer-friendly. Confirmed?

2. **Filter syntax** — proposing `filter[field][_eq]=value` style. Alternatives: RSQL (`filter=email==alice@example.com`), GraphQL-style (`filter={email:{_eq:"alice@example.com"}}`), JSON-encoded query string. Recommendation: bracket style, well-supported by `qs` and similar libraries.

3. **Bulk size defaults (1000 rows)** — appropriate? Some APIs allow 10k. Recommendation: 1000 default, configurable per workspace up to 10k max.

4. **Read auditing default off** — proposing off by default; on for elevated-audit workspaces. Acceptable, or audit reads always?

5. **API explorer in v1** — proposing it ships with this objective. Alternative: defer to a follow-up. Recommendation: ship a simple Swagger UI version; polish later.

6. **API key permission overrides** — should a key have its own permission set, distinct from the user who created it? Recommendation: yes, but default to "inherits creator's permissions"; explicit overrides for narrowing.

7. **Edge functions / custom RPC** — explicitly out of scope; confirm we're OK to defer.

---

## 13. What Comes Next

With Objective 12 complete, customer schemas have full REST APIs. A customer can install the platform, define a schema, and immediately have a usable backend for any client — exactly the Supabase value proposition, on any of three databases.

**Objective 13: Auto-Generated GraphQL APIs** is next. The same schemas, same data, exposed as a GraphQL endpoint. Includes basic queries, mutations, and the foundation for subscriptions (full subscription work in Objective 14). Customers who prefer GraphQL get it; the underlying engine is the same.

**Objective 14: Real-Time Subscriptions** uses the change streams from Objective 4d to expose live updates over WebSocket. This is the killer Supabase feature: live tables, live queries, live UI updates. The platform does it on Postgres, MSSQL, AND Mongo.

**Objective 15: Storage Browser & File Management** brings the file management UI to surface the `ObjectStoragePort` from the foundation.

**Objective 16: Auth & User Management UI** exposes the auth from Objective 5 as a customer-facing UI.

**Objective 17: Query Console** — SQL/Mongo query interface with safety rails.

**Objective 18: Data Browser & Editor** — the table viewer, row editor, CSV import/export.

**Objective 19: Public SDK** — wraps all the above into a TypeScript / Python / etc. SDK. The "Supabase client equivalent."

By Objective 19, the Data Management Module is a coherent product: a customer can install the platform, point it at their database, and have a complete Supabase-equivalent experience.

---

_This document is the contract. Every checkbox in Section 10 must be true before moving on to Objective 13._
