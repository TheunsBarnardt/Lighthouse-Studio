# Objective 4b: Database Adapter — MongoDB

**Status:** Ready for development
**Prerequisites:** Objectives 1, 1.5, 2, 3, 4 (Postgres), 4a (MSSQL) complete
**Blocks:** Cross-database conformance (4c), change streams (4d), and any feature that targets MongoDB customers
**Companion:** Final database in the 4-family

---

## 1. Purpose

Implement the persistence ports against MongoDB, achieving conformance with the relational adapters where the document paradigm allows, and **honestly declaring incapability** where it doesn't. This is the adapter that stress-tests the abstractions defined in Objective 1.5.

If an abstraction can't be implemented for Mongo without leaking, that's a signal to amend the abstraction in Objective 1.5 — not to fudge the implementation. By the end of this objective, the platform either runs cleanly on three paradigm-different databases, or we will have learned exactly which abstractions need refinement and amended them deliberately.

This objective produces no user-visible features. It produces a working, tested, observable MongoDB persistence layer with capability flags that accurately describe what works and what doesn't.

**Why MongoDB last:**

- Postgres established the conformance baseline
- MSSQL proved the abstraction works across two relational databases
- Mongo is a document database — different paradigm; if the abstraction holds here, it's solid
- Any abstraction failures discovered against Mongo can be fed back into the relational adapters (e.g., relaxing assumptions that turned out to be Postgres-specific)
- Mongo is the smallest of the three audiences for the platform; investing here last matches the priority

---

## 2. Scope

### In Scope

- MongoDB driver selection and configuration
- "Schema" approach for a schema-less database (validators, indexes, conventions)
- Migration system: a different beast from relational migrations — manages validators, indexes, data backfills
- All persistence port implementations: `RepositoryPort`, `UnitOfWorkPort`, `QueryPort`, `SchemaIntrospectionPort`, `SchemaDdlPort`, `SchemaMigrationPort`
- Filter AST → Mongo query translation
- Connection management: pooling, retries, replica set support
- Query observability
- Type mapping: platform's normalized type system ↔ BSON types
- Conformance test suite execution
- Capability declarations honest about MongoDB's relational limitations
- Backup and restore procedures specific to MongoDB
- Operational runbooks
- ADRs

### Explicit Capabilities NOT Supported (Honest Declarations)

- **Foreign keys**: Mongo has no foreign key constraints. Application-layer enforcement only. Capability flag `foreign_keys: false`.
- **Multi-document transactions**: Mongo supports them on replica sets and sharded clusters, but with constraints (60s default timeout, no DDL inside transactions). The adapter supports them with documented limitations.
- **Native joins**: Mongo's `$lookup` exists but is not a true join. The platform does not use it via the abstraction; cross-collection queries are application-layer (multiple repository calls) or via the QueryPort with explicit per-database support.
- **Cross-collection transactions across shards**: Supported but with operational complexity. Documented; default to single-shard.
- **DDL inside transactions**: Mongo doesn't allow it. Migration system handles this with explicit non-transactional steps.
- **Check constraints**: Replaced by JSON Schema validators. Different but adequate.
- **Computed columns**: Replaced by application-layer computed fields. Documented.

### Out of Scope (Belongs to Later Objectives)

- The actual platform schema
- Mongo change streams implementation (Objective 4d)
- Aggregation framework as a first-class platform feature (defer; expose via QueryPort raw access only)
- Atlas-specific features (Atlas Search, Atlas Vector Search) — added later as separate adapters
- Self-hosted MongoDB cluster setup (covered in operational runbook, not detailed implementation)

---

## 3. Locked Decisions

| Decision            | Choice                                                                     | Rationale                                                                                                                   |
| ------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| MongoDB version     | 7.0+ (latest stable)                                                       | Modern features (queryable encryption, time-series, etc.); long support                                                     |
| Minimum supported   | MongoDB 6.0                                                                | Last major with continuing support; transactions stable                                                                     |
| Driver              | Official `mongodb` Node.js driver                                          | Reference; first-class TypeScript types                                                                                     |
| Connection topology | Replica set required (even single-node "replica set")                      | Transactions require it; production deployments are always RS                                                               |
| Schema approach     | JSON Schema validators on every collection                                 | Mongo's native schema-validation feature; declarative                                                                       |
| Schema/query layer  | None — direct driver use inside the adapter                                | Drizzle/Mongoose add complexity without clear benefit at the adapter layer; the platform's port abstraction is what matters |
| Migration tool      | Custom; tracked in `__platform_migrations` collection                      | No standard tool fits; the bespoke tool is small                                                                            |
| Migration storage   | TypeScript files (not JS) executed against the driver; checksummed         | Mongo migrations are imperative, not declarative                                                                            |
| ID strategy         | UUID v7 stored as BSON Binary subtype 4                                    | Consistent with Postgres/MSSQL; sortable; not Mongo's default ObjectId                                                      |
| Optimistic locking  | `_version` integer field, incremented on update                            | Same pattern as Postgres                                                                                                    |
| Soft delete         | `_archived_at` Date field                                                  | Same pattern as relational adapters                                                                                         |
| Tenancy field       | `workspace_id` UUID Binary on every workspace-scoped collection with index | Same pattern                                                                                                                |
| Time zones          | All dates stored as BSON Date (UTC)                                        | BSON Date is millisecond-precision UTC; sufficient                                                                          |
| Naming convention   | `snake_case` for fields                                                    | Mongo idiom is camelCase, but consistency across adapters wins                                                              |
| Statement timeout   | 30 seconds via `maxTimeMS` per query                                       | Consistent with relational adapters                                                                                         |
| Read/write concern  | `majority` for both in production                                          | Durability and consistency over latency                                                                                     |
| Connection options  | Retry writes enabled, retry reads enabled                                  | Default in modern driver; explicit in config                                                                                |
| TLS                 | Required in production                                                     | `tls: true, tlsCAFile: <path>`                                                                                              |

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
                │  (same ports as Postgres/MSSQL)           │
                └──────────────────┬───────────────────────┘
                                   │
                                   ▼
                ┌──────────────────────────────────────────┐
                │  packages/adapters/persistence-mongo/    │
                │                                           │
                │  ┌────────────────────────────────────┐  │
                │  │  Direct mongodb driver use         │  │
                │  │  (no ORM layer; just typed wrappers)│  │
                │  └─────────────────┬──────────────────┘  │
                │                                           │
                │  Components:                              │
                │  - Connection / pool management           │
                │  - Filter AST → Mongo query translator    │
                │  - JSON Schema validator generation       │
                │  - Migration runner (collection-aware)    │
                │  - Schema introspection (samples + valid.) │
                │  - Mapper: platform types ↔ BSON          │
                └────────────────────┬──────────────────────┘
                                     │
                                     ▼
                            ┌─────────────────┐
                            │   MongoDB 7.0   │
                            │  (replica set)  │
                            └─────────────────┘
```

Notably **no Drizzle, no Mongoose** at the adapter layer. The driver's TypeScript types are sufficient; the platform's port interfaces sit on top, providing the type-safe contract. Mongoose adds object modeling but its conventions don't align with the platform's port abstraction; using it would introduce a translation layer between Mongoose and the port that's just as much code as the direct driver.

---

## 5. The Hard Parts (Read This Before Coding)

These are the places where the document paradigm forces design decisions that don't exist in the relational adapters.

**5.1 The "schema" question**

MongoDB has no schema by default. Adding documents with arbitrary fields is allowed. The platform requires schemas — they're how the data management module's UI is generated, how validation works, how migrations are tracked.

**Decision:** every collection used by the platform has a JSON Schema validator attached at creation time. Validators are stored alongside collections; introspection reads them back. Documents that don't match the schema are rejected at write time by Mongo. This makes Mongo behave like a typed database for our purposes, while still allowing the customer's other data (outside the platform's collections) to remain schema-flexible.

**5.2 No foreign keys**

Mongo has no FK constraint. The platform's port interface doesn't expose FK enforcement to service code anyway (foreign keys are declared at the schema level, not enforced through repository operations). For relational adapters, the database enforces FKs. For Mongo, the application layer must enforce referential integrity.

**Decision:** the abstraction stays consistent — service code calls `create` and `update` and trusts that "if this entity says it references X, then X exists and is valid." On Postgres/MSSQL, the database enforces. On Mongo, the service layer enforces explicitly via reads-then-writes inside transactions or via document-embedding patterns.

This means the data management module's schema designer must, when targeting Mongo, explain to the user that "FK" relationships are advisory and enforced at write time by the platform, not at the database level. Capability flag `foreign_keys: false` makes this explicit.

**5.3 Multi-document transactions**

Mongo transactions exist on replica sets but with operational caveats:

- 60-second default timeout (configurable up to 24 hours, but long transactions hold locks)
- DDL operations (createCollection, createIndex) cannot run inside transactions
- Performance overhead is real

The `UnitOfWorkPort` is implementable on Mongo, but the adapter documents the constraints and the migration system avoids transactions for DDL.

**5.4 Aggregation vs. queries**

Mongo's aggregation pipeline is more powerful than relational `SELECT`. The platform's `RepositoryPort` doesn't expose aggregation — that's deliberate. Aggregations belong to `QueryPort` and are written explicitly per database.

For Mongo customers, the data management module's "query console" exposes the aggregation pipeline; for relational customers, it exposes SQL. Both go through the QueryPort with adapter-specific raw access.

**5.5 Indexes are imperative**

Postgres and MSSQL: indexes are part of schema; declared in DDL; created automatically by migrations. Mongo: indexes are imperative (`createIndex(...)`); they're metadata on the collection. The migration system manages indexes the same way it manages validators — every migration that adds an index is explicit.

**5.6 Type fidelity**

BSON types include things SQL doesn't have natively: ObjectId, Decimal128, Long, Date with millisecond precision, regex, JavaScript code. The platform doesn't expose ObjectId, Long, or JavaScript code through its abstractions. Decimal128 maps to platform `decimal(p,s)`. Dates map to `timestamp_tz`.

The mapper is bidirectional and lossy in known directions:

- Platform `string(n)` → Mongo string (length validation done by validator, not enforced by Mongo's type)
- Platform `integer` → Mongo Int32 (or Long if value exceeds Int32 range; the mapper does the right thing)
- Platform `bigint` → Mongo Long
- Platform `decimal(p,s)` → Mongo Decimal128
- Platform `uuid` → Mongo BSON Binary subtype 4
- Platform `binary` → Mongo BSON Binary subtype 0
- Platform `json` → Mongo nested document or array (native; this is Mongo's strength)
- Platform `array<T>` → Mongo native array (this is Mongo's strength too)

**5.7 The `_id` field**

Mongo collections have a mandatory `_id` field, ObjectId by default. The platform overrides this: every collection's `_id` is a UUID v7 stored as BSON Binary subtype 4. The mapper translates between the platform's `id: string` and Mongo's `_id: Binary`.

**5.8 No unique constraints across collections, no cross-collection joins via SQL semantics**

Service-layer code that needs to enforce "this name is unique within a workspace" needs an indexed unique constraint at the collection level, scoped by workspace_id. The platform's port abstraction supports this via index declarations in the schema migration system.

Service-layer code that needs to query across collections does so via multiple repository calls, not a join. This is the same constraint the relational adapters use anyway (the platform doesn't expose joins through `RepositoryPort`).

**5.9 No `LIKE`-based pagination semantics out of the box**

Pagination by offset is supported (`skip`/`limit`) but slow on large collections. The platform's port already supports cursor-based pagination via the `Page` type's optional cursor; the Mongo adapter prefers cursor pagination (using `_id` since it's UUID v7 and time-ordered).

**5.10 Replica set requirement even in dev**

Even single-node Mongo deployments must be initialized as a replica set to support transactions. The dev Compose stack runs Mongo with `--replSet rs0` and an init script that runs `rs.initiate()`. This is a small operational complexity the adapter documentation explains.

---

## 6. Component Specifications

### 6.1 Driver and Pool Configuration

**`packages/adapters/persistence-mongo/src/connection.ts`:**

- Single `MongoClient` per process from the official `mongodb` driver
- Pool sizing: `maxPoolSize` matches `DB_POOL_SIZE` env var; `minPoolSize: 1`
- Read concern: `majority`
- Write concern: `{ w: 'majority', j: true }`
- `serverSelectionTimeoutMS: 15_000`
- `socketTimeoutMS: 60_000`
- TLS: required in production
- Health check: `db.command({ ping: 1 })`
- Pool metrics emitted via MetricsPort (`platform_mongo_pool_*`)
- Connection events logged (server selection failures, replica set changes)

**Configuration sources:**

- `MONGO_URL` (full connection URL, including replica set members and options)
- `MONGO_DATABASE` (database name)
- `MONGO_TLS_CA` (path to CA cert for self-hosted)

For Mongo Atlas-hosted customers, the connection URL includes `mongodb+srv://` and Atlas credentials; for self-hosted, it's `mongodb://host1,host2,host3/?replicaSet=rs0`.

### 6.2 Schema Approach

Each collection used by the platform has:

1. A **JSON Schema validator** describing required fields, types, and constraints
2. A set of **indexes** (compound, single-field, text where applicable, geospatial where applicable)
3. A **standard column set** (id, version, archived_at, created_at, updated_at, created_by, updated_by, and workspace_id where applicable)

Schema files live in `packages/adapters/persistence-mongo/src/schema/`:

```typescript
// schema/_common.ts
export const standardSchemaProps = {
  _id: { bsonType: 'binData' }, // UUID v7 in Binary
  _version: { bsonType: 'int', minimum: 1 },
  _archived_at: { bsonType: ['date', 'null'] },
  _created_at: { bsonType: 'date' },
  _updated_at: { bsonType: 'date' },
  _created_by: { bsonType: ['binData', 'null'] },
  _updated_by: { bsonType: ['binData', 'null'] },
};

export const tenantSchemaProps = {
  workspace_id: { bsonType: 'binData' },
};
```

Schema definitions are TypeScript files compiled into validator JSON Schema documents at migration time. The migration runner reads the schema definitions and applies them via `db.command({ collMod: <coll>, validator: ... })`.

### 6.3 Repository Adapter

```typescript
// packages/adapters/persistence-mongo/src/repository.adapter.ts

export function createMongoRepository<TEntity, TId = string>(db: Db, collectionName: string, mapper: EntityMapper<TEntity>): RepositoryPort<TEntity, TId> {
  const coll = db.collection(collectionName);

  return {
    findById: async (id) => {
      const doc = await coll.findOne({ _id: uuidToBinary(id), _archived_at: null });
      return ok(doc ? mapper.fromDbRow(doc) : null);
    },

    create: async (entity) => {
      const doc = mapper.toDbRow(entity);
      doc._created_at = doc._updated_at = new Date();
      doc._version = 1;
      try {
        await coll.insertOne(doc);
        return ok(mapper.fromDbRow(doc));
      } catch (err) {
        if (isDuplicateKey(err)) return err(new ConflictError(/*...*/));
        return err(/*...*/);
      }
    },

    update: async (id, changes, opts) => {
      const filter: Record<string, unknown> = {
        _id: uuidToBinary(id),
        _archived_at: null,
      };
      if (opts?.expectedVersion !== undefined) {
        filter._version = opts.expectedVersion;
      }
      const update = {
        $set: {
          ...mapper.partialToDbRow(changes),
          _updated_at: new Date(),
        },
        $inc: { _version: 1 },
      };
      const result = await coll.findOneAndUpdate(filter, update, { returnDocument: 'after' });
      if (!result) {
        // Either entity not found, or version mismatch
        const existing = await coll.findOne({ _id: uuidToBinary(id) });
        if (!existing) return err(new EntityNotFoundError(/*...*/));
        return err(new ConflictError('Optimistic lock failure'));
      }
      return ok(mapper.fromDbRow(result));
    },

    archive: async (id) => {
      const result = await coll.updateOne({ _id: uuidToBinary(id), _archived_at: null }, { $set: { _archived_at: new Date() }, $inc: { _version: 1 } });
      if (result.matchedCount === 0) return err(new EntityNotFoundError(/*...*/));
      return ok(undefined);
    },

    // ... and so on
  };
}
```

**All operations:**

- Open spans via TracerPort
- Record histogram metrics
- Filter on `_archived_at: null` by default
- Translate Mongo errors to typed errors
- Use `maxTimeMS: 30_000` per query

### 6.4 Filter AST → Mongo Query Translator

This is structurally simpler than the SQL translators because Mongo queries ARE structured documents — no string SQL to generate. The translator walks the Filter AST and produces a Mongo filter document.

**`packages/adapters/persistence-mongo/src/filter-translator.ts`:**

```typescript
export function translateFilter<T>(filter: Filter<T>, schema: CollectionSchema): Result<Document, FilterError> {
  // Recursively translate the AST to a Mongo filter document.
}
```

**Translations:**

| Platform AST                     | Mongo                                                                                                     |
| -------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `{ _and: [a, b] }`               | `{ $and: [...] }`                                                                                         |
| `{ _or: [a, b] }`                | `{ $or: [...] }`                                                                                          |
| `{ _not: a }`                    | `{ $not: ... }` (with care; `$not` semantics differ for negation of complex expressions, may need `$nor`) |
| `{ field: { _eq: v } }`          | `{ field: v }`                                                                                            |
| `{ field: { _neq: v } }`         | `{ field: { $ne: v } }`                                                                                   |
| `{ field: { _in: [a,b] } }`      | `{ field: { $in: [a,b] } }`                                                                               |
| `{ field: { _nin: [a,b] } }`     | `{ field: { $nin: [a,b] } }`                                                                              |
| `{ field: { _lt: v } }`          | `{ field: { $lt: v } }`                                                                                   |
| `{ field: { _lte: v } }`         | `{ field: { $lte: v } }`                                                                                  |
| `{ field: { _gt: v } }`          | `{ field: { $gt: v } }`                                                                                   |
| `{ field: { _gte: v } }`         | `{ field: { $gte: v } }`                                                                                  |
| `{ field: { _contains: v } }`    | `{ field: { $regex: escapeRegex(v) } }`                                                                   |
| `{ field: { _icontains: v } }`   | `{ field: { $regex: escapeRegex(v), $options: 'i' } }`                                                    |
| `{ field: { _starts_with: v } }` | `{ field: { $regex: '^' + escapeRegex(v) } }`                                                             |
| `{ field: { _ends_with: v } }`   | `{ field: { $regex: escapeRegex(v) + '$' } }`                                                             |
| `{ field: { _is_null: true } }`  | `{ field: null }` (matches null and missing)                                                              |
| `{ field: { _is_null: false } }` | `{ field: { $ne: null } }`                                                                                |

**Critical correctness:**

- **Field name validation.** The schema's known fields are checked; references to unknown fields are rejected.
- **Regex escaping.** `_contains`, `_icontains`, `_starts_with`, `_ends_with` use `$regex`. Values must be regex-escaped to prevent regex injection (a value like `"abc.*"` should match the literal string, not regex `abc.*`).
- **UUID translation.** Filter values for UUID fields are translated from strings to BSON Binary subtype 4 before being inserted into the Mongo filter document.
- **Date translation.** Filter values for date fields translated from ISO strings to BSON Date.

**Property tests** run the same 10,000-random-filter battery; the assertions are:

- Translation always produces a valid Mongo filter document (validated against driver's expectations)
- Regex values are properly escaped (no metacharacters survive into the regex unless the operator is `_regex`, which doesn't exist in the platform AST)
- Filter and its negation produce complementary result sets on a known dataset

### 6.5 Unit of Work

```typescript
export function createMongoUnitOfWork(client: MongoClient, db: Db): UnitOfWorkPort {
  return {
    transaction: async (fn) => {
      const session = client.startSession();
      try {
        let result: Result<unknown, unknown>;
        await session.withTransaction(
          async () => {
            const ctx = createContext(db, session);
            result = await fn(ctx);
            if (result.isErr()) {
              throw new TransactionAbortError(result.error);
            }
          },
          {
            readConcern: { level: 'majority' },
            writeConcern: { w: 'majority', j: true },
            readPreference: 'primary',
            maxCommitTimeMS: 60_000,
          },
        );
        return result!;
      } catch (err) {
        if (err instanceof TransactionAbortError) return err.cause as Result<unknown, unknown>;
        return err(/*...*/);
      } finally {
        await session.endSession();
      }
    },
  };
}
```

**Critical behaviors:**

- Transactions span up to 60 seconds; longer is logged at warn
- DDL inside transactions is rejected (the unit of work context's repository methods only do DML)
- Retryable errors (TransientTransactionError) are retried by the driver automatically
- Deadlocks (rare in Mongo, but possible with locks) trigger retry up to 3 times

### 6.6 Schema Introspection

Mongo has no schema metadata in the traditional sense, but the platform requires every collection it manages to have a JSON Schema validator. Introspection reads:

- `listCollections()` from the driver — returns collections + their validators
- For each collection, the validator JSON Schema is the structure
- Indexes are read via `coll.listIndexes()`

**`describeTable(schema, table)`:**

For platform-managed collections (those with validators), this returns a normalized `TableDefinition` directly translatable from the validator.

For unmanaged collections (existing customer data without validators), the introspection adapter performs a **schema sampling** pass:

- Read 1000 random documents
- Infer types per field (with confidence scores)
- Return a best-effort `TableDefinition` with a warning that the collection has no validator
- The data management UI offers to "create a validator from this sample" as a one-click upgrade path

**Type mapping (BSON → normalized):**

| BSON                   | Normalized                                                           |
| ---------------------- | -------------------------------------------------------------------- |
| `string`               | `text` (no length without validator) or `string(n)` from validator   |
| `int` (Int32)          | `integer`                                                            |
| `long` (Int64)         | `bigint`                                                             |
| `decimal` (Decimal128) | `decimal(p,s)` from validator, or `decimal(38,10)` default           |
| `bool`                 | `boolean`                                                            |
| `date`                 | `timestamp_tz`                                                       |
| `binData` (subtype 4)  | `uuid`                                                               |
| `binData` (other)      | `binary`                                                             |
| `objectId`             | `text` (no normalized type for ObjectId; returned as-is in metadata) |
| `array`                | `array<T>` (T inferred or from validator)                            |
| `object`               | `json`                                                               |
| `null`                 | nullable variant of the inferred type                                |

**Capability declarations:**

```typescript
supports(feature: SchemaFeature): boolean {
  switch (feature) {
    case 'schemas': return false;            // no schemas in Mongo (databases are the unit)
    case 'foreign_keys': return false;        // no FKs in Mongo
    case 'check_constraints': return true;   // via JSON Schema validators
    case 'json_columns': return true;         // native
    case 'array_columns': return true;        // native
    case 'partial_indexes': return true;      // partialFilterExpression
    case 'unique_indexes': return true;
    case 'spatial_indexes': return true;      // 2dsphere, 2d
    case 'transactions': return true;         // replica set required (verified at startup)
    case 'change_streams': return true;       // native
    default: return false;
  }
}
```

### 6.7 Schema DDL Adapter

For Mongo, "DDL" means: createCollection with a validator, modify validator on existing collection, drop collection, manage indexes.

**`createTable(definition)`:**

Translates the normalized `TableDefinition` into:

- `db.createCollection(name, { validator: <jsonSchema> })`
- For each index: `coll.createIndex(...)`
- For unique constraints: `createIndex({ ... }, { unique: true })`

**`alterTable(from, to)`:**

Translates differences into Mongo operations:

- New columns: typically no-op for Mongo (new fields can be written without DDL); validator updated to include them
- Removed columns: validator updated to remove (existing documents may still have the field; the migration script can `$unset` it as a data migration)
- Type changes: validator updated; existing documents may need data migration if types changed in incompatible ways
- Index changes: createIndex and dropIndex calls
- Unique constraint changes: index changes

**`validate(definition)`:**

- Reserved field names (Mongo: `_id` is mandatory; `__` prefixed names are conventions but not enforced)
- Validator size limits (Mongo: 16 MB per BSON document, validators are per-collection, much smaller in practice)
- All field types are expressible in BSON

### 6.8 Migration System

Mongo migrations are imperative and very different from SQL migrations. The platform's port abstraction is the same (`SchemaMigrationPort.apply`), but the implementation is a sequence of TypeScript functions, each one doing whatever it needs:

**`packages/adapters/persistence-mongo/migrations/`:**

```
migrations/
├── 0000_initial.ts
├── 0001_create_workspaces.ts
├── 0002_add_workspace_validator.ts
├── 0003_backfill_workspace_metadata.ts
├── ...
```

Each migration is a TypeScript file:

```typescript
// migrations/0001_create_workspaces.ts
import type { Db } from 'mongodb';

export const id = 1;
export const description = 'Create workspaces collection';

export async function up(db: Db): Promise<void> {
  await db.createCollection('workspaces', {
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['_id', '_version', 'name', 'slug', '_created_at', '_updated_at'],
        properties: {
          _id: { bsonType: 'binData' },
          _version: { bsonType: 'int', minimum: 1 },
          _archived_at: { bsonType: ['date', 'null'] },
          name: { bsonType: 'string', maxLength: 255 },
          slug: { bsonType: 'string', maxLength: 100 },
          _created_at: { bsonType: 'date' },
          _updated_at: { bsonType: 'date' },
          _created_by: { bsonType: ['binData', 'null'] },
          _updated_by: { bsonType: ['binData', 'null'] },
        },
      },
    },
  });

  await db.collection('workspaces').createIndex({ slug: 1 }, { unique: true });
  await db.collection('workspaces').createIndex({ _archived_at: 1 });
}

export async function down(db: Db): Promise<void> {
  await db.dropCollection('workspaces');
}
```

**Migration runner:**

`packages/adapters/persistence-mongo/src/migrate.ts`:

- Tracks applied migrations in `__platform_migrations` collection
- Each migration is applied with `try/catch` and full audit
- Checksums the migration file content; refuses to re-apply if changed
- DDL-touching migrations (createCollection, createIndex) run outside transactions; data-touching migrations run inside transactions where appropriate

**Discipline:**

- Every up has a down
- Every migration tested locally before merging
- Idempotency: each migration safe to re-run if previous run partially succeeded

### 6.9 Search Adapter (FullTextSearchPort)

Mongo's text search is comparable to Postgres `tsvector`:

- Text indexes on collections enable `$text: { $search: 'query' }` searches
- Multilingual support via stemming
- Score returned via `$meta: 'textScore'`

The Mongo adapter implements `FullTextSearchPort` using text indexes. The schema migration that registers a collection for FTS adds the text index.

For more advanced search needs (faceting, fuzzy matching, autocomplete), customers on MongoDB Atlas can use Atlas Search; the platform exposes this via a separate `FullTextSearchPort` adapter (`search-atlas-search`) configured per env var. Self-hosted Mongo customers fall back to text indexes or external Elasticsearch.

### 6.10 Vector Store

Native MongoDB has no vector type through 7.x. Options:

- **Atlas Vector Search** — the obvious choice for Atlas-hosted customers; separate adapter `vectorstore-atlas-search`
- **External Qdrant** — for self-hosted Mongo customers
- **MongoDB 8.x native vectors** — when broadly available, an `vectorstore-mongo` adapter will be added

The Mongo persistence adapter does NOT implement `VectorStorePort`. The customer chooses externally via env config.

### 6.11 Observability of the Adapter

Mongo-specific metrics:

- `platform_mongo_pool_active_connections`
- `platform_mongo_pool_available_connections`
- `platform_mongo_pool_pending_acquires`
- `platform_mongo_pool_wait_queue_size`
- `platform_mongo_query_duration_seconds{operation}`
- `platform_mongo_slow_queries_total`
- `platform_mongo_validation_failures_total` (writes rejected by JSON Schema validator)
- `platform_mongo_replica_set_primary_changes_total` (counter for failover events)
- `platform_mongo_session_count` (for transaction sessions)

A MongoDB exporter scraped by Prometheus exposes server-side metrics (lock waits, oplog window, replica state).

### 6.12 Backups

**Customer-managed Mongo (Atlas or self-hosted):**

The platform does NOT take backups; customer's existing strategy is presumed (Atlas continuous backup, ops-manager, mongodump, etc.). The platform documents what data needs to be in scope.

**Containerized Mongo (our dev/test):**

- Daily `mongodump` via sidecar container
- Output: `/backups/mongo/<env>/<date>/`
- Restic ingests, encrypts, ships to B2

**Restore procedure:**

- For customer-managed: customer's responsibility, with platform-provided verification queries
- For containerized: provision new replica set, `mongorestore`, run conformance suite

### 6.13 Operational Runbooks

New files in `docs/runbooks/`:

- `mongo-operations.md` — connecting, common diagnostics, replica set status, oplog tailing
- `mongo-replica-set-setup.md` — initialization, member addition, failover testing
- `mongo-migration-stuck.md` — what to do when a migration hangs or partially completed
- `mongo-data-migration-patterns.md` — backfill strategies, batched updates, online schema evolution
- `mongo-restore.md` — full restore (containerized) and verification (customer-managed)
- `mongo-tuning.md` — pool sizing, write concern, read preference, oplog sizing
- `mongo-deployment-customer.md` — guide for customers deploying against their own Mongo

---

## 7. Implementation Order

1. **Add MongoDB to the dev Compose stack** — Mongo 7 with `--replSet rs0`, init script that runs `rs.initiate()` on first boot. Expose on a non-default port to coexist with Postgres and MSSQL.

2. **Initialize the Mongo database** — verify replica set status, create `platform_app` and `platform_migrate` users with appropriate role grants (Mongo's role-based access).

3. **Write `packages/adapters/persistence-mongo/` skeleton:** package.json, tsconfig, README, src/index.ts.

4. **Write `connection.ts`** — MongoClient with proper options, TLS, replica set awareness, retries.

5. **Write `_common.ts`** — standard schema property fragments and the BSON ↔ platform mapper helpers.

6. **Write the entity mapper helpers** — UUID v7 ↔ BSON Binary subtype 4, dates, decimals.

7. **Write `repository.adapter.ts`** — generic repository factory using direct driver methods.

8. **Write `filter-translator.ts`** — Filter AST → Mongo query document, with property tests and regex escaping.

9. **Write `unit-of-work.adapter.ts`** — session-based transactions with retry semantics.

10. **Write `query.adapter.ts`** — for typed read-only queries (aggregation pipelines exposed here).

11. **Write `schema-introspection.adapter.ts`** — reads validators for managed collections; samples for unmanaged ones.

12. **Write `schema-ddl.adapter.ts`** — translates normalized definitions to validator + index operations.

13. **Write `migrate.ts`** — TypeScript-based migration runner with checksums, journal collection, audit logs.

14. **Write `search.adapter.ts`** — text-index-based FullTextSearchPort.

15. **Run the full conformance test suite** from `packages/ports/persistence/conformance/`.

16. **Investigate and document every conformance failure.** This is the moment of truth — the document paradigm vs. the abstractions designed against relational mental models. Each failure is one of:

    - Adapter bug (fix it)
    - Capability mismatch (declare it; suite respects flags)
    - Abstraction leak (push back; possibly amend Objective 1.5)

17. **Add Mongo-specific observability.**

18. **Wire into CI** — adapter tests run in matrix alongside Postgres and MSSQL.

19. **Set up containerized Mongo backups.**

20. **Write all runbooks.**

21. **Write ADRs.**

22. **Run a restore drill.**

23. **Verify Definition of Done.**

---

## 8. ADRs to Write

- **ADR-0036: Direct mongodb Driver, No ORM Layer** — why no Mongoose, what we get from direct use, how we manage complexity
- **ADR-0037: JSON Schema Validators as the Schema** — making Mongo behave like a typed database for our managed collections
- **ADR-0038: UUID v7 Stored as BSON Binary Subtype 4** — consistency with relational adapters, why not ObjectId
- **ADR-0039: Replica Set Required Even in Dev** — why; how the dev Compose handles it
- **ADR-0040: No Foreign Keys, Application-Layer Referential Integrity** — what the data management UI surfaces to users
- **ADR-0041: Aggregation Framework via QueryPort, Not RepositoryPort** — what stays in the abstraction, what's per-database

---

## 9. Verification Steps

1. **Mongo replica set is up.** `rs.status()` shows healthy primary; reachable from platform containers.

2. **Connection pool works under load.** 100 concurrent queries served; metrics behave correctly.

3. **Conformance test suite passes.** Every test in `packages/ports/persistence/conformance/` either passes or skips based on capability flags.

   - `foreign_keys: false` skips FK-specific tests
   - All other capabilities are honored

4. **Filter translator passes property tests.** 10,000 random filters; all produce valid Mongo filter documents; regex escaping is correct.

5. **Round-trip type test.** Create collection with every supported normalized type via the DDL adapter (validator). Introspect. Definition matches.

6. **Optimistic locking works.** Concurrent updates: one succeeds, one returns ConflictError.

7. **Soft delete works.** Same as relational adapters.

8. **Statement timeout fires.** Query with maxTimeMS. Adapter returns TimeoutError.

9. **Transactions work.** Multi-document operations succeed atomically; transient errors retried.

10. **Migration up/down works.** Apply, roll back, reapply. State consistent.

11. **Migration tampering detected.** Edit applied migration file; runner refuses with checksum error.

12. **Validator rejects bad documents.** Insert document missing required field. Mongo rejects with validation error; adapter translates to ValidationError.

13. **Schema sampling works** for unmanaged collections. Data management UI can see structure of arbitrary customer collections.

14. **UUID v7 round-trips.** Create entity with UUID v7. Retrieve. ID matches. Sort by `_id` matches sort by creation time.

15. **Text search works** when collection has text index.

16. **Backup runs successfully.** mongodump output is non-empty, restorable.

17. **Restore drill succeeds** (containerized).

18. **Observability flows.** Span, log, metric correlated.

19. **Slow query logging** captures queries > 1s.

20. **No driver leakage.** dependency-cruiser confirms no service code imports `mongodb`.

21. **Replica set failover handled.** Kill the primary. Driver picks new primary within seconds. Operations resume. No data loss.

22. **CI matrix.** Postgres + MSSQL + Mongo conformance suites run on every PR; all three must pass.

If all 22 pass, the objective is met.

---

## 10. Definition of Done

**Infrastructure**

- [ ] MongoDB 7 running in dev Compose stack as a replica set with persistent volume
- [ ] `platform_app` and `platform_migrate` users with appropriate role grants
- [ ] Daily mongodump runs in dev (designed for staging/prod, gated)
- [ ] Restic ingests Mongo backups

**Adapter Implementation**

- [ ] `packages/adapters/persistence-mongo/` package created
- [ ] `connection.ts` with proper options, TLS, replica set
- [ ] Standard schema property helpers + BSON mappers
- [ ] Generic repository adapter
- [ ] Filter translator with property tests
- [ ] Unit of Work adapter using sessions
- [ ] Query adapter (with aggregation access)
- [ ] Schema introspection adapter (managed + sampling)
- [ ] Schema DDL adapter (validators + indexes)
- [ ] Migration runner (TypeScript-based)
- [ ] FullTextSearchPort implementation (text indexes)
- [ ] Capability declarations honest and runtime-verified

**Conformance**

- [ ] Full conformance test suite passes (skipping flagged-incapable tests)
- [ ] Round-trip type test passes
- [ ] Property-based filter test passes 10k random cases
- [ ] No service code imports `mongodb` (dependency-cruiser verified)
- [ ] CI matrix runs Postgres, MSSQL, and Mongo conformance on every PR

**Migrations**

- [ ] Migration system working with TS files
- [ ] Up + down for every migration
- [ ] Migration checksum verification active
- [ ] CI promotion supports Mongo migration jobs (gated until Mongo customer activates)
- [ ] **`platform_versions` collection** present (added in migration `0007_platform_versions`). Append-only audit log of platform release-version upgrades, distinct from `__platform_migrations`. Read by the upgrade orchestrator (Objective 9.5). See [objectives/9.5-platform-upgrade-and-versioning.md](9.5-platform-upgrade-and-versioning.md).

**Observability**

- [ ] Mongo-specific metrics exposed
- [ ] Slow query logging works
- [ ] MongoDB exporter scraped by Prometheus
- [ ] Grafana dashboards adapt to Mongo when active

**Operations**

- [ ] All runbooks in Section 6.13 written
- [ ] Quarterly restore drill scheduled
- [ ] Restore drill executed at least once
- [ ] Customer deployment guide for Mongo written

**Documentation**

- [ ] ADRs 0036–0041 written and Accepted
- [ ] `packages/adapters/persistence-mongo/README.md` covers setup, validators, migrations, troubleshooting
- [ ] Type mapping documented in contract docs
- [ ] Capability differences from Postgres/MSSQL documented in `docs/contracts/persistence-divergence.md`

**Verification**

- [ ] All 22 verification steps in Section 9 pass
- [ ] Performance baseline: simple findById on 100k-document collection p95 < 5ms

---

## 11. Anti-Patterns to Refuse

- **Importing `mongodb` outside this adapter.** Architecture violation.
- **Using ObjectId as primary keys.** UUID v7 is the platform standard.
- **Skipping JSON Schema validators on platform-managed collections.** Validators are how we make Mongo typed.
- **Adding Mongoose because "it's the standard."** Standards aren't reasons; the platform's port abstraction is what matters.
- **Pretending FKs work via application logic without declaring `foreign_keys: false`.** Honest capability flags or the data management UI will mislead users.
- **Putting DDL inside transactions.** Mongo doesn't allow it.
- **Using `$where` with arbitrary JavaScript.** Performance and security risk; the adapter never generates `$where`.
- **Skipping regex escaping.** Filter translator must escape; otherwise filter values become injection vectors.
- **Using Mongo's "schemaless flexibility" for platform tables.** Platform-managed collections always have validators.
- **Editing applied migrations.** Same discipline as relational adapters.
- **Letting connection pool exhaustion be a runtime surprise.** Pool sizing is dashboarded and alerted.
- **Skipping the conformance suite.** The whole point is portability.
- **Skipping the customer deployment guide.** Mongo customers exist; the deployment guide is part of the product.

---

## 12. Open Questions for Confirmation Before Starting

1. **Mongo container in dev** — using the official `mongo:7` image with replica set init. Confirmed?

2. **Atlas vs. self-hosted as the primary customer profile** — affects whether the customer deployment guide leans Atlas-first (cloud-managed, Atlas Vector Search, Atlas Search) or self-hosted (more operational responsibility). Recommendation: write both paths; lead with self-hosted in the docs since that's the more demanding case to document.

3. **Vector store recommendation** — Atlas Vector Search for Atlas customers, Qdrant for self-hosted, deferred Mongo native vectors when broadly available. Confirmed?

4. **Time-series collections, graph traversal ($graphLookup), GridFS** — none of these are in the platform's persistence ports today. Out of scope for this adapter; if a customer needs them, they're separate features. Confirmed?

5. **CI matrix cost** — running three database containers (Postgres, MSSQL, Mongo) in CI on every PR adds time. Acceptable for parity? Alternative: nightly conformance run for Mongo, fast PR run for Postgres/MSSQL.

6. **Mongo minimum version** — 6.0 as floor. Acceptable to decline customers on 5.x and earlier?

---

## 13. What Comes Next

With Objective 4b complete, the platform's persistence layer demonstrably works against three databases representing two paradigms. The conformance test suite is the contract that holds them together.

**Objective 4c: Cross-Database Conformance Verification** is next. Combines the per-adapter test suites from 4, 4a, and 4b into a CI matrix that runs them all on every PR, catches drift, and fails fast. Adds property-based testing across adapters: same filter, same data, same result, regardless of database. Adds performance baselines per adapter for regression detection.

**Objective 4d: Change Streams** implements `ChangeStreamPort` per database — Postgres logical replication, MSSQL CDC, Mongo change streams. Required by the data management module's real-time features.

After the database family, **Objective 5: Identity, Auth, and User Directory** is built — and notably, the platform's built-in auth feature (the Supabase-clone auth) is part of the data management module. Identity provider implementations (Entra ID, OIDC, SAML) are separate adapters around the same `IdentityProviderPort`.

---

_This document is the contract. Every checkbox in Section 10 must be true before moving on._
