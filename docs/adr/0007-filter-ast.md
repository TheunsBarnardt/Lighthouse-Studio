# ADR-0007: The Filter AST

**Status:** Accepted
**Date:** 2026-05-02
**Deciders:** solo (Theuns Barnardt)

## Context

`RepositoryPort.findMany()` needs a filter mechanism that works across PostgreSQL, MSSQL, and MongoDB without leaking dialect-specific syntax. The filter must be expressive enough for real application queries without becoming a full query language.

## Decision

Filters use a structured AST type:

```typescript
type Filter<T> = { _and: Filter<T>[] } | { _or: Filter<T>[] } | { _not: Filter<T> } | FieldFilter<T>;

type FieldFilter<T> = { [K in keyof T]?: T[K] | FieldOperator<T[K]> };

type FieldOperator<V> = { _eq: V } | { _neq: V } | { _in: V[] } | { _nin: V[] } | { _lt: V } | { _lte: V } | { _gt: V } | { _gte: V } | { _contains: V } | { _icontains: V } | { _starts_with: V } | { _ends_with: V } | { _is_null: boolean };
```

Each adapter translates this AST to its native query language. Operators not supported by a dialect return a typed `PersistenceError('UNSUPPORTED_OPERATOR')`.

**Deliberately excluded:**

- Raw SQL fragments
- Regex operators
- JSON path queries
- Spatial operators
- Full-text search (goes through `FullTextSearchPort`)
- Subqueries and joins (go through `QueryPort`)

## Consequences

### Positive

- Filters are portable across all three databases without changing the call site.
- The filter type is compile-time checked against the entity shape.
- Dialect-specific operators cannot leak into port-level code.

### Negative

- Some valid SQL queries require dropping to `QueryPort` for complex cases.
- Adapter authors must implement the full operator set (or return explicit unsupported errors).

## Alternatives Considered

- **Raw SQL with parameterization**: maximally expressive but completely non-portable. Rejected.
- **ORM query builders (TypeORM, Prisma)**: opinionated, generate migrations, and often leak SQL concepts. Rejected; the port abstraction would be paper-thin on top of them.
- **GraphQL-style filter (Hasura-inspired)**: similar to what was chosen, slightly different naming. Considered — the chosen naming (`_eq`, `_in`, etc.) is Hasura-inspired and familiar to the target audience.
