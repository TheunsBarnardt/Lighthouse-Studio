# ADR-0029: Identity Provider vs. User Directory Separation

**Status:** Accepted
**Date:** 2026-05-02
**Deciders:** solo

## Context

Authentication involves two distinct concerns that tend to get conflated:

1. **Who authenticated and how** — the identity provider. This is protocol-specific (password flow, OIDC, SAML) and produces a verified identity claim.
2. **Where users are stored** — the user directory. This is a persistent record of users, their preferences, their MFA state, and their linked identities.

If these are conflated into a single abstraction (e.g., a single "auth service"), adding a new protocol (SAML) requires touching user storage code, and swapping the user store requires touching all protocol implementations. The coupling creates fragility.

## Decision

The platform splits identity into three separate ports:

- **`IdentityProviderPort`** — handles the protocol-specific sign-in flow. Produces `VerifiedIdentity` objects. Has no persistent state of its own.
- **`UserDirectoryPort`** — stores and retrieves users, credentials, linked identities, and MFA state.
- **`SessionPort`** — manages opaque session tokens independently of the identity provider that created them.

The `BuiltinIdentityProvider` (adapter) composes `UserDirectoryPort` and `SessionPort` to implement email/password, magic link, and OAuth flows. Federated providers (`identity-oidc`, `identity-entra`, `identity-saml`) implement only `IdentityProviderPort` — they do not manage users or sessions directly. The platform's auth service coordinates federated identity verification with JIT provisioning via `UserDirectoryPort.create` or `UserDirectoryPort.linkIdentity`.

## Consequences

### Positive

- Adding a new federated protocol (e.g., WebAuthn) requires only a new `IdentityProviderPort` adapter.
- Swapping the user store (from in-memory to Postgres) does not affect any identity provider.
- Federated adapters are stateless and can be unit-tested without any database.
- `SessionPort` can be implemented independently (in-memory, Redis, Postgres) without coupling to auth protocols.

### Negative

- More initial boilerplate: three ports, three conformance suites, and multiple adapters per store.
- The platform's auth service must orchestrate the handoff from `VerifiedIdentity` → `UserDirectoryPort.findByIdentity` → `SessionPort.create`. This coordination logic lives in the application layer, not in any single adapter.

### Neutral

- The `MfaPort` is a fourth port, consuming `UserDirectoryPort` as a dependency. TOTP operations read/write MFA secrets and recovery codes through the user directory port.

## Alternatives Considered

### Single AuthPort with protocol switching

A single port with `beginSignIn(method, ...)` and internal routing. Rejected because the port becomes a God object encoding all protocol knowledge. Adding SAML would require changing the port interface, breaking all existing adapters.

### Federated providers managing their own user tables

Each federated provider owns a separate user table. Rejected because it fragments the user identity across tables, making cross-provider profile merging, MFA enrollment, and admin user listing impossible without awkward unions.

## References

- `packages/ports/identity/src/identity-provider.port.ts`
- `packages/ports/identity/src/user-directory.port.ts`
- `packages/ports/identity/src/session.port.ts`
- `packages/ports/identity/src/mfa.port.ts`
