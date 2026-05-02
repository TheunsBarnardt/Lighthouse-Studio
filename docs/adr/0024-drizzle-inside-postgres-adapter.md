# ADR-0024: Drizzle Inside the Postgres Adapter

**Status:** Accepted
**Date:** 2026-05-02
**Deciders:** solo

## Context

The platform needs a TypeScript-friendly way to author and evolve the Postgres schema, generate migration SQL, and execute type-safe queries within the adapter layer. The candidate tools are raw SQL, Drizzle ORM, Prisma, TypeORM, Knex, and Sequelize.

The constraint from ADR-0005 (hexagonal architecture) is that the ORM/query-builder must live entirely inside the adapter and must not leak through the port boundary into the core domain. Service code must never import `pg`, `drizzle-orm`, or any Postgres-specific symbol.

## Decision

Use Drizzle ORM inside `packages/adapters/persistence-postgres/`, under the port abstraction.

Specifically:

- **Schema definition** uses Drizzle's `pgTable` columns (`uuid`, `timestamp`, etc.) in `src/schema/`.
- **Migration generation** uses `drizzle-kit generate` to produce plain SQL from schema diffs.
- **Query execution** uses `pg` (node-postgres) directly for the repository adapter — not Drizzle's query builder — because the generic repository pattern is cleaner with parameterized SQL than with Drizzle's typed table references.
- **Transaction management** uses `pg`'s `PoolClient.query` with `BEGIN/COMMIT/ROLLBACK`.

Drizzle is never re-exported from the adapter's `index.ts`. `dependency-cruiser` enforces that `drizzle-orm` is not imported by `packages/core/`, `packages/ports/`, or any app.

## Consequences

### Positive

- Schema changes produce reviewable, plain-SQL migration files. No magic.
- `drizzle-kit generate` diffs the TypeScript schema and produces minimal SQL — not a full dump.
- Drizzle's type system gives strong column-type guarantees in schema definition files.
- Swapping Drizzle for a different tool only affects this one adapter package.

### Negative

- Two mental models coexist: Drizzle for schema definition, raw `pg` for query execution. Developers working in this adapter must understand both.
- Drizzle's query builder is not used for data access, so its main differentiator vs Knex is not fully exploited.

### Neutral

- `drizzle-kit` is a `devDependency`; it's never in production bundles.
- The `drizzle.config.ts` at the adapter root is the single configuration point.

## Alternatives Considered

### Prisma

Pros: widely used, excellent DX, strong migration tooling.
Cons: generates a global singleton client; breaks the hexagonal boundary; migrations require Prisma Migrate running alongside the app. Not suitable for a multi-database platform where schemas differ per adapter.

### Raw pg + hand-written SQL everywhere

Pros: zero abstraction, maximum control.
Cons: no schema-as-code; migrations must be authored by hand every time; no diff generation. Acceptable for simple services, too error-prone for a platform with many tables.

### Knex

Pros: well-established, good migration tooling, raw-SQL escape hatches.
Cons: schema is in JS (not TypeScript-native); slightly worse DX than Drizzle for schema authoring. Roughly equivalent capability; Drizzle won on TypeScript ergonomics.

## References

- [Drizzle ORM docs](https://orm.drizzle.team/)
- ADR-0005: Hexagonal Architecture
- `packages/adapters/persistence-postgres/src/schema/_common.ts`
