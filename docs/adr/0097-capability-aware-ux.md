# ADR-0097: Capability-Aware UX for the Schema Designer

**Status:** Accepted
**Date:** 2026-05-03
**Deciders:** solo

## Context

The platform supports three databases: Postgres, MSSQL, and MongoDB. They have different capabilities:

- Postgres supports array columns, partial indexes, row-level security, and `GENERATED ALWAYS AS` computed columns
- MSSQL supports computed columns and filtered indexes but not array columns or RLS (as the platform defines it)
- MongoDB supports array fields and change streams natively but does not enforce foreign keys or support partial indexes the same way

A schema designer that presents the same UI to all three databases has two choices:

1. **Pretend they're the same**: show all features to all databases; fail at migration time with a cryptic error when the customer tries to use an unsupported feature
2. **Be honest**: disable or explain unsupported features in the UI, before the customer invests time designing a schema that can't be deployed

Option 1 produces a bad experience at the worst possible time — when the customer is trying to deploy. Option 2 produces a clear, honest, early explanation.

## Decision

The schema designer is **capability-aware**: it reads the active workspace's database driver and adjusts the UI honestly based on what that driver supports.

### Implementation approach

`SchemaValidator` in `packages/core/src/services/data-management/schema-validator.ts` maintains a `CapabilitySet` per driver (Postgres, MSSQL, Mongo). The validator emits errors or warnings when the schema uses a feature the driver doesn't support.

The UI reads the `ValidationReport` from the validator and renders:

- **Disabled controls** with tooltips explaining why (e.g., "Array columns are not supported on MSSQL — use a JSON column or a separate child table instead")
- **Warning banners** on features that work differently (e.g., "Foreign keys on MongoDB are advisory — the database does not enforce referential integrity")
- **Info markers** on capability-dependent features that are enabled but limited (e.g., "Change streams require replica set mode; ensure your MongoDB is configured accordingly")

The capability matrix is defined by the `SchemaFeature` type and `CapabilitySet` interface — the same capability system introduced in Objective 4c.

### What "honest" means

- If Postgres can do something and MSSQL can't: the control is **disabled** on MSSQL with an explanation and a suggestion (what to do instead)
- If both databases support a feature but differently: the control is **visible with a warning** that explains the difference
- If the feature is globally unsupported (doesn't exist on any supported database): it's not in the schema designer at all

There is no "advanced mode" that bypasses capability checks. A user who wants to run raw DDL can use the Query Console (Objective 17).

### MongoDB foreign keys (advisory mode)

MongoDB does not enforce foreign keys at the database level. A customer designing a schema with foreign keys between MongoDB collections gets:

1. A warning banner in the FK dialog: "Foreign keys on MongoDB are advisory — stored in platform metadata, but not enforced by the database"
2. The FK is stored in the `CustomerSchema.foreignKeys` array with `advisory: true`
3. The migration plan does NOT emit any DDL for the FK — it's metadata-only
4. A future objective will implement application-layer FK enforcement

This is honest: the customer's intent is captured; the limitation is clearly communicated; a path forward exists.

## Consequences

**Positive:**

- Customers discover capability gaps at design time, not at deployment time
- The schema designer is a genuine product differentiator — it's honest about cross-database differences where other tools pretend databases are interchangeable
- The validation layer (server-side) enforces the same rules as the UI — there's no way to circumvent capability checks by bypassing the UI

**Negative:**

- The capability matrix must be maintained as databases evolve (MSSQL 2022 added new features; MongoDB 7 changed change stream behavior)
- Some customers will be frustrated when features they expect from one database aren't available in the UI for their chosen database — this is by design but requires clear communication in the UI copy

## Alternatives Considered

**Show all features to all databases, fail at migration**: rejected — the failure message from the database is often cryptic and appears at the wrong time. Honest design-time communication is better UX.

**Separate schema designers per database**: rejected — three separate UIs multiplies maintenance burden by 3 and confuses customers switching between databases. One UI, three capability sets.

**Hide unsupported features entirely (no tooltip)**: rejected — "where did array columns go?" is confusing. Disabled with explanation is clear.
