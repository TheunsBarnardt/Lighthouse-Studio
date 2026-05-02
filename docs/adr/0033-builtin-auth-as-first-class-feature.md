# ADR-0033: Built-in Auth as a First-Class Feature, Not a Default

**Status:** Accepted
**Date:** 2026-05-02
**Deciders:** solo

## Context

The platform ships with a built-in identity system (email/password, magic link, OAuth, MFA). A common pattern for this type of system is to ship a "default" auth that users are expected to replace with their SSO provider. This creates second-class citizen dynamics: the built-in auth gets minimal investment, its security model differs from the "real" path, and edge cases accumulate in the transition.

The alternative: make the built-in auth a production-grade option that enterprises with no existing SSO, small teams, and self-hosted installations can rely on indefinitely — not just as a bootstrap.

## Decision

The **built-in auth** (`BuiltinIdentityProvider`) is a **first-class production feature**, not a development convenience or temporary placeholder.

Practically, this means:

- **Same code path** for both the data management module (Supabase-equivalent) and the build pipeline: the `BuiltinIdentityProvider` is the single implementation, configured differently per deployment, not two separate auth systems.
- **Security parity with federated adapters**: the built-in system implements lockout, HIBP checking, MFA, email verification, and token security at the same level expected of enterprise SAML/OIDC.
- **`selfServiceSignup`** is a configuration flag, not a code-level fork. An enterprise deployment can disable self-registration (requiring admin provisioning) without swapping adapters.
- **`IdentityProviderPort`** is implemented by `BuiltinIdentityProvider` with `getMetadata()` returning production capabilities. Federated adapters plug into the same port, and the platform's auth service treats all implementations uniformly.

## Consequences

### Positive

- Self-hosted installations (typical for the platform) can run without any external identity provider.
- Small teams get a production-grade auth with MFA without needing to set up Okta, Azure AD, or Keycloak.
- The built-in and federated paths share the same `UserDirectoryPort`, so user management (search, archive, MFA status) works identically regardless of the identity provider.

### Negative

- More investment required in the built-in auth than a typical "bootstrap auth" approach. Security vulnerabilities in the built-in auth are platform security issues.
- The `BuiltinIdentityProvider` must be maintained and security-patched as threat models evolve (WebAuthn, passkeys, etc.).

### Neutral

- The built-in auth does not support all features of mature IdPs (e.g., conditional access policies, hardware security key enforcement). These gaps are documented in the capability matrix (`getMetadata().capabilities`).

## Alternatives Considered

### Built-in auth as development-only bootstrap

A simple dev auth with no production hardening, expected to be replaced by SSO before production. Rejected because the platform's primary users are small-to-medium self-hosted deployments that will never set up a separate IdP.

### Separate auth service (Auth0, Supabase Auth, Keycloak)

Delegate auth entirely to an external service. Rejected because it introduces an external dependency for every deployment, conflicts with the platform's self-hosted value proposition, and the platform cannot guarantee the external service's availability or data residency.

## References

- `packages/adapters/identity-builtin/src/identity-provider.adapter.ts`
- `packages/ports/identity/src/identity-provider.port.ts`
- `objectives/05-identity-auth-user-directory.md`
