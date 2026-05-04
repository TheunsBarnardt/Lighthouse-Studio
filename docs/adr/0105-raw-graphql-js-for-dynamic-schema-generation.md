# ADR-0105: Raw graphql-js for Dynamic Schema Generation (Not Pothos)

**Status:** Accepted
**Date:** 2026-05-03
**Deciders:** solo

## Context

Objective 13 requires a GraphQL layer that reflects customer-defined schemas at runtime. Schemas are not known at compile time — they are created and deployed by workspace admins and can change at any time. The chosen library must support building a complete `GraphQLSchema` from a `CustomerSchema` description with no compile-time type information.

The objective named Pothos as the code-first schema builder to evaluate. Two other options were considered.

## Decision

Use the raw **graphql-js** runtime library (`graphql` npm package) directly for schema construction. `GraphQLSchemaBuilder` builds `GraphQLObjectType`, `GraphQLUnionType`, `GraphQLInputObjectType`, and all related types programmatically from `CustomerSchema` data, caches the result per `(schemaId, version)`, and invalidates the cache on schema deployment.

Pothos is installed as a peer dependency (the package.json lock it in per the objective's locked decisions), but the implementation does not use it.

## Consequences

**What becomes easier:**

- Schema construction is fully data-driven: any `CustomerSchema` serialised in the database can produce a valid `GraphQLSchema` at startup or on first request.
- Cache invalidation is simple: delete the `schemaId:vN` entry; the next request rebuilds from the current `CustomerSchema`.
- No code generation step, no build artifact to keep in sync with the database schema.
- The graphql-js API is stable, well-understood, and has complete documentation.

**What becomes harder:**

- Pothos's decorator-driven ergonomics (type inference, plugin system) are unavailable. Boilerplate for field definitions is higher.
- IDE auto-complete for resolver return types is weaker because types are only known at runtime, not at compile time.
- Adding a new field pattern (e.g., a new column kind) requires updating both the schema-builder and the resolvers, with no static link between them.

## Alternatives Considered

**Pothos (code-first with TypeScript types):** Pothos is designed for static schemas where TypeScript types drive the GraphQL type system. Its `builder.objectRef<MyType>()` pattern requires a compile-time TypeScript type. For dynamic schemas, you would need `builder.objectRef<Record<string, unknown>>()` for every table, losing all type safety and all Pothos plugin benefits. Effectively you'd be writing raw graphql-js with extra ceremony. Rejected.

**SDL-first with graphql-tools:** Generate a GraphQL SDL string from `CustomerSchema`, then `buildASTSchema()` it. This works, but attaching resolvers requires merging resolver maps by field name (string-keyed), which is error-prone and loses the clear data-flow from `CustomerTableDefinition` to field config. Raw graphql-js is more explicit for this use case. Rejected.

**TypeGraphQL:** TypeGraphQL uses class decorators and reflection metadata — inherently compile-time. Ruled out for the same reason as Pothos.
