# Database Capability Matrix

This document records which platform features are available on each supported database driver. The schema designer reads this matrix and adjusts its UI accordingly — features not supported on the active driver are disabled with an explanation, never silently hidden.

Last updated: 2026-05-03 (Objective 11)

---

## Schema Designer Features

| Feature                      | Postgres                   | MSSQL                              | Mongo                                                     |
| ---------------------------- | -------------------------- | ---------------------------------- | --------------------------------------------------------- |
| Tables / collections         | ✅                         | ✅                                 | ✅                                                        |
| Columns                      | ✅                         | ✅                                 | ✅ (schema-less; advisory)                                |
| Primary keys                 | ✅                         | ✅                                 | ✅ (`_id` enforced by Mongo)                              |
| Foreign keys                 | ✅ (enforced)              | ✅ (enforced)                      | ⚠️ advisory only — stored in metadata, not enforced by DB |
| Unique indexes               | ✅                         | ✅                                 | ✅                                                        |
| Partial (filtered) indexes   | ✅                         | ✅ (`WHERE` clause)                | ✅ (partial indexes via `partialFilterExpression`)        |
| Multi-column indexes         | ✅                         | ✅                                 | ✅                                                        |
| JSON columns                 | ✅ (`jsonb` preferred)     | ✅ (`nvarchar(max)` + check)       | ✅ (native document)                                      |
| Array columns                | ✅                         | ❌                                 | ✅ (native arrays)                                        |
| Computed / generated columns | ✅                         | ✅ (persisted + virtual)           | ❌                                                        |
| Row-level security (RLS)     | ✅                         | ❌                                 | ❌                                                        |
| Full-text search             | ✅ (`tsvector`)            | ✅ (FTS indexes)                   | ✅ (text indexes)                                         |
| Change streams               | ✅ (logical replication)   | ✅ (CDC / change tracking)         | ✅ (native change streams)                                |
| Schema namespacing           | ✅ (`cust_<slug>` schema)  | ✅ (`cust_<slug>` schema)          | ⚠️ prefix-based (`cust_<slug>__`)                         |
| Transactions                 | ✅                         | ✅                                 | ⚠️ single-document only (multi-doc requires replica set)  |
| DDL transactions             | ✅                         | ✅                                 | ❌                                                        |
| ENUM types                   | ✅                         | ⚠️ (`CHECK` constraint workaround) | ❌                                                        |
| UUID primary keys            | ✅ (`gen_random_uuid()`)   | ✅ (`NEWID()`)                     | ✅ (`ObjectId` or UUID string)                            |
| Auto-increment / serial      | ✅ (`IDENTITY` / `SERIAL`) | ✅ (`IDENTITY`)                    | ❌ (use ObjectId instead)                                 |
| Named check constraints      | ✅                         | ✅                                 | ❌                                                        |

---

## Migration Capabilities

| Feature                      | Postgres                         | MSSQL                 | Mongo                               |
| ---------------------------- | -------------------------------- | --------------------- | ----------------------------------- |
| DDL in transactions          | ✅                               | ✅                    | ❌                                  |
| Atomic rollback              | ✅                               | ✅                    | ❌ (best-effort)                    |
| Online index creation        | ✅ (`CREATE INDEX CONCURRENTLY`) | ✅ (`ONLINE = ON`)    | ✅ (background by default)          |
| Rename column                | ✅                               | ✅                    | ✅ (`$rename`)                      |
| Rename table                 | ✅                               | ✅ (`sp_rename`)      | ✅ (`renameCollection`)             |
| Change column type           | ✅ (with casts)                  | ✅ (compatible casts) | ✅ (no-op in schema; app validates) |
| Drop column with data        | ✅ (⚠️ data lost)                | ✅ (⚠️ data lost)     | ✅ (⚠️ data lost)                   |
| Backfill new NOT NULL column | ✅ (requires default)            | ✅ (requires default) | ✅ (advisory only)                  |

---

## API Generation (Objective 12, forward reference)

| Feature                      | Postgres  | MSSQL     | Mongo                 |
| ---------------------------- | --------- | --------- | --------------------- |
| REST CRUD                    | ✅        | ✅        | ✅                    |
| GraphQL                      | ✅        | ✅        | ✅                    |
| Filtering by FK relationship | ✅ (JOIN) | ✅ (JOIN) | ⚠️ lookup aggregation |
| Real-time subscriptions      | ✅        | ✅        | ✅                    |
| Row-level security on API    | ✅        | ❌        | ❌                    |

---

## Legend

| Symbol | Meaning                                                   |
| ------ | --------------------------------------------------------- |
| ✅     | Fully supported                                           |
| ⚠️     | Partially supported — UI shows explanation and workaround |
| ❌     | Not supported — UI disables the feature with explanation  |

---

## How the UI uses this matrix

The `SchemaService` returns the active schema's `databaseDriver`. The schema designer reads the capability matrix (this document's machine-readable twin lives at `packages/core/src/services/data-management/capabilities.ts`) and disables UI controls for unsupported features. A tooltip explains why the control is disabled and, where applicable, suggests an alternative.

Examples:

- User on MSSQL tries to add an array column → field type picker disables "array" with tooltip: _"MSSQL doesn't support array column types. Use a JSON column or a child table instead."_
- User on Mongo adds a foreign key → warning banner: _"Foreign keys are advisory on MongoDB. The platform stores this relationship in metadata, but the database does not enforce referential integrity. Application-layer enforcement is deferred."_
- User on Postgres sees full functionality with no restrictions.

This honesty is a core platform value. The UI never pretends a feature works when it doesn't.
