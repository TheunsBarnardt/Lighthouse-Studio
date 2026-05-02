# ADR-0005: Hexagonal Architecture (Ports & Adapters)

**Status:** Accepted
**Date:** 2026-05-02
**Deciders:** solo (Theuns Barnardt)

## Context

The platform must run on PostgreSQL, MSSQL, and MongoDB equivalently. It must support pluggable auth (built-in, Entra ID, OIDC, SAML), pluggable storage (local, S3, Azure Blob), and pluggable communication (SMTP, SES, SendGrid). Hard-coding any one technology would make the other options prohibitively expensive to add later.

## Decision

The platform uses the Hexagonal Architecture pattern (also known as Ports & Adapters):

- **Ports** (`packages/ports/*`) — interfaces that the domain uses. Named `*Port`.
- **Adapters** (`packages/adapters/*`) — implementations of ports that bridge to specific technologies. Named `*Adapter`.
- **Composition root** (`packages/composition`) — the only place where specific adapters are wired to ports.

Rules enforced by `dependency-cruiser`:

1. Port packages must not import from adapter packages.
2. Application/core code must not import adapter packages directly.
3. Only `packages/composition` may import both.

## Consequences

### Positive

- Swapping a database from PostgreSQL to MSSQL requires zero changes to business logic.
- Core domain logic is testable with in-memory adapters; no real database required in unit tests.
- Adding a new adapter (e.g., `storage-azure-blob`) is a self-contained package addition with no changes to core.
- `dependency-cruiser` enforces the boundary mechanically; violations cannot be accidentally merged.

### Negative

- Every new capability requires a new port interface and at least one adapter — more upfront work than a direct dependency.
- Port interfaces must be designed conservatively; a too-narrow port forces ugly adapter workarounds.
- The composition root becomes large as adapters grow; managed by the `composeMemory()` / `compose()` factory pattern.

## Alternatives Considered

- **Direct dependencies with interfaces**: add interfaces but allow direct imports. Rejected because enforcement requires discipline that erodes under deadline pressure; `dependency-cruiser` makes it structural.
- **Dependency injection container library (tsyringe, inversify)**: adds runtime reflection complexity. Rejected in favour of explicit manual DI at the composition root.
