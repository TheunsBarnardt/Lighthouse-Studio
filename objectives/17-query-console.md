# Objective 17: Query Console

**Status:** Ready for development
**Prerequisites:** Objectives 4 family (databases), 6 (RBAC), 7 (Audit), 8 (Service Layer), 11 (Schema Designer), 12 (REST APIs) complete
**Blocks:** Objective 18 (Data Browser uses some query infrastructure); Objective 19 (Public SDK can expose a query method)

---

## 1. Purpose

Give customer developers a **direct query interface** to their database — SQL on Postgres and MSSQL, Mongo aggregation pipelines on MongoDB — alongside the auto-generated APIs. The query console is the escape hatch for everything the APIs don't naturally express: complex analytics, ad-hoc data exploration, one-off corrections, debugging, exports.

The console is not a thin pass-through to the database. It's a **safety-railed environment** that:

- Enforces permissions at every query
- Prevents query patterns that could harm the database (no DROP DATABASE, no kill -9 the connection pool)
- Captures audit trail of every query
- Limits resource consumption (timeouts, row limits, memory)
- Keeps history per user
- Allows saving and sharing of useful queries
- Works equivalently across Postgres, MSSQL, and MongoDB

This is the surface developers reach for when "the API doesn't quite do what I need." Done well, it's the feature that makes the platform usable for serious data work, not just CRUD apps. Done poorly, it's the feature that lets a junior engineer DROP TABLE a customer's production data on a Tuesday afternoon.

---

## 2. Scope

### In Scope

- A web UI for entering and running queries
- Three query languages: SQL (Postgres dialect, MSSQL/T-SQL dialect), Mongo aggregation pipelines / find queries
- Read-only mode by default; write mode opt-in per workspace per role
- Query timeout enforcement (default 30 seconds, configurable per workspace)
- Result row limit enforcement (default 1000 rows, configurable up to 100,000)
- Per-query memory limit (best-effort; via database-level mechanisms where supported)
- Query audit: every executed query logged with full text, parameters, result row count
- Query history per user
- Saved queries: name, share with workspace, organize in folders
- Query parameter binding (named parameters only; no string interpolation in client code)
- Result set actions: download as CSV / JSON, paginate large results, copy
- Per-query EXPLAIN (Postgres / MSSQL) / aggregation plan (Mongo) inspection
- Read-from-replica routing where available (Postgres read replicas; MSSQL readable secondary; Mongo read preference)
- Query templates / "snippets" for common patterns
- Multi-statement queries (with explicit confirmation; one transaction per executed batch)
- Schema-aware autocomplete (columns, table names, function suggestions)
- ADRs

### Out of Scope (Belongs to Later Objectives)

- A full query builder GUI (clicks-and-drops to construct queries) — deferred; SQL/Mongo experts use this; non-experts use the auto-generated APIs
- Stored procedure / function management (deferred)
- DDL through the console — DDL goes through the schema designer (Objective 11), period; a customer typing `ALTER TABLE` here gets a "use the schema designer" error
- Cross-database query federation — out of scope; queries run against one workspace's database
- Query result charting / visualization — deferred to a later objective; users export results to chart elsewhere for now
- Notebooks / multi-cell query environments — deferred
- Scheduled / saved-and-recurring queries — deferred (covered by JobQueuePort + a future "scheduled jobs" feature)
- AI-assisted query generation — covered by the AI build pipeline, not here

---

## 3. Locked Decisions

| Decision              | Choice                                                                                              | Rationale                                                       |
| --------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Editor library        | Monaco editor (already used by the schema designer's Code view)                                     | Consistent; powerful; good TS bindings                          |
| Default query mode    | Read-only                                                                                           | Prevents the "I just wanted to look but ran an UPDATE" disaster |
| Write mode permission | Separate role permission `query.write` requiring explicit grant                                     | Most members can't write; explicit elevation when needed        |
| DDL via console       | Forbidden — error message points to the schema designer                                             | DDL has its own audit trail and approval flow                   |
| Default timeout       | 30 seconds                                                                                          | Aligns with REST endpoint timeout                               |
| Max timeout           | 5 minutes; configurable per workspace; requires `query.long_running` permission                     | Long queries blocking the connection pool is a real risk        |
| Default row limit     | 1000                                                                                                | Standard for ad-hoc queries; bigger results use export          |
| Max row limit         | 100,000                                                                                             | Beyond this, use exports or APIs                                |
| Read replica routing  | Yes when available; documented per database                                                         | Reduces load on primary                                         |
| Audit level           | Always log query text, parameter values redacted if PII-flagged                                     | Forensic record                                                 |
| History retention     | 90 days per user; longer for "saved" queries                                                        | Bounded                                                         |
| Saved query sharing   | Per-workspace; with optional read/run permissions                                                   | Knowledge-sharing within a team                                 |
| Multi-statement       | Allowed with explicit confirmation; wrapped in a transaction                                        | Prevents "ran 3 statements but only 2 committed" surprises      |
| Parameter binding     | Named parameters via `:name` syntax for SQL; for Mongo, parameters embedded as JSON values          | Prevents SQL injection; familiar to most developers             |
| Connection isolation  | Each console query uses its own connection from the pool; doesn't share state with web app requests | Console queries can't interfere with normal traffic             |
| Authentication        | Standard session token; full identity context available in queries                                  | Enables `WHERE user_id = current_user()` patterns               |

---

## 4. Architectural Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                       USER (browser)                                  │
│                                                                       │
│   Query Console Page                                                   │
│   - Monaco editor (query text)                                         │
│   - Schema-aware autocomplete                                          │
│   - Run / Save / EXPLAIN buttons                                       │
│   - Results table (paginated)                                          │
│   - History sidebar                                                    │
│   - Saved queries sidebar                                              │
└────────────────────────────┬────────────────────────────────────────┘
                             │ REST: POST /api/v1/data/.../console/execute
                             ▼
        ┌────────────────────────────────────┐
        │      QueryConsoleService             │
        │                                       │
        │  - Parse and classify query           │
        │  - Verify permission to execute       │
        │  - Apply read-only enforcement        │
        │  - Apply timeout, row limit            │
        │  - Route to appropriate database       │
        │  - Capture results                    │
        │  - Audit                               │
        │  - Track history                       │
        └─────────────────┬───────────────────┘
                          │
                          ▼
        ┌────────────────────────────────────┐
        │   Query Classifier                    │
        │   - SQL: parse AST, detect DDL/DML/   │
        │     SELECT, find table refs           │
        │   - Mongo: parse pipeline, detect      │
        │     write stages                       │
        └─────────────────┬───────────────────┘
                          │
                          ▼
        ┌────────────────────────────────────┐
        │   Persistence layer                   │
        │   - Postgres adapter                   │
        │   - MSSQL adapter                      │
        │   - Mongo adapter                      │
        │   Each exposes a "raw query" path      │
        │   bounded by the rules above           │
        └────────────────────────────────────┘
```

The console is a UI plus one significant new service. The service does heavy lifting at request time: parsing, classification, validation, execution with constraints, audit. The persistence adapters expose a `RawQueryPort` that the console uses, separate from the structured `RepositoryPort` and `QueryPort` from earlier objectives.

---

## 5. The Hard Parts

**5.1 Read-only enforcement on SQL**

"Read-only" is harder than it sounds. The platform must reject:

- All DDL: `CREATE`, `ALTER`, `DROP`, `TRUNCATE`, `RENAME`, `COMMENT`
- All DML: `INSERT`, `UPDATE`, `DELETE`, `MERGE`, `REPLACE`
- All TCL when write isn't intended: `BEGIN`, `COMMIT`, `ROLLBACK`
- All DCL: `GRANT`, `REVOKE`
- Side effects via functions: Postgres `pg_advisory_lock()`, `pg_terminate_backend()`, `nextval()` on sequences

Approach: parse the SQL with a real parser (`pg-query-emscripten` for Postgres, `node-sql-parser` for MSSQL), walk the AST, classify each statement. Reject if any statement is non-SELECT (or non-SELECT-with-CTE).

For complex cases (CTEs that contain modification queries, recursive queries, function calls with side effects), the parser-based approach is still the right one — it's deterministic and inspectable.

A defense-in-depth approach: connect using a database role that ONLY has SELECT privileges in the read-only mode. Even if the parser misses something, the database refuses. This requires a separate read-only role per workspace (extending Objective 11's per-workspace role model with `cust_<workspace>_readonly` in addition to `cust_<workspace>_app`).

**5.2 Read-only enforcement on Mongo**

Mongo aggregation pipelines have writeable stages: `$out`, `$merge`. The classifier detects these and rejects in read-only mode. For find/findOne queries, no write is possible.

For `db.collection.<method>()` style commands (which the console accepts as an alternative to aggregation pipelines), only `find`, `findOne`, `aggregate` (without writeable stages), `count`, `distinct` are permitted in read-only mode. Anything else rejected.

Defense-in-depth: a read-only Mongo user with read-only role grants on the customer's databases.

**5.3 Per-workspace database roles for the console**

Adding to Objective 11's role model:

- `cust_<workspace_slug>_app` — the role used by the auto-generated REST/GraphQL APIs (DML on customer tables, no DDL)
- `cust_<workspace_slug>_migrate` — the role used by the schema designer's migrations (DDL on customer tables)
- `cust_<workspace_slug>_readonly` — read-only role used by the console in read-only mode (SELECT only)
- `cust_<workspace_slug>_console_writer` — used by the console in write mode for users with `query.write` permission (DML on customer tables, NO DDL)

Four roles per workspace per database. They differ in the privileges they have, all scoped to the workspace's customer schema/database.

For Mongo: equivalent users with role grants. For MSSQL: equivalent users with explicit GRANT statements.

The console picks the role based on the user's `query.write` and `query.read` permissions plus the query's classification.

**5.4 Timeout enforcement**

A query running too long ties up resources. Enforcement:

- **Application timeout**: a `setTimeout` in the service that aborts the query after the configured duration
- **Statement timeout**: per-connection `SET statement_timeout = N` (Postgres), `SET LOCK_TIMEOUT N` and query hints (MSSQL), `maxTimeMS` option (Mongo)
- Both layers active; database-level enforcement is more reliable; application timeout catches edge cases

After the timeout, the connection is **closed** (not returned to the pool) — Postgres can leave queries running even after the client disconnects in some scenarios; closing forces cleanup. The console reports a clear "query timed out" error.

**5.5 Row limit enforcement**

The default `LIMIT 1000` is added to SELECT queries that don't already have a limit. Two ways:

- **Parser-level**: the AST is modified to add the LIMIT clause if none exists. Complex CTEs may have nested limits; the OUTER query gets the row limit.
- **Result-stream-level**: the database driver streams rows; the application stops reading at the limit; the connection is closed if the database keeps producing more.

The parser approach is preferred (simpler; the database does less work). The stream approach is the fallback for queries the parser can't handle.

For Mongo aggregation pipelines, a `$limit` stage is appended (or replaced with a stricter limit if the user-supplied one is too high).

The user can request larger row limits up to the workspace maximum; over the maximum, they get a clear error message pointing to the export feature (which streams to a file rather than rendering in the console).

**5.6 EXPLAIN inspection**

Useful for debugging slow queries. Per database:

- **Postgres**: `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) <query>` — JSON output rendered as a query plan tree in the UI
- **MSSQL**: `SET SHOWPLAN_XML ON` then the query; XML plan rendered
- **Mongo**: `<aggregate-or-find>.explain('executionStats')` — JSON output rendered

The "explain" button in the UI runs the query through EXPLAIN and shows the plan instead of running the actual query. For ANALYZE variants (Postgres) which actually execute the query while also producing the plan, the result row limit and timeout still apply.

**5.7 Multi-statement queries**

A user submits:

```sql
UPDATE users SET active = true WHERE last_login > now() - interval '7 days';
DELETE FROM old_logs WHERE created_at < now() - interval '90 days';
```

The console:

- Parses both statements
- Verifies user has `query.write` permission
- Shows a confirmation dialog: "This query has 2 write statements affecting `users` and `old_logs`. Run as one transaction?"
- On confirm: opens a transaction, executes both, commits if both succeed, rolls back if either fails
- Reports per-statement affected-row counts plus overall outcome

If one statement is read and the other write, the platform treats it as write mode (requires `query.write`).

**5.8 Schema-aware autocomplete**

Monaco's autocomplete API takes a list of completion items. The console provides:

- Table names from the customer schema
- Column names per table (suggested after `<table>.` or in column-position contexts)
- SQL keywords
- Common SQL functions (`now()`, `count(*)`, `coalesce`)
- For Mongo: collection names, common pipeline stage names, common operators

The completion provider is workspace-schema-aware: it queries the `SchemaService` to get the current schema and provides suggestions accordingly.

The provider is dialect-aware: Postgres and MSSQL have somewhat different keyword sets and function libraries.

**5.9 Saved queries and sharing**

Saved queries live in a `saved_queries` table:

```typescript
saved_queries: {
  ...standardColumns,
  workspace_id: uuid,
  created_by_user_id: uuid,
  name: string(255),
  description: text?,
  query_text: text,
  query_language: enum,            // 'sql_postgres', 'sql_mssql', 'mongo_aggregate', 'mongo_find'
  parameters: json,                  // default values for parameters
  folder_path: string(500)?,         // for organization
  shared: boolean,                   // visible to all workspace members?
  shared_can_run: boolean,           // can shared viewers run it?
}
indexes: [workspace_id, created_by_user_id], [workspace_id, shared, folder_path]
```

The UI shows:

- "My queries" — owned by the user
- "Shared queries" — shared by other workspace members
- Folder organization

Permissions:

- Owner can edit, share, delete
- Shared-viewers can see the query text and possibly run it (depending on `shared_can_run`)
- Shared queries respect the user's own permissions when running — saving as `query.write` doesn't let the viewer execute writes if they don't have `query.write`

**5.10 Query history**

Per-user history of executed queries:

```typescript
query_history: {
  ...standardColumns,
  workspace_id: uuid,
  user_id: uuid,
  query_text: text,
  query_language: enum,
  parameters: json,
  duration_ms: int,
  rows_affected: int?,
  error: text?,
  status: enum('succeeded', 'failed', 'timeout', 'cancelled'),
}
indexes: [workspace_id, user_id, _created_at DESC]
```

Retained 90 days. Users can see their own history; admins can see workspace history (audit trail). The history powers "show me what I ran yesterday" workflows and feeds the query autocomplete with recently-used patterns.

**5.11 Parameter binding**

The console supports parameterized queries:

```sql
SELECT * FROM users WHERE workspace_id = :wsid AND active = :active
```

The user provides parameter values in a separate UI section. The query is sent to the server with parameters; the server uses prepared statements (Postgres `$1, $2`, MSSQL `@p1, @p2`, Mongo `$$paramName`) to bind safely.

This is the SAFE way to parameterize. The console explicitly does NOT support string interpolation in client code; users wanting to interpolate dynamic content compose the query in their language and send the final form (taking responsibility for parameterizing themselves).

**5.12 Multi-database awareness**

A workspace's database driver is fixed (Postgres, MSSQL, or Mongo). The console:

- Detects the driver from the workspace's schema configuration
- Sets the editor's syntax highlighting accordingly
- Routes the query to the correct adapter
- Shows the appropriate language label ("PostgreSQL" or "T-SQL" or "MongoDB Aggregation")

A user accustomed to Postgres won't accidentally write Postgres-specific SQL when their workspace is on MSSQL — the editor's tooling guides them.

---

## 6. Component Specifications

### 6.1 QueryConsoleService

```typescript
// packages/core/src/services/data-management/query-console/query-console.service.ts

export class QueryConsoleService {
  constructor(
    private readonly authz: AuthorizationPort,
    private readonly schemas: SchemaService,
    private readonly classifier: QueryClassifier,
    private readonly executor: QueryExecutor,
    private readonly history: RepositoryPort<QueryHistoryRecord>,
    private readonly savedQueries: RepositoryPort<SavedQuery>,
    private readonly audit: AuditPort,
    private readonly logger: LoggerPort,
  ) {}

  async execute(ctx: RequestContext, input: ExecuteQueryInput): Promise<Result<QueryResult, AppError>>;

  async explain(ctx: RequestContext, input: ExplainQueryInput): Promise<Result<QueryPlan, AppError>>;

  async cancelExecution(ctx: RequestContext, executionId: string): Promise<Result<void, AppError>>;

  async listHistory(ctx: RequestContext, opts: ListHistoryOptions): Promise<Result<PaginatedResult<QueryHistoryRecord>, AppError>>;

  async saveQuery(ctx: RequestContext, input: SaveQueryInput): Promise<Result<SavedQuery, AppError>>;

  async listSavedQueries(ctx: RequestContext, opts: ListSavedQueriesOptions): Promise<Result<PaginatedResult<SavedQuery>, AppError>>;

  async getSavedQuery(ctx: RequestContext, queryId: string): Promise<Result<SavedQuery, AppError>>;

  async deleteSavedQuery(ctx: RequestContext, queryId: string): Promise<Result<void, AppError>>;

  async exportResult(ctx: RequestContext, input: ExportInput): Promise<Result<{ exportId: string; downloadUrl: string }, AppError>>;
}
```

`execute` is the centerpiece. It:

1. Authorizes (`query.read` for read queries; `query.write` for writes)
2. Classifies the query (SELECT vs DML vs DDL)
3. Rejects DDL with a pointer to the schema designer
4. If write and `query.write` not granted: rejects
5. Determines the appropriate database role
6. Applies row limit (parser-modifying or stream-trimming)
7. Wraps in a transaction if multi-statement
8. Sets timeout
9. Executes via the appropriate persistence adapter
10. Captures result + duration + affected rows
11. Stores in history
12. Audits
13. Returns

### 6.2 QueryClassifier

```typescript
export interface QueryClassifier {
  classify(input: ClassifyInput): Result<QueryClassification, ClassifyError>;
}

export interface QueryClassification {
  language: 'sql_postgres' | 'sql_mssql' | 'mongo_aggregate' | 'mongo_find';
  isReadOnly: boolean;
  containsDdl: boolean;
  statementCount: number;
  affectedTables: string[]; // best-effort
  hasParameters: boolean;
  parameterNames: string[];
}
```

For SQL: uses an AST parser (`pg-query-emscripten` for Postgres syntax, `node-sql-parser` for MSSQL). Walks the AST, classifies each statement, accumulates affected tables.

For Mongo: parses the pipeline / find expression as JSON (or evaluates via a sandboxed mini-interpreter for `db.coll.find({...})` syntax), checks each stage / operation for write characteristics.

Classification errors (unparseable input) are surfaced clearly: "Couldn't parse query at line 5, character 23: unexpected token". The user fixes their syntax and retries.

### 6.3 QueryExecutor

The component that actually runs queries against the appropriate database. Per database:

```typescript
// packages/adapters/persistence-postgres/src/raw-query.adapter.ts

export class PostgresRawQueryAdapter {
  async execute(opts: ExecuteOptions): Promise<Result<QueryResult, AppError>>;
}

export interface ExecuteOptions {
  workspaceId: string;
  query: string;
  parameters: Record<string, unknown>;
  role: 'readonly' | 'console_writer';
  timeoutMs: number;
  rowLimit: number;
  abortSignal?: AbortSignal;
}
```

For Postgres:

- Acquires a connection from a per-role pool
- Sets `SET statement_timeout = <ms>`
- Sets `SET LOCAL query_timeout = ...` (for some hosting environments)
- Executes the query
- Streams results until `rowLimit` reached or query completes
- Captures plan if EXPLAIN was requested

Equivalent adapters for MSSQL and Mongo.

### 6.4 Database Schema for History and Saved Queries

```typescript
query_history: {
  ...standardColumns,
  workspace_id: uuid,
  user_id: uuid,
  query_text: text,
  query_language: enum,
  parameters: json,                    // values omitted/redacted if PII
  duration_ms: int,
  rows_affected: int?,
  error_message: text?,
  status: enum,
  result_summary: json,               // first-row-only or schema; never full results
}
indexes: [workspace_id, user_id, _created_at DESC], [workspace_id, _created_at DESC]

saved_queries: {
  ...standardColumns,
  workspace_id: uuid,
  created_by_user_id: uuid,
  name: string(255),
  description: text?,
  query_text: text,
  query_language: enum,
  default_parameters: json,
  folder_path: string(500)?,
  shared: boolean,
  shared_can_run: boolean,
}
unique: [workspace_id, created_by_user_id, name]    // unique within user's queries
indexes: [workspace_id, shared], [workspace_id, folder_path]
```

### 6.5 Per-Workspace Database Role Setup

When a workspace is created, in addition to the existing `cust_<workspace>_app` and `cust_<workspace>_migrate` roles (Objective 11), create:

- `cust_<workspace>_readonly` — Postgres `GRANT SELECT ON ALL TABLES IN SCHEMA cust_<workspace> TO ...`
- `cust_<workspace>_console_writer` — Postgres `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA cust_<workspace> TO ...` (no DDL)

Equivalent for MSSQL and Mongo.

These roles are managed by the platform's setup migrations; admins don't manage them manually.

### 6.6 The Query Console UI

Lives in `apps/web/src/data-management/query-console/`:

- `QueryConsole.tsx` — main page; layout shell
- `editor/SqlEditor.tsx` — Monaco editor configured for SQL with autocomplete
- `editor/MongoEditor.tsx` — Monaco editor for JSON / aggregation
- `panels/SchemaPanel.tsx` — left sidebar showing tables and columns; click to insert into editor
- `panels/HistoryPanel.tsx` — recent queries
- `panels/SavedQueriesPanel.tsx` — saved queries with folders
- `panels/ResultsPanel.tsx` — result table with pagination, column-resize, search
- `panels/ParametersPanel.tsx` — parameter input area
- `panels/ExplainPanel.tsx` — query plan visualization
- `dialogs/SaveQueryDialog.tsx`
- `dialogs/ConfirmWriteQueryDialog.tsx` — multi-statement confirmation
- `dialogs/ExportResultDialog.tsx`

Layout: editor on top, results below. Sidebars are collapsible. Schema panel is always visible to power developers; collapsed by default.

### 6.7 Result Display

Results render in a virtualized table component (handles large row counts efficiently):

- First 1000 rows shown by default; "Load more" pagination
- Column types styled appropriately (dates, decimals, booleans visually distinct)
- Long text truncated with click-to-expand
- JSON values pretty-printed in a side panel
- NULL values explicit ("NULL" in dim text)
- Column sort (client-side for already-loaded rows; re-query for full sort)
- Cell selection, row selection, copy-as-CSV / copy-as-JSON

### 6.8 Export

For results larger than the row limit, the user clicks "Export" and gets:

- CSV with headers
- JSON Lines
- Both formats stream to a file in the platform's storage; download link with time-limited signed URL

The export job runs in the background (using JobQueuePort) so it doesn't tie up the console connection. The user gets a notification when ready.

Export queries also bypass the row limit (with sensible upper bound — 1M rows or 100MB, whichever first). They still respect timeout and write/read permissions.

### 6.9 Schema-Aware Autocomplete Provider

```typescript
// packages/core/src/services/data-management/query-console/autocomplete.ts

export class QueryConsoleAutocomplete {
  /** Get completion suggestions for a position in the query text. */
  async suggest(ctx: RequestContext, workspaceId: string, schemaId: string, queryText: string, cursorPosition: number, language: string): Promise<CompletionItem[]>;
}
```

The autocomplete:

- Uses Monaco's TokenAt API to determine context (in a SELECT clause, in a FROM clause, after `<table>.`, etc.)
- Queries the SchemaService for tables and columns
- Includes SQL keywords and built-in functions for the dialect
- Includes the user's own recent queries for "did you mean..." suggestions

Critical: autocomplete data is per-request, not pre-loaded for all schemas. The platform doesn't ship the customer's column names to other customers' clients.

### 6.10 Audit Events

```
data_management.query.executed (SELECT)
data_management.query.executed_write (INSERT/UPDATE/DELETE)
data_management.query.timed_out
data_management.query.cancelled
data_management.query.failed
data_management.query.ddl_attempted (when a DDL was rejected)
data_management.query.exported (results exported to file)
data_management.query.saved
data_management.query.shared
data_management.query.deleted_save
```

Read queries are always audited (the discipline is "console queries are higher-stakes than API reads"). The full query text is included in the audit event; parameter values are redacted if PII columns are referenced.

### 6.11 Permissions

New permissions added to the vocabulary from Objective 6:

- `query.read` — execute SELECT queries via the console
- `query.write` — execute write queries via the console
- `query.long_running` — set timeout above the workspace default
- `query.large_result` — set row limit above the workspace default
- `query.export` — export query results

Default role mappings:

- `workspace_owner`, `workspace_admin`: all permissions
- `architect`, `developer`: `query.read`, `query.export`
- `qa`, `reviewer`, `viewer`: `query.read`
- Custom roles configurable

Workspace owners can grant `query.write` to specific roles; not granted by default to anyone.

### 6.12 Operational Runbooks

New files in `docs/runbooks/`:

- `query-console-runaway.md` — when a query hangs the connection pool; how to identify and kill
- `query-console-write-emergency.md` — when a customer accidentally runs a damaging UPDATE; recovery procedures (point-in-time restore, undo via audit)
- `query-console-permissions-tune.md` — adjusting per-workspace permission grants and timeouts
- `query-console-history-export.md` — exporting query history for forensic analysis

---

## 7. Implementation Order

1. **Per-workspace database roles** (`readonly`, `console_writer`) — extending Objective 11's role model. Migration scripts.

2. **QueryClassifier** — SQL parsing for Postgres dialect; basic test cases.

3. **QueryClassifier — MSSQL dialect.**

4. **QueryClassifier — Mongo aggregation pipelines.**

5. **PostgresRawQueryAdapter** — execute, timeout, row limit.

6. **MSSQL and Mongo equivalent adapters.**

7. **QueryConsoleService** with `execute`, classification, role selection, audit.

8. **History and saved query schema migrations.**

9. **Query history recording.**

10. **Saved query CRUD.**

11. **EXPLAIN support per database.**

12. **Multi-statement query handling with transaction wrapping.**

13. **Parameter binding** end-to-end.

14. **Export to CSV/JSON via background job.**

15. **Query Console UI** — Monaco editor, results table, history panel, saved queries.

16. **Schema-aware autocomplete provider.**

17. **Confirmation dialogs for write queries.**

18. **Audit events emitted.**

19. **Permissions added to vocabulary; default role grants.**

20. **Cross-database conformance tests** — same query semantics on each.

21. **Documentation, runbooks, ADRs.**

22. **Verify Definition of Done.**

---

## 8. ADRs to Write

- **ADR-0132: Read-Only by Default with Explicit Write Permission** — the safety discipline; recovery paths if it bites
- **ADR-0133: Database Role Per Mode** — defense-in-depth; parser-only isn't sufficient
- **ADR-0134: AST Parsing for Classification** — alternatives (regex, keyword-only); why a real parser
- **ADR-0135: DDL via Console Forbidden** — DDL has its own audit and approval; keeping it that way
- **ADR-0136: Multi-Statement Wrapped in Single Transaction** — atomicity; single confirm dialog
- **ADR-0137: Parameter Binding Only, No String Interpolation** — safety; client-side dynamic content responsibility on the user

---

## 9. Verification Steps

1. **Read-only SELECT** runs successfully; audit entry created.

2. **Write query** without `query.write` permission rejected with clear error.

3. **Write query** with permission runs; affected row count returned; transaction-wrapped.

4. **DDL query** rejected with "use the schema designer" message regardless of permissions.

5. **Multi-statement write** prompts for confirmation; runs both atomically; partial failures roll back.

6. **Timeout enforcement**: a query running past 30 seconds is killed; clear error; connection cleaned up.

7. **Row limit**: a query returning 5000 rows is truncated to 1000; clear indicator that more rows exist; option to increase.

8. **Parameter binding**: query with `:wsid` parameter runs with the bound value; no string interpolation.

9. **EXPLAIN**: shows the query plan as a tree visualization for Postgres / MSSQL / Mongo respectively.

10. **History**: executed queries appear in the user's history; old entries (90+ days) are pruned.

11. **Saved queries**: save, name, share with workspace; shared queries visible to other members.

12. **Schema-aware autocomplete**: typing `SELECT * FROM ` shows table names; typing `SELECT u.` after FROM users u shows users' columns.

13. **Export**: query exporting 50,000 rows produces a CSV; file delivered via signed URL; takes < 1 minute.

14. **Cross-database**: equivalent queries on Postgres, MSSQL, Mongo produce equivalent semantics (modulo dialect differences).

15. **Per-workspace role isolation**: query running as `cust_<workspace>_readonly` cannot access another workspace's tables; verified.

16. **Audit events**: every query produces appropriate audit; DDL attempts logged at `info`; PII redaction in parameters.

17. **Concurrent queries**: 10 console users running queries simultaneously; no interference; no pool exhaustion.

18. **Cancel mid-flight**: user clicks "Cancel"; query is killed; connection returned to pool; UI shows cancellation.

19. **Performance**: typical 1000-row SELECT runs and renders in < 2 seconds.

20. **UI accessibility**: keyboard navigation works; results table screen-reader-friendly; passes axe-core.

21. **Saved query sharing permissions**: a viewer with `query.read` only cannot run a shared query that contains a write (would be permission-denied at execution).

22. **PII redaction in history**: a query against PII columns has parameter values redacted in the history record.

If all 22 pass, the objective is met.

---

## 10. Definition of Done

**Service Layer**

- [ ] QueryConsoleService implemented
- [ ] QueryClassifier with full AST parsing for Postgres SQL, MSSQL T-SQL, Mongo aggregation
- [ ] QueryExecutor adapters for all three databases
- [ ] All canonical service pattern compliance verified

**Database Roles**

- [ ] Per-workspace `readonly` and `console_writer` roles created on workspace setup (Postgres, MSSQL, Mongo equivalents)
- [ ] Role-selection logic in QueryConsoleService

**Storage**

- [ ] query_history table migrated; retention enforcement (90 days)
- [ ] saved_queries table migrated

**Permissions**

- [ ] `query.read`, `query.write`, `query.long_running`, `query.large_result`, `query.export` added
- [ ] Default role grants updated

**Read-Only Enforcement**

- [ ] AST classifier rejects DDL/DML in read-only mode
- [ ] Database role provides defense-in-depth
- [ ] DDL rejected in all modes

**Limits**

- [ ] Timeout enforcement at application + database level
- [ ] Row limit applied via parser modification + stream trimming
- [ ] Per-workspace tunable via admin UI

**Multi-Statement**

- [ ] Detection
- [ ] Confirmation dialog
- [ ] Transaction wrapping
- [ ] Per-statement reporting

**EXPLAIN**

- [ ] Per database; rendered as tree

**Parameter Binding**

- [ ] Named parameters via `:name` syntax
- [ ] Bound via prepared statements

**History**

- [ ] Every query recorded
- [ ] PII redaction in stored params
- [ ] Per-user retention 90 days

**Saved Queries**

- [ ] CRUD with sharing
- [ ] Folder organization

**Export**

- [ ] CSV and JSON formats
- [ ] Background job; signed URL delivery
- [ ] Bypass of row limit; respects permission and timeout

**UI**

- [ ] Monaco editor with dialect-appropriate syntax highlighting
- [ ] Schema-aware autocomplete
- [ ] Results panel with virtualization, column types, NULL display
- [ ] History panel
- [ ] Saved queries panel
- [ ] Parameters panel
- [ ] Explain panel
- [ ] All dialogs (save, confirm-write, export)

**Audit & Observability**

- [ ] All audit events emitted
- [ ] Metrics for execution time, row counts, timeouts, cancellations

**Cross-Database**

- [ ] Conformance tests pass on all three
- [ ] Dialect differences clearly surfaced in UI (label, syntax highlighting)

**Documentation**

- [ ] ADRs 0132–0137 written and Accepted
- [ ] All runbooks in Section 6.12 written
- [ ] Customer-facing query console guide

**Verification**

- [ ] All 22 verification steps in Section 9 pass

---

## 11. Anti-Patterns to Refuse

- **Trusting "read-only" labels in the UI to mean read-only at the DB.** AST classification + database role; defense in depth.
- **Allowing DDL through the console "as a power-user feature."** DDL has its own discipline. Schema designer for changes.
- **String-concatenating parameter values into queries.** Prepared statements only.
- **Returning the full query plan / execution stats for arbitrary queries to non-admin users.** EXPLAIN exposes query patterns and database structure; gated by permission.
- **Skipping the timeout because "this is a quick query."** Timeout is universal; user can request extension via `query.long_running` permission.
- **Running console queries on the same connection pool as the web app.** Console queries get their own pool; can't starve the web app.
- **Logging full query results in the audit event.** Audit captures the query and metadata; results are too large and may contain PII.
- **Letting multi-statement queries run without explicit confirmation.** A user pastes a script with 10 DELETEs; confirmation forces a moment to think.
- **Permitting custom SQL functions defined by users.** Out of scope; introduces sandboxing concerns.
- **Letting saved queries run with the saver's permissions instead of the runner's.** Always the runner's permissions; saving doesn't grant elevated access.

---

## 12. Open Questions for Confirmation Before Starting

1. **Default timeout 30 seconds** — appropriate? Some SaaS BI tools default 60-300s. Recommendation: 30s default; configurable up to 5 minutes per workspace; admins grant `query.long_running` to specific roles.

2. **Default row limit 1000** — appropriate? Recommendation: yes; users wanting more use the export feature.

3. **DDL via console: hard refusal** — confirmed? Even for `installation_owner`? Recommendation: hard refusal across the board. The schema designer is the path. No exceptions even for owners; emergency DBA action goes through the runbook + direct DB access (logged separately).

4. **Saved queries shared at workspace level vs. role level** — proposing workspace-wide visibility. Some platforms allow role-scoped sharing. Recommendation: workspace-wide for v1; role-scoped as a follow-up if customer demand justifies.

5. **Mongo aggregate pipeline UX** — proposing JSON editor with autocomplete for stage names. Some users prefer the `db.collection.aggregate([...])` style. Recommendation: support both; the platform's classifier handles both syntaxes.

6. **PII redaction in history** — proposing automatic detection (column name in PII registry → redact). Some workspaces may want full unredacted history for debugging. Recommendation: automatic redaction by default; admin can opt out per workspace with a clear "I understand PII may be exposed in audit logs" confirmation.

---

## 13. What Comes Next

With Objective 17 complete, customer developers have a powerful, safe direct-query interface alongside the auto-generated APIs. SQL or Mongo expertise becomes a productivity multiplier instead of a "well, you can't use it on this platform" limitation.

**Objective 18: Data Browser & Editor** is next — the table viewer, row editor, CSV import/export, real-time updates baked in. The screen most customers will spend the most time in.

**Objective 19: Public SDK** — wraps everything (REST, GraphQL, Realtime, Storage, Auth, Query) into a TypeScript / Python / etc. SDK. The "Supabase client equivalent."

After Objective 19, the Data Management Module is complete: a customer can install the platform, point it at their database, and have a working Supabase-equivalent on Postgres, MSSQL, or MongoDB.

---

_This document is the contract. Every checkbox in Section 10 must be true before moving on to Objective 18._
