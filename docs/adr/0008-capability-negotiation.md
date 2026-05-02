# ADR-0008: Capability Negotiation

**Status:** Accepted
**Date:** 2026-05-02
**Deciders:** solo (Theuns Barnardt)

## Context

Not every adapter can do everything. PostgreSQL supports array columns; MSSQL does not. Mongo has no DDL. Local filesystem storage cannot generate signed URLs natively. The platform must surface these differences honestly rather than fail silently at runtime.

## Decision

Every port that has optional capabilities includes a synchronous `supports(feature)` method:

```typescript
interface SchemaIntrospectionPort {
  supports(feature: SchemaFeature): boolean;
  // ...
}

type SchemaFeature = 'schemas' | 'foreign_keys' | 'array_columns' | 'transactions' | 'change_streams' | ...;
```

Adapters implement `supports()` as a static manifest. The platform's UI and services query capabilities at startup via a `CapabilityRegistry` and:

1. Disable features with an explanation when the capability is missing.
2. Fall back to a less-efficient implementation where practical.
3. Offer an upgrade path where applicable.

The platform never silently misbehaves because of a missing capability.

## Consequences

### Positive

- MSSQL customers get an honest UI rather than mysterious failures.
- Feature gating is systematic rather than scattered `if (driver === 'postgres')` checks in core.
- New capabilities can be added to the port type without breaking existing adapters (they return `false` for the new flag until updated).

### Negative

- Every port with optional features must define a capability enum — more surface area to maintain.
- UI code must query capabilities before rendering features, adding conditional rendering throughout.

## Alternatives Considered

- **Runtime duck-typing**: check if the method throws `NotSupportedError`. Rejected because errors at runtime are worse than capability checks at startup.
- **Separate port interfaces per capability tier**: a `BasicRepositoryPort` and `AdvancedRepositoryPort`. Rejected because it fragments the adapter contract and makes composition harder.
