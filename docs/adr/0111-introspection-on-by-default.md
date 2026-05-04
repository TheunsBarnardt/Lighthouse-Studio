# ADR-0111: Introspection On by Default

**Status:** Accepted
**Date:** 2026-05-03
**Deciders:** solo

## Context

GraphQL introspection allows any authenticated client to query the full schema — type names, field names, arguments, and descriptions — via `__schema` and `__type` queries. This is essential for tooling (GraphiQL, code generators, API explorers) but is sometimes disabled in production to avoid leaking schema details to attackers.

The platform serves customer schemas that are themselves defined by workspace admins. Disabling introspection globally would break the GraphiQL playground and all code-generation workflows. Enabling it globally exposes the schema to any client that holds a valid API key.

## Decision

Introspection is **on by default** for all workspaces. The `GraphQLRequestHandler` does not reject `__schema` or `__type` queries. An audit event `data_management.graphql.introspection_query` is written when an introspection query is detected (identified by the presence of `__schema` or `__type` in the parsed AST's top-level selection set).

A workspace-level `disableIntrospection: boolean` flag is reserved in the schema but not yet surfaced in the UI. When set, the handler returns `400` with `extensions.code = 'INTROSPECTION_DISABLED'` for introspection queries.

## Consequences

**What becomes easier:**

- GraphiQL playground works out of the box.
- Client code generators (graphql-codegen, Apollo) work without extra configuration.
- The platform's primary audience (developers building applications) can explore their schema immediately.

**What becomes harder:**

- Workspace admins who want to prevent schema enumeration cannot do so via the UI in v1 (only via the raw configuration flag).
- An API key holder can infer the full table/column structure of the workspace's schema from introspection. The platform treats API keys as trusted credentials; key holders are assumed to be authorised developers or services.

## Security rationale

Disabling introspection is security-through-obscurity — a client with a valid API key and the patience to probe field names can discover the schema regardless. The real security control is the RBAC layer: introspection reveals names, but every data query is still authorised against `data_table.<operation>` permissions. Disabling introspection trades developer ergonomics for marginal security benefit and is appropriate only in high-assurance deployments where the schema itself is sensitive. This is available as a workspace flag; it is not the default.

## Alternatives Considered

**Introspection off by default:** Forces every workspace to opt in before tooling works. Creates friction for the majority of workspaces (development/staging) to protect the minority (production deployments with schema-sensitive data). Rejected as the wrong default.

**Introspection gated behind a separate permission:** A `schema.introspect` RBAC action, separate from data read permissions. Adds complexity; most introspection clients are the same service accounts that read data. The workspace-level flag is a simpler control surface for the use cases that need it.
