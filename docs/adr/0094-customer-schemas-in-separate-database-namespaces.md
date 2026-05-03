# ADR-0094: Customer Schemas in Separate Database Namespaces

**Status:** Accepted
**Date:** 2026-05-03
**Deciders:** solo

## Context

The Data Management Module stores two distinct categories of data in the same physical database instance:

1. **Platform metadata** — the platform's own operational tables (workspaces, members, audit log, etc.), and the records _about_ customer-defined schemas (`customer_schemas`, `customer_schema_versions`, `customer_schema_migrations`).
2. **Customer tables** — the actual tables the customer defines in the schema designer, materialized as real database objects when a schema is deployed.

If both categories share the same namespace, there is no structural barrier preventing:

- A buggy migration accidentally dropping a platform table
- A SQL injection in auto-generated API code (Objective 12) reaching platform internals
- An operator debugging query accidentally querying the wrong table
- A schema introspection scan returning platform-internal structure to customers

The platform must enforce isolation not by convention but by database-level structure.

## Decision

Platform-internal tables and customer-defined tables live in **separate database namespaces**, enforced per database driver:

### Postgres

- **Platform tables**: in the `public` schema (or a `platform` schema if the installation is configured to use one)
- **Customer tables**: in a schema named `cust_<workspace_slug>`, created when the workspace first deploys a schema
- **Roles**: two per workspace — `cust_<slug>_app` (runtime read/write) and `cust_<slug>_migrate` (DDL); the platform's own migration user has no grants on customer schemas

### MSSQL

- **Platform tables**: in the `dbo` schema
- **Customer tables**: in a schema named `cust_<workspace_slug>`
- **Roles**: two per workspace — same naming convention as Postgres, using MSSQL database roles

### MongoDB

- **Platform collections**: prefixed `platform_` (e.g. `platform_audit_log`)
- **Customer collections**: prefixed `cust_<workspace_slug>__` (e.g. `cust_acme__users`)
- MongoDB does not have schemas; the prefix is the namespace boundary
- MongoDB user roles are configured at the collection-level grant in the installation runbook

### Implementation artifacts

- `packages/core/src/services/data-management/namespace.ts` — derives namespace names from workspace slugs; generates idempotent DDL to create per-workspace schemas and roles
- `packages/adapters/persistence-postgres/migrations/0003_customer_schemas.sql` — platform metadata tables only; customer namespace setup runs on workspace creation
- Equivalent migrations for MSSQL and MongoDB

## Consequences

**Positive:**

- Platform tables are structurally unreachable from the customer application role — not just by convention
- Workspace A's customer tables are unreachable from Workspace B's application role (cross-tenant isolation)
- Introspection operations on a workspace see only that workspace's tables, not platform internals
- SQL injection in customer-generated APIs (Objective 12) cannot affect platform tables or other workspaces' tables

**Negative:**

- Schema creation (deploying a new workspace's first schema) must issue DDL to create the namespace and roles — additional latency on first deploy
- Database backup/restore procedures must account for both the platform namespace and all `cust_*` namespaces
- Workspace slug is embedded in the namespace name; renaming a workspace slug requires renaming the database schema/prefix (a migration, not just a metadata update)

## Alternatives Considered

**All in one schema, distinguished by a prefix column**: rejected — no structural isolation; a misconfigured query bypasses the convention; SQL injection ignores it entirely.

**Separate physical databases per workspace**: rejected — operational complexity is extreme; connection pooling, backup, and monitoring all become per-workspace problems; impractical for installations with many workspaces.

**Schema-per-customer on platform's primary database**: accepted — this is what we implement. Simple, well-understood, works on all three databases (with different mechanisms), and provides structural isolation without separate physical infrastructure.
