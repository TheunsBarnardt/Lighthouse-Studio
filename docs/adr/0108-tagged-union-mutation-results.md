# ADR-0108: Tagged Union Mutation Results

**Status:** Accepted
**Date:** 2026-05-03
**Deciders:** solo

## Context

Mutations in the auto-generated GraphQL API can fail in several predictable ways: validation errors (missing required fields, constraint violations), conflicts (version mismatch, unique constraint violation), and authorization failures (insufficient permissions). GraphQL provides two patterns for surfacing these:

1. **Flat errors**: Return `null` data and populate the `errors` array at the top level of the response.
2. **Result union types**: Return a union type (`CreateUserResult = CreateUserSuccess | ValidationError | ConflictError | AuthorizationError`) in the `data` field.

## Decision

Use **tagged union mutation results** for all create and update mutations. Each mutation returns a `GraphQLNonNull` union type. Clients use `__typename` and inline fragments to handle each case:

```graphql
mutation {
  createUser(input: { email: "a@b.com" }) {
    __typename
    ... on CreateUserSuccess {
      user {
        id
        email
      }
    }
    ... on ValidationError {
      errors {
        field
        code
        message
      }
    }
    ... on ConflictError {
      message
      conflictingField
    }
    ... on AuthorizationError {
      message
      requiredPermission
    }
  }
}
```

Archive, restore, and hard-delete mutations return `Boolean!` (simpler; these cannot produce validation or conflict errors).

## Consequences

**What becomes easier:**

- Clients receive a typed, discriminated result. TypeScript clients using codegen get exhaustive type narrowing with no runtime casting.
- Errors are part of the data graph — they are cacheable, normalizable, and inspectable through standard GraphQL tooling.
- Partial success in multi-mutation requests is explicit: each mutation's result is independent.
- Adding a new error variant (e.g., `RateLimitError`) requires adding it to the union; the schema change signals breaking vs. additive to client code generators.

**What becomes harder:**

- Every mutation generates three extra types (`<Verb><Table>Success`, `<Verb><Table>Result` union, plus the shared error types). For a schema with 10 tables, that is 20 extra type definitions. GraphQL introspection responses grow accordingly.
- Clients that skip `__typename` and do not use fragments will receive an opaque object. This is intentional — the pattern only pays off when clients handle all variants.
- The `resolveType` function on the union must inspect `__typename` on the resolver's return value. This is a runtime coupling that tests must cover.

## Alternatives Considered

**Flat top-level errors:** Simple to implement; no extra types. But errors are stringly-typed, not schema-validated, and clients typically use `if (data === null) handleError(errors)` — losing the ability to distinguish validation from authorization from conflict. Rejected for public API surfaces.

**Single generic `MutationResult<T>` wrapper:** A reusable `MutationResult` union that wraps any entity. GraphQL unions cannot be parameterised — every table would need its own concrete union anyway. No savings.

**HTTP error codes only (non-200 for errors):** Works for REST; breaks the GraphQL contract where HTTP 200 is expected for all well-formed requests (even those with application-level errors). Rejected.
