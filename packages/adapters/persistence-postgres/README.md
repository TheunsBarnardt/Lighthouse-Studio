# @platform/adapter-persistence-postgres

PostgreSQL adapter implementing the platform's persistence ports.

Implements: `RepositoryPort`, `UnitOfWorkPort`, `QueryPort`, `SchemaIntrospectionPort`, `SchemaDdlPort`, `SchemaMigrationPort`, `FullTextSearchPort`, `VectorStorePort`.

---

## Prerequisites

- Postgres 17 via `pgvector/pgvector:pg17` (includes the `vector` extension)
- PgBouncer 1.23+ in transaction mode
- Extensions: `pgcrypto`, `pg_trgm`, `uuid-ossp`, `vector`

Bring up the local stack:

```bash
docker compose -f infra/docker/local.yml up -d
```

---

## Environment variables

| Variable              | Required | Description                                     |
| --------------------- | -------- | ----------------------------------------------- |
| `POSTGRES_URL`        | Yes      | App connection via PgBouncer (`platform_app`)   |
| `POSTGRES_DIRECT_URL` | Yes      | Direct Postgres connection (`platform_migrate`) |
| `POSTGRES_POOL_SIZE`  | No       | Application pool size (default: 10)             |

Local defaults (`.env.local`):

```
POSTGRES_URL=postgres://platform_app:platform_app@localhost:5433/platform_dev
POSTGRES_DIRECT_URL=postgres://platform_migrate:platform_migrate@localhost:5432/platform_dev
```

---

## Migrations

```bash
# Apply all pending migrations
pnpm db:migrate

# Show status
pnpm db:migrate:status

# Create a new migration
pnpm db:migrate:create <descriptive-name>

# Roll back the last migration (dev only)
pnpm db:migrate:down
```

Migrations live in `migrations/`. Every up migration has a `.down.sql` counterpart. Applied migrations are checksummed — editing them after application will cause the runner to abort.

To regenerate migrations from schema changes:

```bash
pnpm db:generate
```

Review the generated SQL before committing.

---

## Schema authoring

All entity tables spread `standardColumns` and (for workspace-scoped entities) `tenantColumns` from `src/schema/_common.ts`:

```typescript
import { pgTable, varchar, jsonb, index } from 'drizzle-orm/pg-core';
import { standardColumns, tenantColumns } from '@platform/adapter-persistence-postgres';

export const projects = pgTable(
  'projects',
  {
    ...standardColumns,
    ...tenantColumns,
    name: varchar('name', { length: 255 }).notNull(),
    metadata: jsonb('metadata').notNull().default({}),
  },
  (t) => ({
    workspaceIdx: index('projects_workspace_idx').on(t.workspaceId),
  }),
);
```

Run `pnpm db:generate` after schema changes to produce the migration SQL.

---

## Using the repository adapter

```typescript
import { createConnectionPools, createPostgresRepository, createFieldMapper } from '@platform/adapter-persistence-postgres';

const pools = await createConnectionPools({
  applicationUrl: process.env.POSTGRES_URL,
  directUrl: process.env.POSTGRES_DIRECT_URL,
});

const mapper = createFieldMapper<User>({
  id: 'id',
  name: 'name',
  email: 'email',
});

const userRepo = createPostgresRepository<User>(pools.pool, { schema: 'public', table: 'users', columns: ['id', 'name', 'email', '_version', '_archived_at'] }, mapper);

const user = await userRepo.findById(userId);
```

---

## Architecture notes

- **Drizzle** is used for schema definition and migration generation only. It does not leak through the port boundary.
- The application pool (`pool`) routes through PgBouncer in transaction mode.
- The direct pool (`directPool`) bypasses PgBouncer — use it for migrations, DDL, `LISTEN/NOTIFY`.
- All queries are parameterised. String concatenation of values into SQL is forbidden.
- `hardDelete` logs at `warn` level on every invocation.

---

## Conformance tests

The conformance suite requires a live Postgres instance:

```bash
POSTGRES_DIRECT_URL="postgres://..." pnpm test
```

Without `POSTGRES_DIRECT_URL`, the conformance tests are skipped but the unit tests (filter translator, DDL adapter) still run.
