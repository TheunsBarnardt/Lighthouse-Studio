# Objective 4a: Database Adapter — Microsoft SQL Server

**Status:** Ready for development
**Prerequisites:** Objectives 1, 1.5, 2, 3, 4 (Postgres adapter) complete
**Blocks:** Cross-database conformance (4c), change streams (4d), and any feature that targets MSSQL customers
**Companion:** Objective 4b (MongoDB Adapter) follows the same shape

---

## 1. Purpose

Implement the persistence ports against Microsoft SQL Server, achieving feature parity with the PostgreSQL adapter modulo genuinely impossible features. Pass the same conformance test suite. This is the adapter that makes the platform sellable to Microsoft houses — the customer who runs Azure DevOps, IIS, MSSQL, and Entra ID.

The MSSQL adapter is harder than Postgres in specific ways: array columns don't exist, JSON support is less ergonomic, the type system has different defaults, transaction isolation defaults differ, and the SQL dialect (T-SQL) diverges from standard SQL in pagination, UPSERT, returning clauses, and several other places. This objective documents and handles every divergence.

This objective produces no user-visible features. It produces a working, tested, observable, migration-disciplined MSSQL persistence layer that reaches conformance with the Postgres adapter.

**Why MSSQL second:**

- Postgres established the conformance baseline and the patterns
- MSSQL is a relational database, so the patterns mostly carry over
- MSSQL is where the first real customer revenue lives (Microsoft houses)
- Mongo (Objective 4b) is paradigm-shifting; doing it last gives the abstractions one more relational implementation to validate against

---

## 2. Scope

### In Scope

- MSSQL driver selection and configuration
- Schema authoring approach (same pattern as Postgres: TypeScript schema definitions inside the adapter, but using a different schema layer since Drizzle's MSSQL support is still maturing)
- Migration system: authoring, applying, verifying, rolling back
- All persistence port implementations: `RepositoryPort`, `UnitOfWorkPort`, `QueryPort`, `SchemaIntrospectionPort`, `SchemaDdlPort`, `SchemaMigrationPort`
- Filter AST → T-SQL translation
- Connection management: pooling via the driver's built-in pool, retries, timeouts
- Query observability: spans, metrics, slow query logging
- Type mapping: platform's normalized type system ↔ MSSQL native types
- Conformance test suite execution against MSSQL
- Capability declarations honestly reflecting MSSQL's feature set
- Backup and restore procedures specific to MSSQL
- Performance baseline tests
- Operational runbooks
- Two deployment modes documented:
  - Containerized MSSQL (Linux container; for our dev/test environment)
  - Customer-managed MSSQL (typically Windows-hosted on the customer's infrastructure)
- ADRs

### Out of Scope (Belongs to Later Objectives)

- The actual platform schema (workspaces, users, projects, artifacts) — the adapter mechanics, not the schema
- MSSQL-specific change streams via CDC (Objective 4d)
- Always On availability groups, replication topology (deferred until customer-driven)
- MSSQL Agent jobs (the platform uses its own job queue port; if a customer has Agent jobs, they coexist)
- Schema designer UI behavior on MSSQL (Data Management Module)

---

## 3. Locked Decisions

| Decision              | Choice                                                                                               | Rationale                                                                                                      |
| --------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| MSSQL version         | 2022 (latest stable widely deployed)                                                                 | Native JSON, IDENTITY caching fixed, fewer compatibility issues                                                |
| Minimum supported     | MSSQL 2019                                                                                           | Most enterprise deployments are 2019+; 2017 lacks several features we depend on                                |
| Driver                | `mssql` (npm) — wraps Tedious                                                                        | Pure JS, no native deps; works on Linux, macOS, Windows                                                        |
| Connection pooling    | Built-in via `mssql` package (Tarn-based)                                                            | No external pooler; SQL Server's connection cost is lower than Postgres                                        |
| Schema/query layer    | Drizzle ORM with the MSSQL dialect when stable; otherwise raw `mssql` package + custom query builder | Drizzle's MSSQL support is improving; pin a known-good version. If unstable, fall back to a thin custom layer. |
| Migration tool        | If Drizzle MSSQL: `drizzle-kit`; otherwise `node-pg-migrate`-style custom runner using SQL files     | Either way, plain SQL files are the source of truth                                                            |
| Migration storage     | SQL files in repo, checksummed                                                                       | Same discipline as Postgres                                                                                    |
| Optimistic locking    | `RowVersion` column (rowversion type) on every entity table                                          | MSSQL idiomatic; auto-incremented by the engine                                                                |
| Soft delete           | `_archived_at datetime2(7)` column                                                                   | Consistent with Postgres adapter                                                                               |
| Tenancy column        | `workspace_id uniqueidentifier` with index                                                           | Consistent with Postgres adapter                                                                               |
| Primary key strategy  | UUID v7 stored in `uniqueidentifier`, generated client-side                                          | Consistent across all adapters                                                                                 |
| Naming convention     | `snake_case` in SQL despite MSSQL's PascalCase tradition                                             | Consistency across adapters; MSSQL is case-insensitive on identifiers by default so this works                 |
| Time zones            | All timestamps are `datetime2(7)` stored as UTC                                                      | MSSQL has `datetimeoffset` but `datetime2` UTC is simpler and consistent                                       |
| JSON columns          | `nvarchar(max)` with JSON validation constraint                                                      | MSSQL has JSON functions but no native JSON type until 2025; nvarchar(max) is the safe choice                  |
| Full-text search      | MSSQL Full-Text Catalogs                                                                             | Native feature; comparable to Postgres tsvector                                                                |
| Vector search         | Not native; via Azure AI Search adapter or external Qdrant                                           | MSSQL 2025 will add native vectors; until then, external                                                       |
| Transaction isolation | `READ COMMITTED SNAPSHOT` recommended (set per database)                                             | Matches Postgres semantics; non-blocking reads                                                                 |
| Statement timeout     | 30 seconds via `requestTimeout` in `mssql` package                                                   | Consistent with Postgres adapter                                                                               |
| Two database users    | `platform_app` (DML), `platform_migrate` (DDL)                                                       | Same discipline as Postgres                                                                                    |
| Encryption            | TLS required; `encrypt: true, trustServerCertificate: false` for prod                                | Default; explicit override for dev with self-signed certs                                                      |

---

## 4. Architectural Overview

```
                ┌──────────────────────────────────────────┐
                │  Service Layer (packages/core)            │
                │  Knows only port interfaces               │
                └──────────────────┬───────────────────────┘
                                   │
                                   ▼
                ┌──────────────────────────────────────────┐
                │  packages/ports/persistence/             │
                │  (same ports — RepositoryPort, etc.)      │
                └──────────────────┬───────────────────────┘
                                   │
                                   │ implemented by
                                   ▼
                ┌──────────────────────────────────────────┐
                │  packages/adapters/persistence-mssql/    │
                │                                           │
                │  ┌────────────────────────────────────┐  │
                │  │  Drizzle (MSSQL dialect)            │  │
                │  │   OR custom query builder layer    │  │
                │  └─────────────────┬──────────────────┘  │
                │                    │                      │
                │  ┌─────────────────▼──────────────────┐  │
                │  │  mssql (npm) → Tedious driver      │  │
                │  └─────────────────┬──────────────────┘  │
                └────────────────────┼──────────────────────┘
                                     │
                                     ▼
                            ┌─────────────────┐
                            │  SQL Server     │
                            │   2019 / 2022   │
                            │ (Linux container│
                            │  or Windows)    │
                            └─────────────────┘
```

The adapter package looks structurally identical to the Postgres adapter. The differences are inside.

---

## 5. The Hard Parts (Read This Before Coding)

These are the places where MSSQL diverges from Postgres in ways that matter to the implementation. Each is handled in a specific section of the spec, but understanding them upfront prevents rework.

**5.1 Pagination dialect divergence**

PostgreSQL: `LIMIT n OFFSET m`. T-SQL: `OFFSET m ROWS FETCH NEXT n ROWS ONLY` (and only on queries with `ORDER BY`). The translator generates the dialect-correct form.

**5.2 RETURNING clause does not exist**

Postgres: `INSERT ... RETURNING *`. MSSQL: use the `OUTPUT` clause (`INSERT ... OUTPUT INSERTED.* INTO @result`). The repository's `create` and `update` methods translate to `OUTPUT`-based statements; the adapter handles the result table.

**5.3 UPSERT (ON CONFLICT)**

Postgres: `ON CONFLICT (col) DO UPDATE`. MSSQL: `MERGE` statement, which has known concurrency issues (deadlocks under load). The adapter uses an explicit `IF EXISTS ... UPDATE ... ELSE INSERT ...` pattern wrapped in a transaction with appropriate locking hints, NOT `MERGE`.

**5.4 Booleans**

MSSQL has no native `BOOLEAN`. We use `BIT` columns. The mapper converts `0/1` ↔ `false/true`. Filter operators on boolean columns translate accordingly.

**5.5 Arrays**

MSSQL has no native array type. The platform's normalized `array<T>` type cannot be expressed in MSSQL. **The MSSQL adapter declares `array_columns: false` in capabilities.** The Schema DDL adapter rejects table definitions with array columns and emits a clear error. The data management UI hides the array option when targeting MSSQL.

**5.6 JSON**

MSSQL stores JSON in `nvarchar(max)` columns. JSON functions (`JSON_VALUE`, `JSON_QUERY`, `OPENJSON`, `ISJSON`) work but with different syntax than Postgres `jsonb` operators. JSON columns get a `CHECK (ISJSON(<col>) = 1 OR <col> IS NULL)` constraint to enforce validity.

The platform's filter AST does NOT include JSON path operators (this was a deliberate restriction in Objective 1.5). JSON queries are out of scope for the generic repository; complex JSON queries go through the `QueryPort` with explicit per-database support.

**5.7 Schemas vs. Databases**

In MSSQL, "schema" (`dbo`, `sales`, etc.) is a namespace inside a database. In Postgres, the same. Both adapters can list and use schemas, but the default schema name is `dbo` on MSSQL and `public` on Postgres. The platform uses a configurable default schema.

**5.8 Identifier casing**

MSSQL is case-insensitive by default on identifier resolution but case-preserving on storage. The adapter uses lowercase snake_case for identifiers, but quoted identifiers (`[my_table]`) work case-sensitively. The adapter uses square-bracket quoting consistently to avoid surprises.

**5.9 Time precision**

MSSQL `datetime` is 3.33ms precision; `datetime2(7)` is 100ns precision. The adapter uses `datetime2(7)` everywhere for consistency with Postgres `timestamptz`.

**5.10 IDENTITY vs. UUID**

MSSQL traditional auto-increment is `IDENTITY(1,1)` on an int column. The platform uses UUID v7 client-side, so `IDENTITY` is not used. This is one of the larger conventional differences from MSSQL idioms — and that's fine, the platform's portability is more important than fitting native idioms.

**5.11 Linked servers and cross-database queries**

MSSQL allows queries across databases on the same server and across servers via linked servers. The platform never uses this. Each MSSQL deployment uses one database per environment.

**5.12 Schema evolution surprises**

Some `ALTER TABLE` operations in MSSQL block reads and writes longer than equivalent Postgres operations. Adding a column with a default value, for example, can require a full table rewrite. The migration runbook calls these out and recommends alternative patterns (add column without default, then update in batches, then add default).

**5.13 Transaction isolation default**

MSSQL's default isolation is `READ COMMITTED` with locking reads (a SELECT can block on a row another transaction is updating). We require `READ_COMMITTED_SNAPSHOT` to be enabled on the database, which makes reads non-blocking (closer to Postgres's MVCC behavior). The migration that creates the database sets this flag.

**5.14 Connection cost and pooling**

MSSQL connections are cheaper than Postgres connections, so PgBouncer-style pooling is unnecessary. The `mssql` package's built-in pool handles this. Pool sizing is similar (10–20 connections per process).

**5.15 Driver eccentricities**

The `mssql` package uses Tedious under the hood. Tedious has some quirks: trailing commas in some error messages, occasional spurious connection drops on long idle periods, and `WAITFOR` queries that hang the connection. The adapter sets `enableArithAbort: true`, configures keep-alive, and avoids `WAITFOR`.

---

## 6. Component Specifications

### 6.1 Driver and Pool Configuration

**`packages/adapters/persistence-mssql/src/connection.ts`:**

- Single connection pool per process via the `mssql` package
- Pool sizing: `min: 1, max: POSTGRES_POOL_SIZE` (yes, the env var is named `POSTGRES_POOL_SIZE` for consistency, but it applies regardless of driver — or use a generic `DB_POOL_SIZE`; documented either way)
- `requestTimeout: 30_000` (30s statement timeout)
- `connectionTimeout: 15_000`
- `pool: { idleTimeoutMillis: 60_000 }`
- TLS: `encrypt: true, trustServerCertificate: false` for prod
- TLS in dev with self-signed: `encrypt: true, trustServerCertificate: true` (env-controlled)
- Health check: `SELECT 1 AS ok`
- Pool metrics emitted via `MetricsPort`
- Connection events logged at debug level with sanitized DSN

**Configuration sources:**

The connection string is built from env vars:

- `MSSQL_SERVER` (host)
- `MSSQL_PORT` (default 1433)
- `MSSQL_DATABASE` (database name)
- `MSSQL_USER` (login)
- `MSSQL_PASSWORD` (password)
- `MSSQL_ENCRYPT` (boolean, default true)
- `MSSQL_TRUST_SERVER_CERTIFICATE` (boolean, default false)
- `MSSQL_INSTANCE` (optional, named instance like `SQLEXPRESS`)
- `MSSQL_DOMAIN` (optional, for Windows authentication via NTLM)

For Windows-authenticated connections (NTLM/Kerberos for AD-joined servers), the driver supports trusted connections, configured separately.

### 6.2 Schema Authoring

If Drizzle's MSSQL dialect is stable enough at implementation time, use it. If not, the adapter implements a thin custom schema layer with the same TypeScript-native ergonomics. Either way, schemas live in `packages/adapters/persistence-mssql/src/schema/` mirroring the Postgres adapter's structure.

**Standard column helpers:**

```typescript
// packages/adapters/persistence-mssql/src/schema/_common.ts

export const standardColumns = {
  id: 'uniqueidentifier NOT NULL DEFAULT (NEWSEQUENTIALID())', // overridden client-side with UUID v7
  rowVersion: 'rowversion NOT NULL',
  archivedAt: 'datetime2(7) NULL',
  createdAt: 'datetime2(7) NOT NULL CONSTRAINT DF_<table>_created_at DEFAULT SYSUTCDATETIME()',
  updatedAt: 'datetime2(7) NOT NULL CONSTRAINT DF_<table>_updated_at DEFAULT SYSUTCDATETIME()',
  createdBy: 'uniqueidentifier NULL',
  updatedBy: 'uniqueidentifier NULL',
};

export const tenantColumns = {
  workspaceId: 'uniqueidentifier NOT NULL',
};
```

**RowVersion vs. \_version integer:**

In Postgres, the platform uses an explicit integer `_version` column incremented on update. In MSSQL, the engine has a native `rowversion` type that auto-increments and is conflict-checked at the database level. The adapter uses `rowversion` because it's idiomatic and free, but the port-level concept of "expected version" is implemented identically — the optimistic locking semantics are the same; the storage differs.

The mapper presents `rowVersion` to the application layer as a base64-encoded 8-byte value; comparisons use the byte sequence.

### 6.3 Repository Adapter

Same shape as the Postgres adapter; same generic factory pattern.

```typescript
// packages/adapters/persistence-mssql/src/repository.adapter.ts
export function createMssqlRepository<TEntity, TId = string>(
  pool: ConnectionPool,
  table: TableDefinition,
  mapper: EntityMapper<TEntity>,
): RepositoryPort<TEntity, TId> {
  return {
    findById: (id) => /* ... */,
    findOne: (filter) => /* ... */,
    findMany: (opts) => /* ... */,
    count: (filter) => /* ... */,
    create: (entity) => /* ... uses OUTPUT clause */,
    update: (id, changes, opts) => /* ... uses OUTPUT, optimistic lock via rowversion */,
    archive: (id) => /* ... */,
    hardDelete: (id) => /* ... */,
  };
}
```

**MSSQL-specific behaviors:**

- `create` and `update` use `OUTPUT INSERTED.*` to return the affected rows
- `update` includes `WHERE id = @id AND row_version = @expectedRowVersion` when expectedVersion is provided; check `@@ROWCOUNT = 1` before commit
- Filter translator targets T-SQL syntax
- All queries use `@param` style binding (the `mssql` package's named parameter syntax)
- Result sets are mapped via the entity mapper (BIT → boolean, etc.)
- All operations open spans, emit metrics, log structured context — identical to Postgres adapter behavior

### 6.4 Filter AST → T-SQL Translator

This is the second-largest piece of code in the objective. The Postgres translator and the MSSQL translator share **no code** — they target different SQL dialects with different operator precedence, different string concatenation, different LIKE semantics.

**`packages/adapters/persistence-mssql/src/filter-translator.ts`:**

Same interface as the Postgres translator:

```typescript
export function translateFilter<T>(filter: Filter<T>, table: TableDefinition, startingParamIndex = 1): Result<TranslatedFilter, FilterError>;
```

**T-SQL specifics:**

- Bind parameters use `@p1`, `@p2`, ... style
- `_contains` translates to `<col> LIKE '%' + @p + '%'` with `@p` properly escaped (`%` and `_` and `[` need escaping for LIKE)
- `_icontains` uses the same; MSSQL's default collation is case-insensitive, so `LIKE` is already case-insensitive (this is correct for `_icontains` but means a separate explicit COLLATE clause is needed to make `_contains` case-sensitive — the translator emits `COLLATE Latin1_General_CS_AS` or similar based on the database's default collation)
- `_in` translates to `<col> IN (@p1, @p2, ...)`. For very large IN lists (> 2000 items), use a Table-Valued Parameter to avoid the per-statement parameter limit
- `_starts_with` uses `LIKE @p + '%'`
- `_is_null` translates to `<col> IS NULL` or `<col> IS NOT NULL`
- Boolean fields translate to BIT comparisons (`<col> = 1` for `_eq: true`)

**Property tests** run the same 10,000-random-filters battery as Postgres. The CI matrix runs both adapters in parallel.

### 6.5 Unit of Work

Implemented via the `mssql` package's transaction API. Begins a transaction on a dedicated connection from the pool; the connection is held for the duration of the transaction.

**MSSQL-specific behaviors:**

- Default isolation is `READ COMMITTED` with snapshot semantics (because we set `READ_COMMITTED_SNAPSHOT ON` on the database)
- Explicit `READ COMMITTED SNAPSHOT`, `SERIALIZABLE`, etc. supported via options
- Deadlock retries: MSSQL deadlocks are detected by error number 1205. The adapter retries up to 3 times with exponential backoff, logging each retry
- Long transaction warnings: same thresholds as Postgres adapter (30s warn, 5min error)

### 6.6 Schema Introspection Adapter

Implements `SchemaIntrospectionPort` against `sys.*` system views and `INFORMATION_SCHEMA.*`.

**Reads:**

- `listSchemas()` — `SELECT name FROM sys.schemas WHERE schema_id < 16384` (excludes system schemas)
- `listTables(schema)` — `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = @schema AND TABLE_TYPE = 'BASE TABLE'`
- `describeTable(schema, table)` — joins `sys.columns`, `sys.types`, `sys.default_constraints`, `sys.computed_columns`
- `listIndexes(schema, table)` — `sys.indexes` joined with `sys.index_columns`, `sys.columns`
- `listForeignKeys(schema, table)` — `sys.foreign_keys` with `sys.foreign_key_columns`
- `listConstraints(schema, table)` — `sys.check_constraints`, `sys.default_constraints`, `sys.key_constraints`

**Type mapping (MSSQL → normalized):**

| MSSQL                                            | Normalized               |
| ------------------------------------------------ | ------------------------ |
| `varchar(n)`, `nvarchar(n)`                      | `string(n)`              |
| `varchar(max)`, `nvarchar(max)`, `text`, `ntext` | `text`                   |
| `tinyint`, `smallint`, `int`                     | `integer`                |
| `bigint`                                         | `bigint`                 |
| `decimal(p,s)`, `numeric(p,s)`, `money`          | `decimal(p,s)`           |
| `bit`                                            | `boolean`                |
| `date`                                           | `date`                   |
| `datetime`, `datetime2`, `smalldatetime`         | `timestamp` (without TZ) |
| `datetimeoffset`                                 | `timestamp_tz`           |
| `uniqueidentifier`                               | `uuid`                   |
| `varbinary(n)`, `varbinary(max)`, `binary(n)`    | `binary`                 |
| `nvarchar(max) CHECK ISJSON`                     | `json` (via convention)  |
| (no array type)                                  | (not supported)          |

**Capability declarations:**

```typescript
supports(feature: SchemaFeature): boolean {
  switch (feature) {
    case 'schemas': return true;
    case 'foreign_keys': return true;
    case 'check_constraints': return true;
    case 'json_columns': return true;             // via nvarchar(max) + ISJSON check
    case 'array_columns': return false;            // genuinely not supported
    case 'partial_indexes': return true;            // FILTERED indexes
    case 'unique_indexes': return true;
    case 'spatial_indexes': return true;            // requires geometry/geography types
    case 'transactions': return true;
    case 'change_streams': return true;             // requires CDC enabled — runtime check
    default: return false;
  }
}
```

For features that require optional MSSQL features (CDC, FILESTREAM, In-Memory OLTP), the runtime check verifies the feature is enabled on the database.

### 6.7 Schema DDL Adapter

Implements `SchemaDdlPort` — generates T-SQL DDL.

**`createTable(definition)`:**

Emits `CREATE TABLE` with:

- All columns translated to MSSQL types
- Primary key constraint
- `CHECK (ISJSON(<col>) = 1 OR <col> IS NULL)` for json columns
- Foreign key constraints
- Default value constraints
- NOT NULL where appropriate
- Indexes as separate `CREATE INDEX` statements
- For unicode strings, uses `nvarchar` not `varchar` (always; the platform is internationalized)

**`alterTable(from, to)`:**

T-SQL diff generation. Specific MSSQL concerns:

- Adding a NOT NULL column to a table with rows requires either a default or an explicit two-step migration; the DDL adapter detects and emits warnings or splits the migration
- Changing column type often requires a table rewrite; flagged with warnings
- Renaming requires `sp_rename`, which is not transactional; flagged

**`validate(definition)`:**

- Reserved keywords as identifiers (T-SQL has more than Postgres)
- Identifier length limits (128 chars in MSSQL — generous)
- Array columns rejected
- Computed columns supported but marked as platform-managed (the data management module's UI doesn't expose them as user-editable)

### 6.8 Schema Migration

**`packages/adapters/persistence-mssql/migrations/`:**

```
migrations/
├── 0000_initial.sql
├── 0000_initial.down.sql
├── 0001_create_workspaces.sql
├── 0001_create_workspaces.down.sql
├── ...
└── _journal.json
```

**Migration runner: `packages/adapters/persistence-mssql/src/migrate.ts`:**

- Reads `_journal.json`
- Tracks applied migrations in `__platform_migrations` table (different name from Drizzle's default to avoid conflicts if customer also uses Drizzle elsewhere)
- Applies pending migrations in order, each in its own transaction where possible
- Records checksums; refuses to apply tampered migrations
- Logs every applied migration

**MSSQL-specific migration concerns:**

- Some DDL cannot run inside a transaction (e.g., `ALTER DATABASE`); these are documented and run outside the transaction with explicit confirmation
- Adding indexes on large tables: use `WITH (ONLINE = ON)` (Enterprise edition only) or schedule for maintenance window; documented
- Adding NOT NULL to existing columns: always two-step (add nullable, backfill, alter to NOT NULL)
- Dropping objects: explicit existence checks (`IF OBJECT_ID(N'<schema>.<obj>', 'U') IS NOT NULL`)

**CLI:**

Same as Postgres adapter:

- `pnpm db:migrate:mssql` (or, when `DATABASE_DRIVER=mssql`, just `pnpm db:migrate`)
- `pnpm db:migrate:mssql:status`
- `pnpm db:migrate:mssql:create <name>`
- `pnpm db:migrate:mssql:down <count>` (dev only by default)

### 6.9 Search Adapter (FullTextSearchPort) for MSSQL

MSSQL has Full-Text Search as a separate feature requiring installation. When available:

- Tables participating in FTS get a Full-Text Catalog and Full-Text Index
- Searches use `CONTAINS` and `FREETEXT` operators with `CONTAINSTABLE` for ranking
- The adapter wraps these in a `search()` method matching the FullTextSearchPort interface

When not available (FTS not installed on the customer's MSSQL), the adapter degrades to `LIKE`-based search with explicit lower performance and capability flag returns false for advanced search features.

Capability check at startup verifies FTS is installed.

### 6.10 Vector Store Adapter

MSSQL through 2022 has no native vector type. Options for the platform:

- **Azure AI Search** (separate adapter, configured via `VECTORSTORE_DRIVER=azure_search`) — recommended for Microsoft houses already on Azure
- **External Qdrant** (separate adapter, can be self-hosted on the same server) — recommended for on-premises MSSQL deployments
- **Wait for MSSQL 2025** — adds native vector support; an MSSQL vector adapter will land when that version is in production use

The MSSQL adapter does NOT implement `VectorStorePort`. The customer chooses an external vector store via env config. The platform documents this clearly in the deployment guide for MSSQL customers.

### 6.11 Observability of the Adapter

Specific MSSQL metrics:

- `platform_mssql_pool_active_connections`
- `platform_mssql_pool_idle_connections`
- `platform_mssql_pool_pending_acquires`
- `platform_mssql_query_duration_seconds{operation}`
- `platform_mssql_slow_queries_total`
- `platform_mssql_deadlocks_total` (counter on error 1205)
- `platform_mssql_deadlock_retries_total`
- `platform_mssql_connection_errors_total`

MSSQL-specific Grafana panel in `platform-persistence.json` showing these metrics alongside the Postgres ones (the dashboard adapts to whichever driver is active per environment).

For server-side metrics (cache hit ratio, query plan stats, blocking processes), an MSSQL exporter scraped by Prometheus is added — running it requires monitoring credentials on the customer's MSSQL.

### 6.12 Backups

**Customer-managed MSSQL:**

The platform does NOT take backups when MSSQL is customer-managed. The customer's existing backup strategy (SQL Agent jobs, Azure Backup, third-party tooling) is presumed. The platform documents what data needs to be in the backup scope and provides a verification checklist.

**Containerized MSSQL (our dev/test):**

- Daily `BACKUP DATABASE` command via a sidecar container
- Backup files written to a local volume
- Restic ingests, encrypts, ships to B2
- Retention same as Postgres adapter

**Restore procedure** (documented in runbook):

- For customer-managed: customer's responsibility, with platform-provided verification queries
- For containerized: provision new MSSQL container, `RESTORE DATABASE`, run conformance suite

### 6.13 Operational Runbooks

New files in `docs/runbooks/`:

- `mssql-operations.md` — connecting, common diagnostic queries (sp_who2, blocking, top queries)
- `mssql-migration-stuck.md` — what to do when a T-SQL migration hangs or fails
- `mssql-migration-online.md` — online schema changes for large tables
- `mssql-restore.md` — full restore procedure (containerized) and verification queries (customer-managed)
- `mssql-tuning.md` — connection pool sizing, isolation level configuration, index maintenance, statistics updates
- `mssql-windows-auth.md` — configuring NTLM/Kerberos authentication for AD-joined deployments
- `mssql-deployment-customer.md` — guide for customers deploying the platform against their own MSSQL instance
- `mssql-feature-prerequisites.md` — what features must be enabled (CDC, FTS, etc.) for which platform capabilities

### 6.14 Customer Deployment Considerations

Microsoft houses typically deploy on Windows Server with MSSQL on a separate server. Platform deployment in this scenario:

- Web app and worker run on Windows Server with IIS as the reverse proxy (`iisnode` for Node integration; documented separately as the Windows Runtime objective)
- MSSQL runs on its own server, the platform connects over the LAN
- Authentication may be Windows Authentication (NTLM/Kerberos) — the connection string and Tedious config support this
- The customer's DBA team owns MSSQL operations (backups, patching, tuning); the platform provides queries and recommendations but does not act
- Migrations run from the application server (or a dedicated maintenance jumphost) against MSSQL using the migration user

The Windows runtime support is its own objective (added later); this objective ensures the MSSQL adapter doesn't preclude it.

---

## 7. Implementation Order

1. **Add MSSQL to the dev Compose stack** as a separate Docker container (Microsoft's official `mcr.microsoft.com/mssql/server:2022-latest` image with a `MSSQL_PID=Developer` license). Expose on a non-default port to coexist with Postgres.

2. **Initialize the MSSQL database** — create database, set `READ_COMMITTED_SNAPSHOT ON`, create `platform_app` and `platform_migrate` users with appropriate grants.

3. **Write `packages/adapters/persistence-mssql/` skeleton:** package.json, tsconfig, README, src/index.ts.

4. **Write `connection.ts`** — connection pool with proper TLS, timeouts, retries.

5. **Write `_common.ts`** — standard column helpers using MSSQL-native types.

6. **Decide Drizzle vs. custom layer.** Evaluate Drizzle's MSSQL support at the time of implementation. If unstable, build a thin custom query builder. ADR-0029 documents the decision.

7. **Write the entity mapper helpers** — generic factory + interface (same pattern as Postgres).

8. **Write `repository.adapter.ts`** — generic repository factory using OUTPUT clauses, rowversion-based optimistic locking.

9. **Write `filter-translator.ts`** — Filter AST → T-SQL translator, with property-based tests.

10. **Write `unit-of-work.adapter.ts`** — transaction management with deadlock retries.

11. **Write `query.adapter.ts`** — typed read-only queries.

12. **Write `schema-introspection.adapter.ts`** — reads sys._ and INFORMATION_SCHEMA._.

13. **Write `schema-ddl.adapter.ts`** — generates T-SQL DDL with all the MSSQL-specific concerns.

14. **Write `migrate.ts`** — migration runner with MSSQL-specific transaction handling.

15. **Write `search.adapter.ts`** — FTS-based when available, LIKE-based fallback.

16. **Run the full conformance test suite** from `packages/ports/persistence/conformance/`. Make every test pass against MSSQL. **This is the moment of truth — this is where abstraction quality is validated.**

17. **Investigate and document every conformance test failure.** Each failure is one of:

    - A genuine adapter bug (fix it)
    - A capability mismatch (declare it; conformance suite respects capabilities)
    - An abstraction leak (push back against the abstraction; possibly amend Objective 1.5)

18. **Add MSSQL-specific observability** — adapter metrics, slow query logging, MSSQL exporter for server metrics.

19. **Wire into CI** — adapter tests run on every PR (matrix expanded from Postgres-only to Postgres + MSSQL).

20. **Set up containerized MSSQL backups** for our dev environment.

21. **Write all runbooks.**

22. **Write ADRs.**

23. **Run a restore drill.**

24. **Verify Definition of Done.**

---

## 8. ADRs to Write

- **ADR-0029: Drizzle vs. Custom Query Builder for MSSQL** — what we evaluated, why we chose what we chose
- **ADR-0030: rowversion for Optimistic Locking** — why MSSQL gets a different locking implementation, why the port-level semantics are unchanged
- **ADR-0031: No Vector Search Native to MSSQL Adapter** — the Azure AI Search and Qdrant alternatives, when MSSQL 2025 native vectors will be added
- **ADR-0032: nvarchar(max) + ISJSON for JSON Columns on MSSQL** — until MSSQL native JSON in 2025
- **ADR-0033: READ_COMMITTED_SNAPSHOT on Platform Databases** — why we mandate it, what changes if it's off
- **ADR-0034: No MERGE Statement** — why we use IF EXISTS / INSERT-ELSE-UPDATE pattern
- **ADR-0035: array<T> Not Supported on MSSQL** — capability flag, what fails gracefully, customer-facing implications

---

## 9. Verification Steps

1. **MSSQL stack is up.** Reachable from platform containers; reachable from CI for adapter tests.

2. **Connection pool works under load.** 100 concurrent queries served without errors. Metrics behave correctly.

3. **Conformance test suite passes.** Every test in `packages/ports/persistence/conformance/` passes against the MSSQL adapter.

   - Where capability flags say `false` (e.g., array columns), the suite respects the flag and skips with explanation
   - Where capability flags say `true`, the test runs and passes

4. **Filter translator passes property tests** for T-SQL syntax. 10,000 random filters; no SQL injection; all valid T-SQL.

5. **Round-trip type test.** Create table with every supported normalized type. Introspect. Definitions match.

6. **Optimistic locking via rowversion works.** Concurrent updates: one succeeds, one returns ConflictError.

7. **Soft delete works.** Archive a row. `findById` returns null by default; option enables archived retrieval.

8. **Deadlock retry works.** Force a deadlock between two transactions; the loser retries and eventually succeeds (or fails with appropriate error after retry budget exhausted).

9. **Statement timeout fires.** Query taking >30s is killed; adapter returns TimeoutError.

10. **Migration up/down works.** Apply, roll back one, reapply. State is consistent.

11. **Migration tampering detected.** Edit an applied migration; runner refuses with clear error.

12. **Online index creation works** (on Enterprise edition; documented as not available on Standard).

13. **JSON column validation.** Insert valid JSON: succeeds. Insert invalid JSON: rejected by CHECK constraint.

14. **Array column rejected at DDL time** with a clear error message.

15. **Backup runs successfully** on schedule (containerized MSSQL).

16. **Restore drill succeeds** (containerized MSSQL).

17. **Observability flows.** A query produces span, log, and metric, all correlated.

18. **Slow query logging** captures queries > 1s with sanitized SQL.

19. **No driver leakage.** dependency-cruiser confirms no service code imports `mssql` or driver internals.

20. **Cross-database CI matrix.** PR runs Postgres + MSSQL adapter conformance suites in parallel; both must pass.

21. **TLS enforced.** Connection without TLS is refused (in prod-like config).

22. **Two-user separation works.** `platform_app` cannot run DDL; `platform_migrate` can. Verified by attempting cross-privilege operations.

If all 22 pass, the objective is met.

---

## 10. Definition of Done

**Infrastructure**

- [ ] MSSQL Server 2022 running in dev Compose stack with persistent volume
- [ ] `READ_COMMITTED_SNAPSHOT` enabled on the platform database
- [ ] `platform_app` and `platform_migrate` users created with appropriate grants
- [ ] FTS feature evaluated; if installed, Full-Text Catalog created for searchable tables
- [ ] Daily BACKUP DATABASE runs in dev (designed for staging/prod, gated on activation)
- [ ] Restic ingests MSSQL backups

**Adapter Implementation**

- [ ] `packages/adapters/persistence-mssql/` package created
- [ ] `connection.ts` with pool, TLS, timeouts, retries
- [ ] Standard column helpers using MSSQL types
- [ ] Generic repository adapter using OUTPUT clauses
- [ ] T-SQL filter translator with property tests
- [ ] Unit of Work adapter with deadlock retries
- [ ] Query adapter
- [ ] Schema introspection adapter
- [ ] Schema DDL adapter (with array rejection, JSON CHECK, etc.)
- [ ] Migration runner
- [ ] FullTextSearchPort implementation (FTS or LIKE fallback)
- [ ] Capability declarations honest and runtime-verified

**Conformance**

- [ ] Full conformance test suite passes against MSSQL
- [ ] Round-trip type test passes
- [ ] Property-based filter test passes 10k random cases on T-SQL
- [ ] No service code imports `mssql` (dependency-cruiser verified)
- [ ] CI matrix runs Postgres and MSSQL conformance in parallel

**Migrations**

- [ ] Migration tool installed and working
- [ ] `_journal.json` tracked in git
- [ ] Up + down for every migration
- [ ] Migration checksum verification active
- [ ] CI promotion supports MSSQL migration jobs (designed; gated until MSSQL customer activates)

**Observability**

- [ ] MSSQL-specific metrics exposed
- [ ] Slow query logging works
- [ ] MSSQL exporter scraped by Prometheus
- [ ] Grafana dashboards adapt to MSSQL when active

**Operations**

- [ ] All runbooks in Section 6.13 written
- [ ] Quarterly restore drill scheduled
- [ ] Restore drill executed at least once successfully (containerized)
- [ ] Customer deployment guide for MSSQL written and reviewed

**Documentation**

- [ ] ADRs 0029–0035 written and Accepted
- [ ] `packages/adapters/persistence-mssql/README.md` covers setup, schema authoring, migrations, troubleshooting, customer deployment
- [ ] Type mapping table documented in the contract document for SchemaDdlPort
- [ ] Capability differences from Postgres documented in `docs/contracts/persistence-divergence.md`

**Verification**

- [ ] All 22 verification steps in Section 9 pass
- [ ] Performance baseline established: simple findById on 100k-row table p95 < 5ms (similar to Postgres)

---

## 11. Anti-Patterns to Refuse

- **Importing `mssql` outside this adapter.** Architecture violation.
- **Using `MERGE` for upsert.** Known concurrency issues; use IF EXISTS / INSERT-ELSE-UPDATE pattern.
- **String-concatenating T-SQL.** Always parameterized.
- **Skipping the `READ_COMMITTED_SNAPSHOT` configuration.** Without it, behavior diverges silently from Postgres adapter.
- **Using `varchar` for user-facing text.** Always `nvarchar`. The platform is Unicode-first.
- **Using `datetime` instead of `datetime2(7)`.** Precision mismatches with Postgres adapter cause subtle bugs.
- **Pretending arrays work.** Capability flag is `false` for a reason. Don't add a workaround that bridges to a JSON-encoded list silently.
- **Using `IDENTITY` columns.** UUID v7 is the platform's primary key strategy.
- **Skipping the conformance suite for MSSQL.** This adapter only proves portability if the conformance suite passes. Skipping tests means we ship an unproven adapter to enterprise customers.
- **Ignoring deadlocks instead of retrying.** Deadlocks are normal under concurrency. Retry, log, alert if frequent.
- **Editing applied migrations.** Same discipline as Postgres adapter.
- **Skipping the customer deployment guide.** The whole reason MSSQL exists in the platform is the customer; the deployment guide is part of the product.

---

## 12. Open Questions for Confirmation Before Starting

1. **MSSQL container in dev** — using the official Microsoft Linux container (Developer edition) is free for non-production use. Confirmed?

2. **Drizzle vs. custom query builder** — defer this decision until implementation; evaluate Drizzle's MSSQL support at that moment. ADR-0029 will document the decision.

3. **Vector store strategy for MSSQL customers** — recommend Azure AI Search for Azure-resident customers, Qdrant for on-prem. Confirmed?

4. **Customer authentication mode** — for Microsoft house deployments, do you anticipate Windows Authentication (NTLM/Kerberos against AD) or SQL authentication (username/password)? Both are supported; which gets the deeper documentation focus first?

5. **MSSQL minimum version supported** — proposing 2019 as the floor. Confirm you're OK with declining customers on 2017 and earlier.

6. **CI runners** — running MSSQL containers in GitHub Actions adds CI time. Acceptable trade-off for parity testing on every PR? Alternative is a nightly conformance run.

---

## 13. What Comes Next

With Objective 4a complete, the platform's persistence layer can target both PostgreSQL and Microsoft SQL Server with the same conformance guarantees. Two databases prove the abstraction; the third (MongoDB) stress-tests it against a different paradigm.

**Objective 4b: MongoDB Adapter** is next. The document model is fundamentally different from relational databases. The same ports must hold: RepositoryPort, UnitOfWorkPort (Mongo transactions exist; usability varies), QueryPort, SchemaIntrospectionPort (Mongo schemas are implicit; the adapter infers them), SchemaDdlPort (translated to "ensure collection exists with optional validators"), SchemaMigrationPort (Mongo "migrations" are different — schema validators, indexes, data backfills).

**Objective 4c: Cross-Database Conformance Verification** runs the full conformance suite against all three adapters in CI on every PR. Detects drift early.

**Objective 4d: Change Streams** implements `ChangeStreamPort` per database (Postgres logical replication, MSSQL CDC, Mongo change streams) — needed for the data management module's real-time features.

After the database family, **Objective 5: Auth and User Directory** is built — and notably, it's part of the data management module, since the platform's auth IS the Supabase-clone auth feature.

---

_This document is the contract. Every checkbox in Section 10 must be true before moving on._
