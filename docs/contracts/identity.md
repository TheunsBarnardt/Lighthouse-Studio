# Contract: Identity Ports

**Package:** `@platform/ports-identity`

## Purpose

Provides authentication, user management, session lifecycle, and multi-factor authentication as
composable ports. The key architectural split is:

- `IdentityProviderPort` — authenticates a credential and returns a `VerifiedIdentity`. It never
  creates or mutates platform user records.
- `UserDirectoryPort` — manages the platform's user table, always backed by the installation's own
  database (not the external provider).
- `SessionPort` — creates and manages server-side sessions after a successful sign-in.
- `MfaPort` — manages MFA enrollment and challenge flows, independent of the provider.

This split means the platform can front any external identity provider (OIDC, SAML, OAuth) while
maintaining a single authoritative user table and session store that it fully controls.

---

## Key Types

```typescript
type VerifiedIdentity = {
  subject: string; // Provider-scoped unique identifier (e.g. OIDC 'sub')
  email?: string;
  emailVerified: boolean;
  displayName?: string;
  claims: Record<string, unknown>; // Full raw claims from the provider
  providerId: string; // Which provider produced this (e.g. 'google', 'okta', 'local')
};

type IdentityFeature = 'password' | 'magic_link' | 'oauth' | 'oidc' | 'saml' | 'mfa_totp' | 'mfa_webauthn' | 'mfa_sms' | 'self_service_signup' | 'self_service_password_reset';

type SignInInput = { kind: 'password'; email: string; password: string } | { kind: 'magic_link'; email: string; redirectUrl: string } | { kind: 'oauth'; providerId: string; redirectUrl: string } | { kind: 'oidc'; providerId: string; redirectUrl: string } | { kind: 'saml'; providerId: string; redirectUrl: string };

type SignInCompletion = { kind: 'magic_link'; token: string } | { kind: 'oauth'; code: string; state: string } | { kind: 'oidc'; code: string; state: string } | { kind: 'saml'; samlResponse: string; relayState: string };

// beginSignIn for redirect-based flows returns a URL; for password it returns null
// (authentication completes synchronously in completeSignIn for password flows)
type SignInChallenge = { kind: 'redirect'; url: string } | { kind: 'mfa_required'; mfaToken: string } | { kind: 'complete'; identity: VerifiedIdentity };
```

---

## Methods

### IdentityProviderPort

#### `beginSignIn(input: SignInInput, ctx: RequestContext): Promise<Result<SignInChallenge, IdentityError>>`

Initiates a sign-in. For redirect-based flows (OAuth, OIDC, SAML, magic link), returns
`{ kind: 'redirect', url }` — the caller must redirect the user's browser to this URL. For password
flows, performs authentication immediately and returns `{ kind: 'complete', identity }` or
`{ kind: 'mfa_required', mfaToken }`.

**Pre-conditions:** `supports(input.kind)` returns `true`. For OAuth/OIDC/SAML, the provider is
configured in the installation's identity settings.
**Post-conditions:** For redirect flows, state is stored (in-memory or short-lived DB record) to
validate the callback. No platform user record is created or modified.
**Invariants:** `IdentityProviderPort` never writes to the platform's `users` table. Creating the
platform user on first sign-in is the responsibility of the auth service layer, not this port.

#### `completeSignIn(completion: SignInCompletion, ctx: RequestContext): Promise<Result<SignInChallenge, IdentityError>>`

Handles the callback leg of a redirect-based flow, or an MFA completion. Returns either
`{ kind: 'complete', identity }` or another `{ kind: 'mfa_required' }` challenge if a second factor
is configured.

**Pre-conditions:** For redirect flows, the `state` parameter must match what was stored in
`beginSignIn`. Magic-link tokens must not be expired (TTL: 15 minutes).
**Post-conditions:** State stored in `beginSignIn` is consumed (single use). Returns a
`VerifiedIdentity` on success — caller is responsible for looking up or creating the platform user.
**Invariants:** A magic-link token can be used exactly once. Re-use returns `IdentityError` with code
`TOKEN_INVALID`.

#### `verifyToken(token: string, ctx: RequestContext): Promise<Result<VerifiedIdentity, IdentityError>>`

Verifies a short-lived access token (JWT or opaque) previously issued by this provider. Used by
the API gateway on every authenticated request to check token validity without a full sign-in round
trip.

**Pre-conditions:** Token is non-empty.
**Post-conditions:** Returns the `VerifiedIdentity` encoded in the token if valid and not expired.
Returns `IdentityError` with code `TOKEN_EXPIRED` or `TOKEN_INVALID` otherwise. Never returns a
partial identity.
**Invariants:** Token verification must not have side effects (no session updates, no audit events).
Keep this path fast — it runs on every API request.

#### `signOut(token: string, ctx: RequestContext): Promise<Result<void, IdentityError>>`

Revokes the token at the provider level (e.g., OIDC end-session endpoint, internal blacklist for
local auth). For providers that do not support server-side revocation, returns `ok(undefined)`
immediately — the session will expire naturally via TTL.

**Post-conditions:** Subsequent `verifyToken` calls with the same token return `TOKEN_INVALID`.
Callers must also call `SessionPort.revoke` to invalidate the platform-side session.

#### `supports(feature: IdentityFeature): boolean`

Synchronous. Adapters must not return `true` for a feature they cannot fulfil end-to-end.

---

### UserDirectoryPort

Manages the platform's canonical user records. Always reads from and writes to the installation's
own database — not the external identity provider's store.

#### `listUsers(filter: UserFilter, page: Page, ctx: RequestContext): Promise<Result<PaginatedResult<PlatformUser>, PersistenceError>>`

#### `findById(id: string, ctx: RequestContext): Promise<Result<PlatformUser | null, PersistenceError>>`

#### `findByEmail(email: string, ctx: RequestContext): Promise<Result<PlatformUser | null, PersistenceError>>`

Lookup is case-insensitive. Returns `null` if no user with that email exists.

#### `create(input: CreateUserInput, ctx: RequestContext): Promise<Result<PlatformUser, PersistenceError>>`

**Pre-conditions:** `input.email` is unique (case-insensitive). `ctx` carries sufficient privilege
(system or workspace owner) — the method does not re-check authz; the service layer must.
**Post-conditions:** User exists with `status: 'active'`, `version: 1`, and timestamps set.
**Invariants:** `id` is generated by the platform (UUID), not sourced from the external provider.
The provider's `subject` is stored in a separate `providerLinks` child table.

#### `update(input: { id: string; expectedVersion: number; changes: Partial<PlatformUser> }, ctx: RequestContext): Promise<Result<PlatformUser, PersistenceError | ConflictError>>`

Uses optimistic locking identical to `RepositoryPort`. See persistence contract for version mismatch
semantics.

#### `archive(id: string, expectedVersion: number, ctx: RequestContext): Promise<Result<void, PersistenceError | ConflictError>>`

Soft-deletes the user. Existing sessions should be revoked by the service layer before calling this.

#### `assignRole(userId: string, role: string, workspaceId: string, ctx: RequestContext): Promise<Result<void, PersistenceError>>`

**Invariants:** Role assignment is workspace-scoped. Assigning a role the user already holds is
idempotent (returns `ok`).

#### `removeRole(userId: string, role: string, workspaceId: string, ctx: RequestContext): Promise<Result<void, PersistenceError>>`

Removing a role that the user does not hold is idempotent.

#### `listByWorkspace(workspaceId: string, page: Page, ctx: RequestContext): Promise<Result<PaginatedResult<PlatformUser>, PersistenceError>>`

---

### SessionPort

#### `create(input: CreateSessionInput, ctx: RequestContext): Promise<Result<Session, PersistenceError>>`

`CreateSessionInput` includes `userId`, `workspaceId`, `providerId`, `ipAddress`, `userAgent`, and
an optional `expiresAt`. If `expiresAt` is omitted, the adapter applies the installation's default
TTL (typically 24 hours for web sessions, 90 days for API tokens).

**Post-conditions:** Session is persisted. The returned `Session` includes an opaque `token` that
callers can store in a cookie or return as a Bearer token.

#### `findById(id: string, ctx: RequestContext): Promise<Result<Session | null, PersistenceError>>`

#### `refresh(id: string, ctx: RequestContext): Promise<Result<Session, PersistenceError | IdentityError>>`

Extends the session's `expiresAt` by the installation's refresh window. Returns
`IdentityError(TOKEN_EXPIRED)` if the session has already expired and is past the refresh grace
period.

**Invariants:** Refresh is only valid within the grace period after expiry. Expired sessions outside
the grace period must be revoked, not refreshed.

#### `revoke(id: string, ctx: RequestContext): Promise<Result<void, PersistenceError>>`

Marks the session as revoked. Subsequent `findById` calls return `null`.

#### `listByUser(userId: string, ctx: RequestContext): Promise<Result<Session[], PersistenceError>>`

Returns all non-revoked sessions for the user across all workspaces. Used by the security dashboard.

---

### MfaPort

#### `beginEnroll(userId: string, method: 'totp' | 'webauthn' | 'sms', ctx: RequestContext): Promise<Result<MfaEnrollmentChallenge, IdentityError>>`

Starts the enrollment flow. Returns a challenge containing setup data (e.g., a TOTP provisioning URI
or a WebAuthn credential creation options object).

**Pre-conditions:** `supports('mfa_' + method)` is `true`. User does not already have an active
enrollment for this method (returns `IdentityError(UNKNOWN)` with a descriptive message if so).

#### `completeEnroll(userId: string, enrollmentId: string, response: MfaEnrollmentResponse, ctx: RequestContext): Promise<Result<MfaCredential, IdentityError>>`

Verifies the user's first-use response to confirm enrollment is working. Activates the credential.

#### `beginChallenge(mfaToken: string, ctx: RequestContext): Promise<Result<MfaChallenge, IdentityError>>`

Produces a challenge for a mid-sign-in MFA step. `mfaToken` is the token returned by
`completeSignIn` when `kind: 'mfa_required'`.

#### `completeChallenge(challengeId: string, response: MfaResponse, ctx: RequestContext): Promise<Result<VerifiedIdentity, IdentityError>>`

Validates the user's MFA response. Returns the `VerifiedIdentity` on success so the auth service
can proceed to session creation.

**Invariants:** A challenge can only be attempted 5 times; subsequent attempts return
`ACCOUNT_LOCKED` without incrementing the counter further.

#### `revoke(userId: string, credentialId: string, ctx: RequestContext): Promise<Result<void, IdentityError>>`

Permanently removes a registered MFA credential. The user loses the ability to sign in with that
factor until they re-enroll.

---

## Capability Flags

| Feature                       | Local (built-in)           | OIDC           | SAML           | OAuth 2.0 |
| ----------------------------- | -------------------------- | -------------- | -------------- | --------- |
| `password`                    | yes                        | no             | no             | no        |
| `magic_link`                  | yes                        | no             | no             | no        |
| `oauth`                       | no                         | no             | no             | yes       |
| `oidc`                        | no                         | yes            | no             | no        |
| `saml`                        | no                         | no             | yes            | no        |
| `mfa_totp`                    | yes                        | delegated      | delegated      | delegated |
| `mfa_webauthn`                | yes                        | delegated      | delegated      | no        |
| `mfa_sms`                     | yes (requires SMS adapter) | delegated      | delegated      | no        |
| `self_service_signup`         | yes                        | depends on IdP | depends on IdP | no        |
| `self_service_password_reset` | yes                        | no             | no             | no        |

"delegated" means the feature is handled by the upstream IdP; the platform's `MfaPort` is not
invoked.

---

## Performance Expectations

- `verifyToken`: must complete in < 5 ms for local JWT verification (no network call). Remote
  introspection (OIDC `userinfo`) is cached with a 60-second TTL.
- `SessionPort.findById`: < 5 ms with a primary-key lookup.
- `UserDirectoryPort.findByEmail`: < 10 ms; requires a unique index on `lower(email)`.
- `MfaPort.completeChallenge`: < 100 ms including TOTP time-window check or WebAuthn assertion
  verification.

---

## Known Adapter Divergences

**Local (built-in) adapter**
Full support for password, magic link, TOTP, WebAuthn. SMS requires a separately configured SMS
delivery adapter. The local adapter stores hashed passwords using Argon2id.

**OIDC adapter**
`beginSignIn` redirects to the IdP's authorization endpoint. `verifyToken` calls the IdP's JWKS
endpoint on first use and caches keys; key rotation is handled by polling the JWKS URI on a
configurable interval. `signOut` calls the IdP's end-session endpoint if advertised in discovery.

**SAML adapter**
`verifyToken` is not applicable (SAML does not issue tokens the platform can independently verify
post-session). Once the SAML assertion is exchanged for a platform session, `SessionPort` handles
all subsequent token verification. `supports('mfa_totp')` returns `false` even if the IdP does
TOTP — the platform defers MFA entirely to the IdP in SAML flows.

**OAuth 2.0 adapter**
Only suitable for social login (GitHub, Google, etc.) where the platform does not control the
user directory. `self_service_signup` is `false`; account creation is triggered by the service
layer on first successful `completeSignIn`.

---

## Usage Examples

```typescript
// Password sign-in, full flow
const challenge = await idp.beginSignIn({ kind: 'password', email, password }, ctx);
if (challenge.isErr()) return err(mapIdentityError(challenge.error));

if (challenge.value.kind === 'mfa_required') {
  // Return mfaToken to the client; client calls /auth/mfa/challenge
  return ok({ mfaRequired: true, mfaToken: challenge.value.mfaToken });
}

// challenge.value.kind === 'complete'
const { identity } = challenge.value;
let user = await users.findByEmail(identity.email!, ctx);
if (!user) {
  user = await users.create({ email: identity.email!, displayName: identity.displayName }, ctx);
}
const session = await sessions.create({ userId: user.id, providerId: identity.providerId, ... }, ctx);
return ok(session);

// Capability check before offering a feature
if (!idp.supports('magic_link')) {
  return err(new NotSupportedError('Magic link sign-in is not configured'));
}
```

---

## Common Misuse

- **Creating platform users inside `IdentityProviderPort`.** The provider port authenticates only.
  User creation belongs to the auth service layer. Violating this couples provider-specific logic
  to the platform user model.
- **Skipping `SessionPort.revoke` when calling `signOut`.** The provider-side token may be
  invalidated, but the platform session remains valid until it expires. Both must be revoked.
- **Calling `verifyToken` on SAML flows.** SAML assertions are not tokens; after the assertion is
  consumed, use `SessionPort.findById` for all subsequent request validation.
- **Forgetting to consume state in `completeSignIn`.** If the adapter doesn't delete the state
  stored during `beginSignIn`, replay attacks are possible on OAuth/OIDC callbacks.
- **Treating `MfaPort` as a second password.** TOTP codes are time-bound and one-time-use. The
  adapter must reject a code that was already used within its validity window.
- **Role assignment without workspace scope.** `assignRole` is always workspace-scoped; passing
  an empty or null `workspaceId` is a bug and should be caught by the adapter's input validation.
