# ADR-0011: Identity Provider vs User Directory Separation

**Status:** Accepted
**Date:** 2026-05-02
**Deciders:** solo (Theuns Barnardt)

## Context

The platform supports multiple authentication mechanisms: built-in password auth, Entra ID (Azure AD), generic OIDC, SAML. Regardless of which mechanism authenticates a user, the platform needs its own user records for workspace membership, RBAC roles, audit trail attribution, and preferences. These two concerns — "who are you?" and "what is your record in this installation?" — are different problems with different adapters.

## Decision

Two separate ports handle these concerns:

- **`IdentityProviderPort`** — authenticates a user and returns a `VerifiedIdentity` (a claim set: `subject`, `email`, `claims`). It does not create or update platform user records.
- **`UserDirectoryPort`** — manages user records in the platform's own database: creation, lookup by external subject ID, roles, workspace membership.

The auth flow is:

1. User authenticates via `IdentityProviderPort` → receives `VerifiedIdentity`.
2. The platform calls `UserDirectoryPort.findBySubject(identity.subject)` to look up the corresponding internal user.
3. If no internal user exists (first login), one is created via `UserDirectoryPort.provision(identity)`.
4. The session is then attached to the internal user record.

## Consequences

### Positive

- Switching auth providers (e.g., from built-in to Entra ID) does not require migrating user records — only the `IdentityProviderPort` adapter changes.
- A customer with Entra ID gets the platform's full RBAC and audit capabilities without any coupling between Entra and the platform's internal user table.
- The `UserDirectoryPort` is always the persistence adapter (backed by the customer's database), regardless of which identity provider is in use.

### Negative

- Two-step auth flow adds one database lookup per login. Acceptable given login frequency vs. the architectural benefit.
- Provisioning logic (first-login user creation) lives in the platform's auth service, not in either port adapter.

## Alternatives Considered

- **Single port combining auth and user management**: simpler but couples the identity provider to the platform's user schema. Rejected; an Entra ID adapter should not need to know about workspace membership.
- **Identity provider owns the user record**: standard in IdP-as-a-service products (Auth0, Supabase). Rejected because the platform manages its own user table for audit and RBAC, and cannot delegate that to an external service.
