# Objective 4: Database & Migration Discipline (PostgreSQL Adapter)

**Status:** Ready for development
**Prerequisites:** Objectives 1, 1.5, 2, 3 complete
**Blocks:** Every objective that touches persistence (i.e., everything from here on)
**Companions:** Objective 4a (MSSQL Adapter) and Objective 4b (Mongo Adapter) follow the same shape

---

## 1. Purpose

Implement the persistence ports defined in Objective 1.5 against PostgreSQL. Establish the migration discipline, schema authoring conventions, and operational practices that will be replicated for MSSQL and Mongo.

PostgreSQL is the **reference adapter** — the one against which the conformance test suite is calibrated, the one used in the maintainer's reference deployment, and the one with the deepest feature support. The other database adapters must reach feature parity with this one (modulo capabilities that are genuinely impossible).

This objective produces no user-visible features. It produces a working, tested, observable, migration-disciplined PostgreSQL persistence layer.

**Why Postgres first:**

- The maintainer's reference stack uses Postgres
- The richest type system makes capability negotiation easier to design correctly
- The largest community of self-hostable tooling (pgvector, pg_partman, logical replication, etc.)
- Easiest to run in CI (Docker, fast startup, deterministic)

---

## 2. Scope

### In Scope

- PostgreSQL driver selection and configuration
- Schema authoring approach (Drizzle as the schema-as-TypeScript layer beneath the port abstraction)
- Migration system: authoring, applying, verifying, rolling back
- All persistence port implementations: `RepositoryPort`, `UnitOfWorkPort`, `QueryPort`, `SchemaIntrospectionPort`, `SchemaDdlPort`, `SchemaMigrationPort`
- Filter AST → SQL translation
- Connection management: pooling, retries, timeouts, health checks
- Query observability: spans, query metrics, slow query logging
- Type mapping: platform's normalized type system ↔ Postgres native types
- Conformance test suite execution
- Seed data infrastructure
- Backup and restore procedures specific to Postgres
- Performance baseline tests
- Operational runbooks
- ADRs

### Out of Scope (Belongs to Later Objectives)

- The actual platform schema (workspaces, users, projects, artifacts) — this objective implements the _mechanics_ of persistence, not the platform's own schema. The schema lands when each module needs its tables (Auth/User Directory in the Data Management Module, etc.)
- MSSQL adapter (Objective 4a)
- Mongo adapter (Objective 4b)
- Read replicas / sharding / clustering (deferred until needed)
- Schema designer UI (Data Management Module)
- Auto-generated APIs (Data Management Module)
- Real-time change streams (Objective 4d — eventing & change streams family)

---

## 3. Locked Decisions

| Decision                         | Choice                                                                          | Rationale                                                        |
| -------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Postgres version                 | 16 (and 17 once stable in your distro)                                          | Long support window; modern features; good Drizzle support       |
| Driver                           | `pg` (node-postgres)                                                            | Reference Node Postgres driver; battle-tested                    |
| Connection pooling (server-side) | PgBouncer in transaction mode                                                   | Industry standard; works at any scale; easy to add to Compose    |
| Connection pooling (client-side) | `pg-pool` (built into `pg`)                                                     | One pool per process                                             |
| ORM/query builder layer          | Drizzle ORM (under the port abstraction)                                        | Schema-as-TS, lightweight, escape hatches to raw SQL when needed |
| Migration tool                   | Drizzle's `drizzle-kit` migrations                                              | Generates migrations from schema diff; reviewable SQL output     |
| Migration storage                | Migrations in repo as plain SQL files; checksummed                              | Reviewable, deterministic, version-controllable                  |
| Migration mechanism              | Apply via Drizzle's migration runner OR raw SQL — both supported                | Raw SQL for tricky migrations (data backfills, complex DDL)      |
| Optimistic locking               | Every entity table has `_version` integer column auto-incremented on update     | Universal pattern that works across all three databases          |
| Soft delete                      | Every entity table has `_archived_at timestamptz` column                        | Universal pattern                                                |
| Tenancy column                   | Every workspace-scoped table has `workspace_id uuid` column with index          | Enforced via the repository layer                                |
| Primary key strategy             | UUID v7 (time-ordered, indexable, sortable)                                     | Universal across databases; sortable by creation time            |
| Naming convention                | `snake_case` for everything in SQL; `camelCase` only at the TypeScript boundary | Standard Postgres convention; mapper handles the translation     |
| Search                           | `tsvector` columns for full-text search                                         | First-class Postgres feature; powers the FullTextSearchPort      |
| JSON columns                     | `jsonb` (not `json`)                                                            | Indexable, queryable, the right default                          |
| Time zones                       | All timestamps are `timestamptz` (UTC stored)                                   | Avoids the "what timezone is this?" question                     |
| Transaction isolation            | `READ COMMITTED` default; `REPEATABLE READ` for explicit cases                  | Postgres default; matches most use cases                         |
| Foreign keys                     | Always declared; cascade behavior explicit per relationship                     | Data integrity is a database job                                 |
| Indexes                          | Every foreign key indexed; every column used in `WHERE` clauses indexed         | Standard; verified via slow query analysis                       |
| Statement timeout                | 30 seconds default; configurable per-query                                      | Prevents runaway queries from holding connections                |

---

## 4. Architectural Overview

```
                ┌──────────────────────────────────────────┐
                │  Service Layer (packages/core)            │
                │  Knows only port interfaces               │
                └──────────────────┬───────────────────────┘
                                   │
                                   │ uses
                                   ▼
                ┌──────────────────────────────────────────┐
                │  packages/ports/persistence/             │
                │  RepositoryPort, UnitOfWorkPort, etc.    │
                └──────────────────┬───────────────────────┘
                                   │
                                   │ implemented by
                                   ▼
                ┌──────────────────────────────────────────┐
                │  packages/adapters/persistence-postgres/ │
                │                                           │
                │  ┌────────────────────────────────────┐  │
                │  │  Drizzle (query builder + schema)  │  │
                │  └─────────────────┬──────────────────┘  │
                │                    │                      │
                │  ┌─────────────────▼──────────────────┐  │
                │  │  pg (node-postgres driver)          │  │
                │  └─────────────────┬──────────────────┘  │
                └────────────────────┼──────────────────────┘
                                     │
                                     ▼
                            ┌─────────────────┐
                            │   PgBouncer     │
                            │  (transaction   │
                            │     mode)       │
                            └────────┬────────┘
                                     │
                                     ▼
                            ┌─────────────────┐
                            │   PostgreSQL    │
                            │       16        │
                            └─────────────────┘
```

Drizzle sits **inside** the adapter, **never** leaks across the port boundary. Service code never imports from `drizzle-orm`. If a feature needs raw SQL, it goes through a typed method on the adapter, not by reaching into Drizzle directly.

---

## 5. Component Specifications

### 5.1 Driver and Pool Configuration

**`packages/adapters/persistence-postgres/src/connection.ts`:**

- Single `pg.Pool` per process, sized via `POSTGRES_POOL_SIZE` env var
- Connection string built from `POSTGRES_URL`
- TLS enabled by default; `sslmode=require` for production
- Statement timeout set on every connection: `SET statement_timeout = '30s'`
- Idle session timeout to prevent zombies: `SET idle_in_transaction_session_timeout = '60s'`
- Connection retries with exponential backoff on startup (up to 30s)
- Health check: `SELECT 1` query, exposed via the platform's `/_status` endpoint
- Pool metrics emitted to the MetricsPort (active connections, idle connections, wait time)
- Connection events logged at debug level with sanitized DSN

**Two pools per environment:**

- `pool` — application pool, points at PgBouncer (transaction mode), used for normal queries
- `directPool` — direct-to-Postgres pool, used for migrations and operations PgBouncer can't handle (LISTEN/NOTIFY, prepared statements that span connections, advisory locks)

PgBouncer's transaction mode is incompatible with some Postgres features (session-level state, `LISTEN/NOTIFY`, prepared statements that span connections). The `directPool` is the escape hatch.

### 5.2 Schema Authoring with Drizzle

Schemas live in `packages/adapters/persistence-postgres/src/schema/`, organized by domain area:

- `schema/index.ts` — re-exports
- `schema/_common.ts` — shared columns (id, version, archived_at, audit columns)
- `schema/<domain>.ts` — one file per domain area as platform schema grows

**Standard column helper:**

```typescript
// packages/adapters/persistence-postgres/src/schema/_common.ts
import { pgTable, uuid, integer, timestamp, varchar } from 'drizzle-orm/pg-core';

/** Standard columns every entity table has. */
export const standardColumns = {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  version: integer('_version').notNull().default(1),
  archivedAt: timestamp('_archived_at', { withTimezone: true }),
  createdAt: timestamp('_created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('_updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('_created_by'), // FK to users; nullable for system-created rows
  updatedBy: uuid('_updated_by'),
};

/** Tenant scope. Every workspace-scoped entity adds this. */
export const tenantColumns = {
  workspaceId: uuid('workspace_id').notNull(),
};
```

Every entity schema spreads these helpers, ensuring every entity has the same lifecycle columns and tenancy.

**Example (illustrative; the actual platform schema lands in later objectives):**

```typescript
import { pgTable, varchar, jsonb, index } from 'drizzle-orm/pg-core';
import { standardColumns, tenantColumns } from './_common';

export const projects = pgTable(
  'projects',
  {
    ...standardColumns,
    ...tenantColumns,
    name: varchar('name', { length: 255 }).notNull(),
    description: varchar('description', { length: 4000 }),
    metadata: jsonb('metadata').notNull().default({}),
  },
  (t) => ({
    workspaceIdx: index('projects_workspace_idx').on(t.workspaceId),
    nameIdx: index('projects_name_idx').on(t.workspaceId, t.name),
  }),
);
```

**Why Drizzle inside the adapter, not as the platform's primary persistence story:**

- Drizzle gives strong types and a pleasant API for the adapter author
- Drizzle generates migration SQL from schema changes
- Service code never sees Drizzle — it sees the port interface, which is the same regardless of underlying tooling
- If we ever want to swap Drizzle for a different Postgres tool, only this adapter changes; nothing else does

### 5.3 Repository Adapter

The most-used adapter. Implements `RepositoryPort<TEntity, TId>` for any Drizzle table.

**Architecture: a generic adapter that takes a Drizzle table and produces a `RepositoryPort`:**

```typescript
// packages/adapters/persistence-postgres/src/repository.adapter.ts
import { ResultAsync, ok, err } from 'neverthrow';
import { eq, and, sql } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { RepositoryPort, Filter, Page, PaginatedResult } from '@platform/ports-persistence';

export function createPostgresRepository<TEntity, TId = string>(
  db: PostgresDatabase,
  table: PgTable,
  mapper: EntityMapper<TEntity>,
): RepositoryPort<TEntity, TId> {
  return {
    findById: (id) => /* ... */,
    findOne: (filter) => /* ... */,
    findMany: (opts) => /* ... */,
    count: (filter) => /* ... */,
    create: (entity) => /* ... */,
    update: (id, changes, opts) => /* ... */,
    archive: (id) => /* ... */,
    hardDelete: (id) => /* ... */,
  };
}
```

**Critical behaviors:**

- All operations open a span via `TracerPort`
- All operations record histogram metrics (`platform_persistence_query_duration_seconds`)
- All operations check for `_archived_at IS NULL` by default; an explicit option enables querying archived rows
- `update` enforces optimistic locking when `expectedVersion` is provided: `WHERE id = $1 AND _version = $2`; if zero rows updated, returns `ConflictError`
- `update` automatically increments `_version` and refreshes `_updated_at`, `_updated_by`
- `archive` sets `_archived_at = now()` rather than deleting
- `hardDelete` requires explicit policy permission; it logs at warn level whenever invoked
- All errors are translated to typed errors from `@platform/ports-persistence/errors`
- All operations are observable: structured logs include `entity`, `operation`, `correlationId`, `workspaceId` (where applicable), `duration_ms`

**The mapper:**

The mapper translates between the platform's TypeScript types (camelCase) and the database row representation (snake_case). It also handles JSON parsing / stringifying for jsonb columns:

```typescript
export interface EntityMapper<TEntity> {
  toDbRow(entity: TEntity): Record<string, unknown>;
  fromDbRow(row: Record<string, unknown>): TEntity;
  partialToDbRow(changes: Partial<TEntity>): Record<string, unknown>;
}
```

A factory helper generates standard mappers for entities that are simple field-name translations; complex entities can implement the mapper manually.

### 5.4 Filter AST → SQL Translator

The single hardest piece of this objective. The platform's `Filter<T>` AST (defined in Objective 1.5) must translate to parameterized SQL safely.

**`packages/adapters/persistence-postgres/src/filter-translator.ts`:**

```typescript
export interface TranslatedFilter {
  whereClause: string;
  params: unknown[];
}

export function translateFilter<T>(filter: Filter<T>, table: PgTable, startingParamIndex = 1): Result<TranslatedFilter, FilterError> {
  // recursively walk the AST
  // produce a parameterized WHERE clause
  // return errors for unsupported operators or invalid field references
}
```

**Critical correctness properties:**

- **Parameterization is absolute.** Every value goes through `$1`, `$2`, ... bind parameters. No string concatenation. Ever.
- **Field name validation.** A filter referencing `users.password_hash` (or any column) must be matched against the table's known columns; references to unknown columns return an error. This prevents bypass of column-level access control.
- **Operator capability validation.** Not all operators apply to all column types. `_contains` on `integer` is rejected.
- **Null handling.** `_eq: null` translates to `IS NULL`. `_neq: null` translates to `IS NOT NULL`. Postgres `=` doesn't match nulls; the translator handles this.
- **Case-insensitive search.** `_icontains` uses `ILIKE` with proper escaping of `%` and `_`.

**Property-based tests** verify the translator:

- For any random `Filter<T>`, the produced SQL is syntactically valid (run through a SQL parser)
- For any random filter, no value appears as a literal in the SQL string (only as a parameter)
- A filter and its negation produce complementary result sets on a known dataset

These tests run in CI for every PR.

### 5.5 Unit of Work

The `UnitOfWorkPort` provides transaction boundaries for multi-repository operations.

```typescript
export interface UnitOfWorkPort {
  /** Run a function within a transaction. Rolls back on error or thrown rejection. */
  transaction<T>(fn: (uow: UnitOfWorkContext) => Promise<Result<T, unknown>>): Promise<Result<T, unknown>>;
}

export interface UnitOfWorkContext {
  /** Get a repository scoped to this transaction. */
  repository<TEntity, TId>(name: string): RepositoryPort<TEntity, TId>;

  /** Execute raw SQL within the transaction. Use sparingly. */
  raw<T>(sql: SqlTemplate): Promise<Result<T, PersistenceError>>;
}
```

The Postgres adapter implements this via Drizzle's transaction API, which uses a single connection from `directPool` for the duration of the transaction (PgBouncer transaction mode would prevent commits across statements; we need a session-stable connection).

**Critical behaviors:**

- Nested transactions use savepoints
- A transaction span wraps the entire operation
- Rollback is the default on any returned `Err` from the function or on a thrown exception
- Long-running transactions (> 30s) emit warnings; > 5 minutes emit errors
- A connection deadlock is retried up to 3 times with backoff

### 5.6 Schema Introspection Adapter

Implements `SchemaIntrospectionPort` against `pg_catalog` and `information_schema`.

**Reads:**

- `listSchemas()` — `SELECT schema_name FROM information_schema.schemata`
- `listTables(schema)` — joins on `information_schema.tables` filtering by schema and excluding system schemas
- `describeTable(schema, table)` — joins `information_schema.columns`, `pg_catalog.pg_type`, etc.; returns the normalized `TableDefinition`
- `listIndexes(schema, table)` — `pg_indexes` plus `pg_index` for column lists and uniqueness
- `listForeignKeys(schema, table)` — `pg_constraint` with `contype = 'f'`
- `listConstraints(schema, table)` — all of `pg_constraint`

**Type mapping (Postgres → normalized):**

| Postgres                       | Normalized     |
| ------------------------------ | -------------- |
| `varchar(n)`                   | `string(n)`    |
| `text`                         | `text`         |
| `int2`, `int4`, `int`          | `integer`      |
| `int8`, `bigint`               | `bigint`       |
| `numeric(p,s)`, `decimal(p,s)` | `decimal(p,s)` |
| `boolean`, `bool`              | `boolean`      |
| `date`                         | `date`         |
| `timestamp` (without tz)       | `timestamp`    |
| `timestamptz`                  | `timestamp_tz` |
| `uuid`                         | `uuid`         |
| `bytea`                        | `binary`       |
| `json`, `jsonb`                | `json`         |
| `T[]`                          | `array<T>`     |

Unmapped types (e.g., `tsvector`, `geometry`) are surfaced as `unknown` with the original type name in metadata. The data management UI shows them as read-only.

**Capability declaration:**

```typescript
supports(feature: SchemaFeature): boolean {
  switch (feature) {
    case 'schemas': return true;
    case 'foreign_keys': return true;
    case 'check_constraints': return true;
    case 'json_columns': return true;
    case 'array_columns': return true;
    case 'partial_indexes': return true;
    case 'unique_indexes': return true;
    case 'spatial_indexes': return true;  // requires PostGIS extension; tested at runtime
    case 'transactions': return true;
    case 'change_streams': return true;   // requires logical replication enabled
    default: return false;
  }
}
```

For features that require optional Postgres extensions (PostGIS, pgvector), the capability check tests whether the extension is installed at startup and caches the result.

### 5.7 Schema DDL Adapter

Implements `SchemaDdlPort` — generates DDL from the normalized model.

**`createTable(definition: TableDefinition): DdlStatement[]`:**

Emits `CREATE TABLE` with:

- All columns translated from normalized types to Postgres types
- Primary key constraint
- Foreign key constraints (if the referenced tables exist)
- Default values
- NOT NULL where appropriate
- Constraints (CHECK, UNIQUE)
- Indexes as separate `CREATE INDEX` statements (more readable; same effect)

**`alterTable(from, to)`:**

Computes the diff and emits the minimum DDL:

- Add new columns (`ALTER TABLE ... ADD COLUMN`)
- Drop removed columns (with explicit user confirmation flag — destructive)
- Change column types (only when safe; rejects unsafe changes like `text → integer`)
- Add/remove indexes
- Add/remove constraints

Emits warnings for:

- Long-running operations (e.g., adding NOT NULL to an existing column with data)
- Operations requiring a table rewrite

**`validate(definition)`:**

Catches problems before submitting DDL:

- Reserved keywords as column names
- Column name length limits (Postgres: 63 chars)
- Invalid type combinations
- Missing primary key (the platform requires every entity to have one)

### 5.8 Schema Migration

Migrations are the engineered backbone. Every schema change is a versioned, reviewable, reversible migration.

**`packages/adapters/persistence-postgres/migrations/`:**

```
migrations/
├── 0000_initial.sql
├── 0000_initial.down.sql
├── 0001_add_workspaces.sql
├── 0001_add_workspaces.down.sql
├── ...
└── _journal.json   # Drizzle's tracking file (gitted)
```

Migrations are plain SQL by default (generated by `drizzle-kit` from schema diffs and reviewed/refined by hand). Complex migrations (data backfills, multi-step rollouts) are written by hand.

**Migration discipline:**

- Every up migration has a tested down migration
- Every migration is idempotent or guarded by `IF NOT EXISTS` / `IF EXISTS`
- Migrations that hold long locks (large `ALTER TABLE`) use Postgres-specific tricks: lock timeouts, batched updates, `CONCURRENTLY` for indexes
- Data migrations separate from DDL migrations (DDL goes first, then data, then any cleanup DDL)
- Every migration is reviewed in a PR like any code change
- Migration names are descriptive: `0042_add_artifact_reasoning_column.sql`, not `0042_changes.sql`

**Migration runner:**

`packages/adapters/persistence-postgres/src/migrate.ts`:

- Reads `_journal.json`
- Compares with `__drizzle_migrations` table in the database
- Applies pending migrations in order
- Each migration runs in its own transaction (where possible — some Postgres DDL can't run transactionally; documented per migration)
- Records checksums; refuses to apply if a migration's checksum doesn't match the recorded one (protects against tampered migrations)
- Logs every applied migration with span and structured context

**CLI:**

- `pnpm db:migrate` — apply pending migrations
- `pnpm db:migrate:status` — show pending and applied
- `pnpm db:migrate:create <name>` — generate a new migration template
- `pnpm db:migrate:down <count>` — roll back N migrations (dev only by default; gated by env var in prod)

**Promotion:**

The CI pipeline (extended from Objective 2) gains real migration logic:

- On merge to `develop`: migrations apply automatically to dev
- On merge to `staging`: migrations apply with manual approval, after staging Postgres backup snapshot
- On merge to `main`: migrations apply with manual approval, after prod Postgres backup snapshot AND a successful staging migration in the previous run

A failed migration is automatically rolled back if possible; if not, the deployment is halted and the runbook for "stuck migration" applies.

### 5.9 Type Mapping in the Other Direction

When the data management module's UI lets a user create a table with type `string(50)`, the Postgres adapter translates that to `varchar(50)`. The reverse mapping (introspection) reads `character varying(50)` from `information_schema` and returns `string(50)`.

Both directions must be exact. The conformance test includes a round-trip test: define a table with every supported type, create it via DDL, introspect it, verify the introspected definition equals the original.

### 5.10 Search Adapter (FullTextSearchPort)

Implementation of `FullTextSearchPort` for Postgres uses `tsvector` columns and GIN indexes.

```typescript
// platform-managed: tables that participate in full-text search
// have a `_search tsvector GENERATED ALWAYS AS ... STORED` column
// with a GIN index. The adapter generates this DDL when a table
// is registered for FTS via the data management module.

export class PostgresFullTextSearchAdapter implements FullTextSearchPort {
  search(opts): Promise<Result<SearchResult[], SearchError>> {
    // SELECT ..., ts_rank(_search, plainto_tsquery($1)) AS rank
    // FROM <table>
    // WHERE _search @@ plainto_tsquery($1)
    //   AND workspace_id = $2
    // ORDER BY rank DESC
    // LIMIT $3
  }
}
```

For platform-internal search (artifacts, audit logs, project metadata), the relevant tables get FTS columns from their initial migrations. For customer-defined tables in the data management module, FTS is opt-in per table.

### 5.11 Vector Store Adapter (VectorStorePort with pgvector)

Implementation of `VectorStorePort` for Postgres uses the pgvector extension.

- Requires `CREATE EXTENSION vector;` in the database
- Capability check at startup verifies the extension is installed
- Embedding columns are `vector(N)` where N is the embedding dimension
- HNSW or IVFFlat indexes for similarity search

The vector store is used by the AI layer (RAG over the entity graph), so this adapter is required for the full platform feature set on Postgres deployments. On MSSQL, an alternative (Azure AI Search adapter, or a separate Qdrant deployment) provides the same port.

### 5.12 PgBouncer Setup

PgBouncer runs as a container in the Compose stack alongside Postgres. Configuration:

- **Pool mode:** transaction
- **Default pool size:** 20 (per database)
- **Max client connections:** 200
- **Server connection lifetime:** 1 hour
- **Authentication:** `auth_query` against the Postgres user table (so PgBouncer doesn't need passwords stored in plaintext config)

The application connects to PgBouncer (`POSTGRES_URL` points at PgBouncer's host:port). The migration tool and the `directPool` connect directly to Postgres (`POSTGRES_DIRECT_URL` env var).

### 5.13 Backups

Postgres-specific backup procedures, building on Objective 2's Restic infrastructure.

**Daily logical backups** via `pg_dump`:

- Run as a sidecar container in the Compose stack
- Cron schedule: `03:00 SAST` daily
- Output: `/backups/postgres/<env>/<date>.sql.gz`
- Restic ingests this directory daily, encrypts, ships to B2
- Old `.sql.gz` files removed after 7 days locally (kept off-site by Restic indefinitely per its retention policy)

**Continuous WAL archiving** (deferred until prod activates):

- Postgres `archive_command` ships WAL segments to local volume
- Restic ingests
- Enables point-in-time recovery (PITR) — restore to any moment, not just last backup

**Restore procedure** (documented in runbook):

1. Provision a fresh Postgres
2. Restore the latest pg_dump
3. Apply WAL segments up to the desired point in time (if PITR enabled)
4. Verify integrity via known queries
5. Switch traffic

Quarterly drill: restore a backup to a fresh Postgres in the dev environment, run the conformance test suite against it. Documented and scheduled.

### 5.14 Observability of the Adapter Itself

Specific to this adapter (in addition to the platform-wide metrics from Objective 3):

- `platform_postgres_pool_active_connections` (gauge)
- `platform_postgres_pool_idle_connections` (gauge)
- `platform_postgres_pool_wait_count` (counter)
- `platform_postgres_query_duration_seconds{operation}` (histogram, finer-grained than the generic persistence metric)
- `platform_postgres_slow_queries_total` (counter — queries > 1s)
- `platform_postgres_deadlocks_total` (counter)
- `platform_postgres_connection_errors_total` (counter)
- Postgres exporter scraped by Prometheus for server-side metrics (cache hit ratio, table sizes, lock waits, etc.)

Slow queries (> 1s by default, configurable) are logged at `warn` with the SQL (parameterized form), parameters (sanitized), and stack trace.

### 5.15 Operational Runbooks

New files in `docs/runbooks/`:

- `postgres-operations.md` — connecting, common queries for diagnostics, lock investigation
- `postgres-migration-stuck.md` — what to do when a migration won't apply or won't roll back
- `postgres-restore.md` — full restore procedure
- `postgres-pitr.md` — point-in-time recovery (when activated)
- `postgres-tuning.md` — connection pool sizing, statement timeouts, autovacuum tuning
- `postgres-extension-install.md` — adding pgvector, PostGIS, etc. safely

---

## 6. Implementation Order

1. **Add Postgres + PgBouncer to the dev Compose stack** with persistent volumes and reasonable defaults. Bring it up. Verify connectivity.

2. **Install required extensions:** `pgcrypto`, `pg_trgm`, `uuid-ossp`, `pgvector`. Verify each.

3. **Write `packages/adapters/persistence-postgres/` skeleton:** package.json, tsconfig, README, src/index.ts.

4. **Write `connection.ts`** — the `pg.Pool` setup, two pools (PgBouncer and direct), health check, retries.

5. **Write `_common.ts`** — standard column helpers.

6. **Write the entity mapper helpers** — generic factory + interface for custom mappers.

7. **Write `repository.adapter.ts`** — the generic repository factory. This is the single largest piece of code in this objective.

8. **Write `filter-translator.ts`** — the Filter AST → SQL translator. Add property-based tests.

9. **Write `unit-of-work.adapter.ts`** — transaction management.

10. **Write `query.adapter.ts`** — typed read-only queries (for reports, complex aggregations the repository pattern doesn't fit).

11. **Write `schema-introspection.adapter.ts`** — reads pg_catalog and information_schema.

12. **Write `schema-ddl.adapter.ts`** — generates DDL for create/alter/drop.

13. **Write `migrate.ts`** — migration runner.

14. **Write `search.adapter.ts`** — FullTextSearchPort implementation.

15. **Write `vectorstore.adapter.ts`** — VectorStorePort implementation.

16. **Run the full conformance test suite from `packages/ports/persistence/conformance/`.** Make every test pass for the Postgres adapter.

17. **Add Postgres-specific observability** — adapter-level metrics and slow query logging.

18. **Wire the migration runner into CI promotion** — extending Objective 2's promote.yml with real migration logic.

19. **Set up daily pg_dump backup cron** in the Compose stack.

20. **Write all runbooks** in Section 5.15.

21. **Write ADRs.**

22. **Run a full restore drill** — back up dev, restore to a fresh instance, run conformance tests.

23. **Verify Definition of Done.**

---

## 7. ADRs to Write

- **ADR-0024: Drizzle Inside the Postgres Adapter** — why Drizzle, why under the port, what we give up
- **ADR-0025: PgBouncer in Transaction Mode** — when it bites, the directPool escape hatch
- **ADR-0026: UUID v7 as Primary Keys** — sortable, indexable, time-ordered, universal across databases
- **ADR-0027: Soft Delete and Optimistic Locking by Default** — every entity, every operation
- **ADR-0028: Migration Discipline** — review process, idempotency, rollback testing, promotion gates

---

## 8. Verification Steps

1. **Postgres stack is up** and reachable from the platform containers and (for migrations) from CI.

2. **Connection pool works.** Generate 100 concurrent queries; pool serves all without errors. Metrics show active/idle counts moving as expected.

3. **Conformance test suite passes.** Every test in `packages/ports/persistence/conformance/` passes against the Postgres adapter.

4. **Filter translator passes property tests.** Run 10,000 random filters; all produce valid parameterized SQL. No filter produces literal-injected SQL.

5. **Round-trip type test.** Create a table with every supported normalized type via the DDL adapter. Introspect it. The introspected definition equals the original.

6. **Optimistic locking blocks concurrent updates.** Two concurrent updaters of the same row: one succeeds, one gets `ConflictError`.

7. **Soft delete works.** Archive a row. `findById` returns null by default; with `includeArchived: true`, returns the row with `_archived_at` set.

8. **Hard delete is logged at warn level** every time it's invoked.

9. **Statement timeout fires.** Run a query that takes > 30s. It's killed with the proper Postgres error code; the adapter translates to `TimeoutError`.

10. **Migration up/down works.** Apply migrations. Roll back one. Apply again. Database state is consistent.

11. **Migration tampering detected.** Edit a migration file's content (not its number). Try to apply migrations. The runner refuses, citing checksum mismatch.

12. **Long-running transaction warning fires.** Open a transaction; sleep 35s within it. Warning log appears. Sleep another 5 minutes. Error log appears.

13. **PgBouncer transaction pooling works** for normal app queries; **directPool works** for migrations.

14. **pg_dump backup runs successfully** on schedule. Verify file exists, is non-empty, and gunzips successfully.

15. **Restore drill succeeds.** Restore the latest backup to a fresh Postgres. Run a sanity query. Run conformance tests against the restored instance.

16. **Observability flows.** A query produces a span in Tempo, a log line in Loki, and metrics in Prometheus, all correlated by trace ID and within 30 seconds.

17. **Slow query logging.** Run a query > 1s. It appears in logs with parameterized SQL.

18. **CI promotion runs the migration job** on merge to staging (when staging is activated) with manual approval gate.

19. **Capability flags are accurate.** Each capability declared by the adapter is verified at runtime against the actual Postgres instance.

20. **No driver leakage.** dependency-cruiser confirms no service code imports `pg`, `drizzle-orm`, or any Postgres-specific module.

If all 20 pass, the objective is met.

---

## 9. Definition of Done

**Infrastructure**

- [ ] Postgres 16 running in dev Compose stack with persistent volume
- [ ] PgBouncer running, configured for transaction mode
- [ ] Required extensions installed: pgcrypto, pg_trgm, uuid-ossp, pgvector
- [ ] Daily pg_dump cron running (dev only for now; designed for staging/prod)
- [ ] Restic ingesting backups to Backblaze B2

**Adapter Implementation**

- [ ] `packages/adapters/persistence-postgres/` package created
- [ ] `connection.ts` with two pools, health checks, retries
- [ ] Standard column helpers
- [ ] Generic repository adapter
- [ ] Filter translator with property-based tests
- [ ] Unit of Work adapter
- [ ] Query adapter for read-only complex queries
- [ ] Schema introspection adapter
- [ ] Schema DDL adapter (create, alter, drop, validate)
- [ ] Migration runner (apply, status, create, down)
- [ ] FullTextSearchPort implementation using tsvector
- [ ] VectorStorePort implementation using pgvector
- [ ] Capability declarations verified against runtime

**Conformance**

- [ ] Full conformance test suite from `packages/ports/persistence` passes against Postgres adapter
- [ ] Round-trip type test (DDL → introspect → equality) passes
- [ ] Property-based filter test passes 10k random cases
- [ ] No service code imports `pg` or `drizzle-orm` (dependency-cruiser verified)

**Migrations**

- [ ] Migration tool installed and working
- [ ] `_journal.json` tracked in git
- [ ] Up + down for every migration
- [ ] Migration checksum verification active
- [ ] CI promotion pipeline applies migrations to dev automatically
- [ ] Staging and prod migration jobs designed and gated
- [ ] **`platform_versions` table** present (added in migration `0009_platform_versions`). Append-only audit log of platform release-version upgrades, distinct from `__platform_migrations` (which tracks schema migrations). Read by the upgrade orchestrator (Objective 9.5) to determine the platform's current release version on this database. See [objectives/9.5-platform-upgrade-and-versioning.md](9.5-platform-upgrade-and-versioning.md).

**Observability**

- [ ] Postgres-specific metrics exposed
- [ ] Slow query logging works
- [ ] Postgres exporter scraped by Prometheus
- [ ] Postgres-specific dashboard panel in `platform-persistence.json`
- [ ] Connection pool metrics visible in Grafana

**Operations**

- [ ] All runbooks in Section 5.15 written
- [ ] Quarterly restore drill scheduled
- [ ] Restore drill executed at least once successfully

**Documentation**

- [ ] ADRs 0024–0028 written and Accepted
- [ ] `packages/adapters/persistence-postgres/README.md` covers setup, schema authoring, migrations, troubleshooting
- [ ] Type mapping table documented in the contract document for SchemaDdlPort

**Verification**

- [ ] All 20 verification steps in Section 8 pass
- [ ] Performance baseline established: simple findById on a 100k-row table in p95 < 5ms

---

## 10. Anti-Patterns to Refuse

- **Importing `pg` or `drizzle-orm` outside this adapter.** Architecture violation. Caught by dependency-cruiser.
- **String-concatenating values into SQL.** Ever. All values are parameters. The translator enforces this; raw SQL escape hatches use template literal tags that auto-parameterize.
- **Skipping the down migration "because we'll never roll back."** You will. Eventually. Write the down.
- **Running DDL in production without a backup snapshot first.** The CI gate enforces this; don't bypass.
- **Editing an applied migration.** Migrations are immutable history. Fix-forward with a new migration.
- **Using Postgres-only features in service code.** Even if the customer is Postgres-only today. Capabilities, not assumptions.
- **Letting connection pool exhaustion be a runtime surprise.** Pool size is sized, alerted on, dashboarded.
- **Using the application user for migrations.** Migrations may need DDL privileges the app user shouldn't have. Two users: `platform_app` (DML only) and `platform_migrate` (DDL).
- **Disabling statement timeout for "long" queries.** Long queries belong in batch jobs with their own connection and timeout, not on the request path.
- **Skipping the conformance suite to ship faster.** The whole point is dialect parity. Skipping the suite means MSSQL and Mongo will diverge in subtle ways no one notices until production.

---

## 11. Open Questions for Confirmation Before Starting

1. **Postgres major version: 16 (stable) vs 17 (newest, if available in your Docker images and tooling).** Recommendation: 16 unless you have a reason for 17. Easier to find compatible tools, more stable.

2. **PgBouncer or skip it for now?** Skipping simplifies setup; for solo-dev volume it's not strictly needed. Recommendation: install it from day one. Connection pool exhaustion is one of the most painful production surprises; getting PgBouncer working when stable is much easier than under fire.

3. **Two database users (app and migrate) — confirmed?** Or is "one user, full privileges, migrations gated by CI" acceptable for the simpler initial setup? Recommendation: two users from the start. Trivial to set up; eliminates a class of risk.

4. **Statement timeout default of 30s — OK?** This will catch some legitimate but slow operations (large reports, complex aggregations). Those should run as background jobs with their own settings. Recommendation: keep 30s default; design accordingly.

5. **pgvector now or later?** It's needed for the AI layer's RAG, but not for Phase 0 of platform feature work. Recommendation: install the extension now, implement the VectorStorePort adapter now while you're in the persistence layer. Cheaper than coming back later.

---

## 12. What Comes Next

With Objective 4 complete, the platform has a working PostgreSQL persistence layer with full observability, migrations, backups, and conformance. Service code can now persist things — though the actual platform schema (workspaces, users, etc.) doesn't exist yet; that lands when each domain module needs it.

**Objective 4a: MSSQL Adapter** comes next. Same conformance suite. Same ports. Different driver, different SQL dialect, different capabilities. The MSSQL adapter must reach feature parity with Postgres modulo genuinely impossible features (e.g., array columns, native JSON path operators).

**Objective 4b: MongoDB Adapter** follows. Document database paradigm; the abstractions defined in Objective 1.5 must hold up to the document model without leaking.

**Objective 4c: Cross-Database Conformance Verification** runs the full conformance suite against all three adapters in CI on every PR, catches any drift early.

**Objective 4d: Change Streams** implements `ChangeStreamPort` per database (Postgres logical replication, MSSQL CDC, Mongo change streams) — needed for the data management module's real-time features.

After the database family is complete, **Objective 5: Auth and User Directory** is built — and notably, it's part of the data management module, not separate, since the platform's auth IS the Supabase-clone auth feature.

---

_This document is the contract. Every checkbox in Section 9 must be true before moving on._
