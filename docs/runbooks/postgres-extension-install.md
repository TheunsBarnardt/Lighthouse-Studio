# Postgres — Installing Extensions Safely

How to add new Postgres extensions to the platform database.

---

## Extensions currently required

| Extension   | Purpose                                 | Installed by                   |
| ----------- | --------------------------------------- | ------------------------------ |
| `pgcrypto`  | Cryptographic functions (UUID, hashing) | `init/01_extensions_users.sql` |
| `pg_trgm`   | Trigram similarity / fuzzy text search  | `init/01_extensions_users.sql` |
| `uuid-ossp` | `gen_random_uuid()` function            | `init/01_extensions_users.sql` |
| `vector`    | pgvector: ANN search (RAG, embeddings)  | `init/01_extensions_users.sql` |
| `plpgsql`   | PL/pgSQL language (built-in)            | Postgres default               |

---

## Installing a new extension

### Step 1: Verify the extension exists in the Postgres image

The platform uses `pgvector/pgvector:pg17`, which includes pgvector. Other extensions need to be either:

- Pre-installed in the Docker image (switch to `pgvector/pgvector:pg17` or a custom image).
- Installed via system packages in a custom Dockerfile derived from the base image.

**Check what's available:**

```sql
SELECT * FROM pg_available_extensions ORDER BY name;
```

### Step 2: Add to the init script

Add the `CREATE EXTENSION IF NOT EXISTS` call to `infra/docker/init/01_extensions_users.sql`:

```sql
CREATE EXTENSION IF NOT EXISTS <extension_name>;
```

This runs on first container start. **It does not run on subsequent starts** — the init directory is only processed when the data volume is empty.

### Step 3: For existing databases — apply via a migration

Create a new migration:

```bash
pnpm --filter @platform/adapter-persistence-postgres db:migrate:create add_<extension>_extension
```

Add to the migration SQL:

```sql
-- Migration NNNN: add <extension> extension
CREATE EXTENSION IF NOT EXISTS <extension_name>;
```

Down migration:

```sql
-- Down: only drop if no tables depend on it
DROP EXTENSION IF EXISTS <extension_name>;
```

### Step 4: Update capability detection

If the extension enables a new `SchemaFeature`, update `PostgresSchemaIntrospectionAdapter.warmCapabilityCache()` in `schema-introspection.adapter.ts` to detect it:

```typescript
this.extensionCache.set('<extension_name>', true);
```

And update `supports()` to return `true` for the relevant feature when the extension is present.

---

## PostGIS (spatial indexes)

PostGIS requires a custom Docker image. Update `infra/docker/local.yml` to use:

```yaml
image: postgis/postgis:17-3.5-alpine
```

Then add to the init script:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
```

The `spatial_indexes` capability will be reported as `true` once PostGIS is detected by `warmCapabilityCache()`.

---

## pg_stat_statements (query performance)

Useful for analysing slow queries. Requires a server restart to load:

```conf
# postgresql.conf
shared_preload_libraries = 'pg_stat_statements'
```

Add to the Compose postgres command:

```yaml
command: >
  postgres
  -c shared_preload_libraries=pg_stat_statements
  ...
```

Then create the extension:

```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

---

## Safe extension removal

Before dropping an extension, verify nothing depends on it:

```sql
-- Check for dependent objects
SELECT * FROM pg_depend
WHERE refobjid = (SELECT oid FROM pg_extension WHERE extname = '<extension>')
  AND deptype != 'e';
```

If there are dependents, you cannot drop the extension without first removing those objects.
