# ADR-0098: Schema as the API Surface

**Status:** Accepted
**Date:** 2026-05-03
**Deciders:** solo

## Context

Objective 12 will auto-generate REST API endpoints from customer-defined schemas. Objective 13 will generate GraphQL. Objective 19 will expose a client SDK. All three need a source of truth about:

- What tables exist
- What columns each table has (names, types, nullable)
- What relationships exist (foreign keys)
- What the primary keys are (for CRUD routing)
- What constraints apply (for validation at the API layer)

Two options exist for this source of truth:

1. **Database introspection**: at runtime, query the live database for its schema and derive API surface from it
2. **Platform schema model**: use the `CustomerSchema` document stored in `customer_schemas` as the source of truth; the database is its materialization

## Decision

The **platform's schema model is the source of truth** for the API surface. The database is the materialization of that truth, not the truth itself.

This means:

- Objective 12 (REST) reads `CustomerSchema.tables` to generate endpoint routes and Zod validators, not `pg_catalog` or `INFORMATION_SCHEMA`
- Objective 13 (GraphQL) reads `CustomerSchema.tables` to build the schema definition, not introspection queries
- Objective 19 (SDK) reads `CustomerSchema.tables` to generate TypeScript types, not introspection

### Why the platform model, not database introspection

**Stable identifiers**: `TableDefinition.id` and `ColumnDefinition.id` survive renames. A REST route for `/api/users` survives a rename of the `users` table to `people` if the route is generated from the stable ID, not the current name. Database introspection gives names, not stable IDs.

**PII metadata**: `ColumnDefinition.isPii` and `ColumnDefinition.piiCategory` are stored in the platform model, not in the database. The API layer needs to know which fields to redact for non-privileged callers — this metadata does not exist in the database.

**Advisory foreign keys (Mongo)**: Mongo doesn't store FK constraints in the database at all; the platform model is the only place they exist.

**Capability metadata**: `rowLevelSecurity`, `changeStream`, `fullTextSearch` — these are platform-level configs, not raw database features. The API layer uses them to decide how to construct queries.

**Schema drift detection**: if the database diverges from the platform model (manual DDL applied outside the designer), the platform can detect and report drift by comparing the model against the database. This detection only works if the model is the primary truth.

### Introspection as verification, not authority

`SchemaIntrospectionPort` (`listTables`, `describeTable`, etc.) is used for:

1. **Drift detection**: periodic comparison of the platform model against the live database
2. **Import**: onboarding a customer with an existing database by introspecting and creating an initial `CustomerSchema`
3. **Verification steps** during testing

It is not used to derive the API surface at request time.

### The corollary: schema must be deployed before APIs exist

An API endpoint exists only for tables that have been deployed (i.e., `deployed_version` is set). A schema that exists in the designer but has never been applied to the database has no API. The UI communicates this clearly — a "Deploy" badge on any table with undeployed changes.

## Consequences

**Positive:**

- Stable identifiers enable safe renames — a common operation that is notoriously painful in database-first API generation
- PII metadata, advisory FKs, and capability configs are available to the API layer without additional queries
- Schema drift detection is structurally possible
- The API surface is defined declaratively, versioned, and auditable

**Negative:**

- The platform model and the database can drift (manual DDL bypasses the designer); drift detection (not implemented in this objective) is required to catch this
- Import from an existing database requires a careful mapping from introspection output to the platform model — some information (like PII tagging) must be added manually

## Alternatives Considered

**Database-first introspection at request time**: rejected — introspection queries are expensive; stable IDs don't exist; PII metadata can't be inferred; advisory FKs are invisible. The generated API would be lower quality and less safe.

**Hybrid (introspect and merge)**: rejected for the initial implementation — merging two sources of truth requires conflict resolution logic; the simpler, safer approach is one source of truth.
