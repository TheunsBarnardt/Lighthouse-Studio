# ADR-0034: Just-in-Time vs. Pre-Provisioning for Federated Identity

**Status:** Accepted
**Date:** 2026-05-02
**Deciders:** solo

## Context

When a user authenticates through a federated identity provider (OIDC, SAML, Entra ID), the platform must decide what to do if the user's identity exists in the IdP but not yet in the platform's user directory.

Two models:

1. **Just-in-Time (JIT) Provisioning** — create the user record on first successful authentication. The IdP is the source of truth for group membership and attributes; the platform syncs on each login.
2. **Pre-Provisioning** — an administrator must create the user record before authentication is allowed. First login for an unknown identity is rejected.

## Decision

**JIT provisioning is configurable per federated adapter (default: enabled).**

When `justInTimeProvisioning: true` (adapter config):

- On first successful federated authentication, the platform calls `UserDirectoryPort.create` with the identity claim from the IdP.
- On subsequent logins, the platform calls `UserDirectoryPort.linkIdentity` to update the last-used timestamp and any attribute changes.
- Group membership (when available, e.g., Entra `groupSync`) is stored in session metadata, not in the user directory — groups change in the IdP and should not be cached long-term.

When `justInTimeProvisioning: false`:

- The platform calls `UserDirectoryPort.findByIdentity`. If no user exists, authentication is rejected with `ACCOUNT_NOT_FOUND`.
- Administrators provision users via the user management API before granting access.

**Default: JIT enabled** for OIDC and Entra; JIT enabled for SAML (common enterprise expectation). The built-in auth handles its own provisioning (self-service signup) separately.

## Consequences

### Positive

- JIT is the expected behaviour for enterprise OIDC/SAML deployments. Disabling it by default would require every new deployment to manually provision every user before first login.
- JIT eliminates the "chicken and egg" problem (can't log in until provisioned; can't provision without logging in).
- Pre-provisioning mode (`justInTimeProvisioning: false`) gives security-conscious deployments explicit control.

### Negative

- JIT creates users without explicit admin approval. In high-security environments, any federated identity that can reach the platform can create a user record (even if that user has no workspace access — RBAC is a separate concern).
- Attribute drift: the IdP's email or name may change after JIT provisioning. The platform updates linked identity attributes on each login but does not automatically update `primary_email` in the user record (manual admin action required).

### Neutral

- JIT provisioning is the responsibility of the platform's auth service (application layer), not of the federated adapter. The adapter produces a `VerifiedIdentity`; the auth service decides what to do with it.

## Alternatives Considered

### Always JIT (no pre-provisioning option)

Simpler. Rejected because enterprise deployments often require proof that only HR-approved identities can access the system.

### Always pre-provisioning (no JIT)

Maximum control. Rejected as the default because it creates onboarding friction for every new deployment and is unnecessary for small teams.

### SCIM-based provisioning

Sync users from the IdP's SCIM endpoint before any login occurs. Better for large enterprises. Deferred to a later objective; the `UserDirectoryPort.create`/`archive` API is compatible with a SCIM adapter.

## References

- `packages/adapters/identity-oidc/src/config.ts` — `justInTimeProvisioning` flag
- `packages/adapters/identity-entra/src/config.ts`
- `packages/adapters/identity-saml/src/config.ts`
- `packages/ports/identity/src/identity-provider.port.ts`
