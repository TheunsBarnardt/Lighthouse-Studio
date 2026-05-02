# Objective 5: Identity, Auth, and User Directory

**Status:** Ready for development
**Prerequisites:** Objectives 1, 1.5, 2, 3, 4 family complete
**Blocks:** Multi-tenancy enforcement (Objective 6), every feature that requires authenticated users (which is all of them)

---

## 1. Purpose

Implement the platform's identity layer in two complementary halves:

1. **The User Directory**: a database-backed registry of users in the installation. Users have profiles, settings, MFA secrets, recovery codes, and audit history. The User Directory lives in whichever database the customer chose (Postgres, MSSQL, or MongoDB). It uses the persistence layer built in Objective 4 family.

2. **The Identity Provider system**: pluggable adapters that _verify_ who someone is. The default is the platform's own built-in auth (the Supabase-clone auth feature). Alternative adapters cover Entra ID, generic OIDC, generic SAML — for enterprise customers who already have an IdP.

These two halves connect via the `IdentityProviderPort` and `UserDirectoryPort` defined in Objective 1.5. A user signs in via their identity provider; the platform looks up (or creates) a corresponding User Directory record; that user record is what every other system in the platform refers to.

This is the auth layer — but importantly, **the built-in auth provider is itself a feature of the data management module**. When a customer uses the platform's Supabase-clone capability to manage data, they're using the same auth system. There is no separate "platform auth" and "feature auth" — there is one auth, configured per installation, available both to platform-internal users and to applications the customer builds on top.

---

## 2. Scope

### In Scope

- `UserDirectoryPort` and its three database adapter implementations (Postgres, MSSQL, Mongo)
- `IdentityProviderPort` and its initial adapter implementations:
  - Built-in auth (the Supabase-clone auth — email/password, magic link, OAuth providers)
  - Entra ID (Microsoft enterprise)
  - Generic OIDC (any standards-compliant IdP)
  - Generic SAML 2.0 (older enterprise IdPs)
- `SessionPort` and adapters (database-backed sessions for built-in; token-based for federated)
- `MfaPort` and adapter (TOTP, recovery codes; WebAuthn deferred to a follow-up)
- Password storage: argon2id with appropriate parameters
- Email verification flows
- Password reset flows
- Account lockout and rate limiting on auth endpoints
- Audit events for every auth action
- Session refresh, revocation, and expiry
- "Bring your own IdP": configuration-driven IdP selection
- Workspace-level IdP override (an enterprise customer can configure different workspaces with different IdPs — e.g., one for employees on Entra, one for contractors on built-in auth)
- Conformance test suite for identity and user directory ports
- Operational runbooks for identity issues
- ADRs

### Out of Scope (Belongs to Later Objectives)

- WebAuthn / Passkeys (significant addition; deferred)
- Step-up authentication (re-auth for sensitive operations) — deferred until features need it
- Service accounts / API tokens for machine-to-machine — separate objective
- Workspace permissions and roles (Objective 6: RBAC)
- The data management module's UI for managing users (Data Management Module objective)
- LDAP authentication (cover via the OIDC adapter where possible; native LDAP if a customer demands it)
- Social login providers as separate adapters (Google, GitHub, etc. — handled via OIDC)
- Built-in auth UI screens (login page, signup page) — those are part of the web app objective; this objective produces the engine

---

## 3. Locked Decisions

| Decision                       | Choice                                                                                                                  | Rationale                                                                                          |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Password hashing               | argon2id (libsodium / `@node-rs/argon2`)                                                                                | Modern, side-channel resistant, recommended by OWASP                                               |
| Argon2 parameters              | memory 64MB, iterations 3, parallelism 4 (calibrate per server)                                                         | Balances security and login latency; tunable per deployment                                        |
| Session storage (built-in)     | Database-backed via UserDirectoryPort's session table                                                                   | Works on all three databases; revocable; queryable                                                 |
| Session token format           | Opaque random 256-bit token (base64url) stored as hash; reference token sent to client                                  | Standard pattern; no secrets in tokens; revocation works                                           |
| Session lifetime               | 30 days default rolling, configurable per installation                                                                  | Balance UX and security; admin can shorten                                                         |
| Federated session format       | Same opaque token wrapping the federated subject claim                                                                  | Uniform session layer regardless of IdP                                                            |
| MFA (initial)                  | TOTP (RFC 6238) + recovery codes                                                                                        | Universal; works without external services                                                         |
| MFA library                    | `otpauth` for TOTP, native crypto for recovery codes                                                                    | Maintained, simple, audited                                                                        |
| Recovery codes                 | 10 codes, 8-digit numeric, single-use, hashed at rest                                                                   | Standard pattern                                                                                   |
| OAuth/OIDC client              | `openid-client` (npm) — the de facto Node.js OIDC library                                                               | Spec-correct, widely deployed, maintained                                                          |
| SAML library                   | `node-saml` (or `samlify`) — evaluated at implementation time                                                           | Both have rough edges; tested for interop                                                          |
| OAuth providers (built-in IdP) | Configurable; Google, GitHub, Microsoft (consumer), Apple as initial set                                                | Most common; OIDC under the hood                                                                   |
| Email verification             | Required before sign-in completes                                                                                       | Standard security practice                                                                         |
| Password reset                 | Token-based; tokens are 256-bit random, single-use, 1-hour expiry, hashed at rest                                       | Standard pattern                                                                                   |
| Password requirements          | Minimum 12 characters; checked against haveibeenpwned via k-anonymity API                                               | Length over complexity; HIBP catches the worst cases                                               |
| Account lockout                | 5 failed attempts → 15 minute lockout; sliding window                                                                   | Tuned to inconvenience attackers without locking out forgetful users; per-IP additional rate limit |
| Rate limiting                  | Per-IP and per-account; both required                                                                                   | Defends both vectors                                                                               |
| Identity claim format          | `subject` (provider-namespaced ID) + `email` + `email_verified` + provider-specific claims                              | Standard; consumers don't depend on provider-specific fields                                       |
| User directory schema          | Minimal core (id, email, display_name, status, mfa_state, timestamps) + extension columns/fields per adapter capability | Same shape across all three databases                                                              |
| Email enumeration prevention   | "If an account exists, an email was sent" — same response regardless                                                    | OWASP standard                                                                                     |
| TLS for IdP communication      | Required; certificate validation strict                                                                                 | Identity tokens must not be man-in-the-middled                                                     |
| State/nonce/PKCE               | All required for OAuth flows; nothing stored in URL params                                                              | OWASP and OAuth 2.1 compliance                                                                     |
| Logout behavior                | Local logout invalidates session; SSO logout (RP-Initiated) optional per IdP config                                     | Some IdPs support back-channel logout; some don't; configurable                                    |

---

## 4. Architectural Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                        SERVICE LAYER                                  │
│                                                                       │
│   AuthService (sign-in, sign-up, MFA challenge, password reset, ...)  │
│   UserService (user CRUD, profile, settings, account state)           │
│                                                                       │
└─────────────┬───────────────────────┬─────────────────────────────────┘
              │                       │
              ▼                       ▼
   ┌──────────────────┐     ┌────────────────────┐
   │ IdentityProvider │     │  UserDirectoryPort  │
   │      Port         │     │                     │
   │                   │     └──────┬─────────────┘
   │ verifyToken,      │            │
   │ beginSignIn,      │            │ implemented by
   │ completeSignIn... │            ▼
   └──────┬───────────┘     ┌────────────────────┐
          │                  │ Persistence ports  │
          │                  │ (Postgres / MSSQL / │
          │                  │  Mongo via 4 family)│
          │                  └────────────────────┘
          ▼
   ┌────────────────────────────────────────────────┐
   │         IdentityProvider adapters               │
   │                                                  │
   │  identity-builtin    │  identity-entra          │
   │  ─────────────       │  ─────────────           │
   │  Email + password    │  Entra ID OIDC           │
   │  Magic link          │                           │
   │  OAuth (Google, etc) │  identity-oidc           │
   │  TOTP / Recovery     │  ─────────────           │
   │                       │  Generic OIDC IdP       │
   │  identity-saml       │                           │
   │  ─────────────       │                           │
   │  SAML 2.0 SP         │                           │
   └────────────────────────────────────────────────┘
```

**Key invariant:** every authenticated user in the platform has a User Directory record, regardless of which IdP verified them. The identity provider is _who you are externally_; the User Directory record is _who you are inside the platform_.

When a user signs in via Entra, the platform either looks up an existing User Directory record by `(provider_id, subject)` pair, or — if the workspace's IdP config allows it — creates one on first sign-in (just-in-time provisioning).

---

## 5. The Hard Parts (Read This Before Coding)

These are the design decisions that have the most leverage on later complexity.

**5.1 The Identity ↔ User Directory mapping**

A user has zero or more identities (provider, subject pairs) that map to one User Directory record. This means:

- A user can have built-in auth credentials AND link their Entra account
- An organization migrating from built-in auth to Entra can link existing users instead of recreating them
- A user can sign in via different providers and end up at the same account

The mapping table (in the User Directory's database) is `user_identities`:

```
user_identities (
  user_id UUID FK to users,
  provider_id varchar,       // 'builtin', 'entra', 'oidc:<config_name>', 'saml:<config_name>'
  subject varchar,             // the IdP's user identifier
  email varchar,
  email_verified boolean,
  metadata json,
  primary boolean,             // is this the primary identity?
  created_at timestamp,
  last_used_at timestamp,
  PRIMARY KEY (provider_id, subject),
  UNIQUE (user_id, provider_id) -- a user has at most one identity per provider
)
```

This pattern is what every modern auth system uses (Auth0, Clerk, WorkOS, Supabase). It's also what makes "linking accounts" work cleanly.

**5.2 Just-in-time provisioning vs. pre-provisioning**

Two modes per workspace:

- **Pre-provisioning**: an admin creates the User Directory record first; the user can then sign in via their IdP. Sign-ins from unrecognized identities are rejected.
- **Just-in-time (JIT)**: a sign-in from an unrecognized identity creates a new User Directory record automatically. Common for OIDC/SAML in enterprise.

JIT is configurable per IdP per workspace. The default is pre-provisioning for built-in auth (signups happen explicitly) and JIT for federated providers (because that's what enterprises expect).

**5.3 Workspace-level IdP overrides**

A platform installation defaults to one IdP configuration. But a sophisticated customer might want:

- Workspace A (employees) uses Entra ID
- Workspace B (contractors) uses built-in auth with email/password
- Workspace C (open community) uses GitHub OAuth via OIDC

The platform supports this. Each workspace can override the default IdP. A user signing in to workspace A is verified against Entra; signing in to workspace B against built-in auth.

If a user has identities for multiple providers, they can use any of them — the routing is determined by which workspace they're trying to access.

**5.4 The "primary identity" concept**

A user can have multiple linked identities. One is the "primary" — the one used for notifications, displayed in profiles, and the one a user must verify when changing critical settings. Other identities are "linked" and can sign in but are secondary.

The user can change which identity is primary, but only after verifying the new primary.

**5.5 Email as identifier vs. subject as identifier**

Email is what humans use. Subject (the IdP-issued user ID) is what code uses. They differ:

- Email can change (a user changes their address; an Entra rename)
- Subject is stable per provider

The platform stores both but uses subject for routing. Email is a search key and a display field. Email changes don't break sessions because sessions reference user_id (internal), not email.

**5.6 Soft-delete and reactivation**

Users can be archived (soft-deleted) by admins. Archived users:

- Cannot sign in
- Their data isn't deleted (audit, attribution preserved)
- Can be restored by an admin
- After a configurable retention (default 90 days), can be hard-deleted by an admin

This is what makes GDPR right-to-erasure work without breaking referential integrity. Most data references "user X created this thing" via user_id; archived users still have their record, so attribution survives.

**5.7 The MFA enrollment path**

MFA enrollment is a flow:

1. User in their settings clicks "enable MFA"
2. Platform generates TOTP secret
3. Displays QR code; user scans with authenticator app
4. User enters a code from the app to confirm enrollment
5. Platform generates 10 recovery codes; user copies/prints them
6. MFA is now active; required on next sign-in

The enrollment flow has a 10-minute window: if the user doesn't confirm within 10 minutes, the enrollment is abandoned. Partially-enrolled state is not allowed to authenticate.

**5.8 Sign-in is a state machine**

Sign-in isn't one request — it's a multi-step state machine:

```
beginSignIn(email/oauth_init)
  → returns challenge: { type: 'password' | 'oauth_redirect' | 'magic_link_sent' | 'mfa_required' | ... }
completeSignIn(challenge_response)
  → returns: { type: 'success', session } | { type: 'mfa_required', challenge } | { type: 'failure', reason }
```

For password sign-in: beginSignIn returns a `password` challenge; the client posts the password; completeSignIn either succeeds, fails, or returns a new `mfa_required` challenge.

For OAuth/OIDC: beginSignIn returns an `oauth_redirect` URL with state and nonce; the IdP redirects back to the platform's callback; the callback handler calls completeSignIn which exchanges the code for tokens and returns success.

For magic link: beginSignIn sends an email, returns `magic_link_sent`; the user clicks the link, hitting an endpoint that internally completes the sign-in.

This state machine is the same regardless of provider. The provider determines what challenges are possible.

**5.9 Token storage on the client**

For browser-based sessions: HTTP-only, Secure, SameSite=Lax cookies. Never localStorage (XSS exposure).

For native apps and API clients: the session token is given as a Bearer token; the client stores it in OS-secure storage (Keychain, Credential Manager, etc.).

The platform server treats both identically — a session token is a session token.

**5.10 Refresh and rotation**

Sessions have a sliding expiry (touched on use). They can also be explicitly refreshed (client requests a new token before old one expires). On refresh, a new token is issued and the old one is invalidated — refresh token rotation prevents stolen tokens from outliving the legitimate session.

For OIDC sessions, refresh interacts with the IdP's refresh token. The platform stores the IdP refresh token alongside the session and uses it to extend the session lifetime. If the IdP refresh fails, the platform's session is invalidated.

**5.11 Cryptographic agility**

Password hashing (argon2id), session token entropy (256 bits), email/reset/MFA secret derivation — all parameters are versioned. A future migration to a new hashing scheme is supported without re-prompting users (verify against old, re-hash on next login).

Stored secrets include a version field. The verify function dispatches to the right algorithm.

**5.12 Single point of audit**

Every authentication event flows through `AuditPort`. Sign in, sign out, failed attempt, password change, MFA enrollment, identity link, password reset request, session creation/expiry/revocation. The audit log answers "who tried to access this account, from where, when" for forensics and compliance.

---

## 6. Component Specifications

### 6.1 UserDirectoryPort

```typescript
// packages/ports/identity/src/user-directory.port.ts

export interface UserDirectoryPort {
  /** Find a user by their internal id. */
  findById(id: string): Promise<Result<User | null, UserError>>;

  /** Find a user by an email address (any of their identities). */
  findByEmail(email: string): Promise<Result<User | null, UserError>>;

  /** Find a user by an external identity. */
  findByIdentity(providerId: string, subject: string): Promise<Result<User | null, UserError>>;

  /** Create a new user with one initial identity. */
  create(input: CreateUserInput): Promise<Result<User, UserError | ConflictError>>;

  /** Link an additional identity to an existing user. */
  linkIdentity(userId: string, identity: IdentityClaim): Promise<Result<void, UserError | ConflictError>>;

  /** Unlink an identity. The user must have at least one remaining identity. */
  unlinkIdentity(userId: string, providerId: string): Promise<Result<void, UserError>>;

  /** Update the user's profile (display name, locale, etc). */
  updateProfile(userId: string, changes: ProfileUpdate): Promise<Result<User, UserError>>;

  /** Archive (soft-delete). */
  archive(userId: string): Promise<Result<void, UserError>>;

  /** Restore an archived user. */
  restore(userId: string): Promise<Result<User, UserError>>;

  /** Hard-delete (permanent). For GDPR right-to-erasure after retention period. */
  hardDelete(userId: string): Promise<Result<void, UserError>>;

  /** Find users matching a query (for admin tools). */
  search(opts: SearchOptions): Promise<Result<PaginatedResult<User>, UserError>>;

  /** MFA management. */
  setMfaSecret(userId: string, secret: EncryptedSecret): Promise<Result<void, UserError>>;
  getMfaSecret(userId: string): Promise<Result<EncryptedSecret | null, UserError>>;
  setRecoveryCodes(userId: string, hashedCodes: string[]): Promise<Result<void, UserError>>;
  consumeRecoveryCode(userId: string, code: string): Promise<Result<boolean, UserError>>;

  /** Password storage (only used by built-in auth provider). */
  setPasswordHash(userId: string, hash: VersionedHash): Promise<Result<void, UserError>>;
  getPasswordHash(userId: string): Promise<Result<VersionedHash | null, UserError>>;
  recordFailedLogin(userId: string, ipAddress: string): Promise<Result<void, UserError>>;
  resetFailedLogins(userId: string): Promise<Result<void, UserError>>;
  isLockedOut(userId: string): Promise<Result<{ locked: boolean; until?: Date }, UserError>>;
}

export interface User {
  id: string;
  primaryEmail: string;
  emailVerified: boolean;
  displayName: string | null;
  status: 'active' | 'pending_verification' | 'archived';
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  identities: Identity[];
  mfaEnabled: boolean;
  preferences: UserPreferences;
}

export interface Identity {
  providerId: string;
  subject: string;
  email: string | null;
  emailVerified: boolean;
  primary: boolean;
  linkedAt: Date;
  lastUsedAt: Date | null;
}
```

The UserDirectoryPort is implemented per database. The Postgres adapter uses the persistence ports from Objective 4. MSSQL and Mongo similarly. Each adapter passes a conformance test suite specific to identity operations.

### 6.2 IdentityProviderPort

Already defined in Objective 1.5. Restated with implementation notes:

```typescript
// packages/ports/identity/src/identity-provider.port.ts

export interface IdentityProviderPort {
  /** Begin a sign-in flow. */
  beginSignIn(input: SignInInput): Promise<Result<SignInChallenge, IdentityError>>;

  /** Complete a sign-in flow. */
  completeSignIn(input: SignInCompletion): Promise<Result<VerifiedIdentity, IdentityError>>;

  /** Verify an existing token. */
  verifyToken(token: string): Promise<Result<VerifiedIdentity, IdentityError>>;

  /** Sign out — invalidate the session at the IdP if RP-initiated logout supported. */
  signOut(token: string): Promise<Result<void, IdentityError>>;

  /** Capability check. */
  supports(feature: IdentityFeature): boolean;

  /** Provider metadata for discovery and configuration UI. */
  getMetadata(): IdentityProviderMetadata;
}

export type IdentityFeature =
  | 'password'
  | 'magic_link'
  | 'oauth'
  | 'oidc'
  | 'saml'
  | 'mfa_totp'
  | 'mfa_webauthn'
  | 'mfa_sms'
  | 'self_service_signup'
  | 'self_service_password_reset'
  | 'rp_initiated_logout'
  | 'just_in_time_provisioning'
  | 'attribute_mapping' // SAML/OIDC custom claim mapping
  | 'group_sync'; // SAML/OIDC group membership sync
```

### 6.3 Built-in Auth Adapter (`packages/adapters/identity-builtin`)

The platform's own auth — the Supabase-clone feature.

**Capabilities:**

- `password`: yes
- `magic_link`: yes
- `oauth`: yes (configurable providers)
- `oidc`: yes (consumer of external OIDC IdPs)
- `saml`: no
- `mfa_totp`: yes
- `mfa_webauthn`: no (deferred)
- `mfa_sms`: no (cost / delivery reliability concerns)
- `self_service_signup`: yes (configurable per workspace)
- `self_service_password_reset`: yes
- `rp_initiated_logout`: yes
- `just_in_time_provisioning`: not applicable (this IS the directory)
- `attribute_mapping`: not applicable
- `group_sync`: not applicable

**Components:**

- **PasswordVerifier**: argon2id verification with version dispatch
- **TotpVerifier**: TOTP with skew tolerance
- **MagicLinkSender**: generates token, signs, emails, validates on click
- **OAuthRouter**: per-provider OAuth flow handler (uses `openid-client` for OIDC-compliant providers)
- **PasswordResetFlow**: email token, time-limited, single-use
- **EmailVerifier**: token-based email verification on signup or email change
- **AccountLockout**: per-account and per-IP rate limiting; sliding window
- **PwnedPasswordCheck**: optional, k-anonymity HIBP check on signup and password change

**The OAuth providers it supports** (initial set): Google, GitHub, Microsoft consumer (separate from Entra), Apple. Each provider config is a workspace setting; admins paste in client_id and client_secret in the data management module's UI.

**Dependencies:**

- UserDirectoryPort (for user records, password hashes, MFA secrets, recovery codes, failed login counts)
- SessionPort (for session creation)
- EmailPort (for verification, magic link, password reset)
- AuditPort (for every event)

### 6.4 Entra ID Adapter (`packages/adapters/identity-entra`)

Microsoft enterprise identity. OIDC under the hood, but with Microsoft-specific opinions and conveniences.

**Capabilities:**

- `password`: no (Entra owns the password)
- `oauth`/`oidc`: yes
- `saml`: no (Entra supports SAML, but a customer wanting SAML uses the SAML adapter explicitly)
- `mfa_*`: no (Entra owns MFA)
- `self_service_signup`: yes (Entra-controlled)
- `self_service_password_reset`: no (Entra owns the password)
- `rp_initiated_logout`: yes (back-channel logout supported)
- `just_in_time_provisioning`: yes
- `attribute_mapping`: yes (Microsoft Graph claims)
- `group_sync`: yes (groups can sync to platform workspace memberships)

**Components:**

- Wraps `openid-client` configured against the Entra discovery URL
- Tenant-aware: customer specifies their Entra tenant ID
- Optional Microsoft Graph integration for richer profile data, group sync
- Multi-tenant Entra apps supported (consumer flag)
- Signing key rotation handled automatically (openid-client refreshes JWKS)

**Configuration (per workspace if overriding default):**

```yaml
identity:
  provider: entra
  tenantId: '<tenant-uuid>'
  clientId: '<application-uuid>'
  clientSecret: '<from secret store>'
  redirectUri: '<platform callback URL>'
  scopes: ['openid', 'profile', 'email', 'User.Read', 'GroupMember.Read.All']
  attributeMapping:
    displayName: 'name'
    email: 'preferred_username'
  groupSync:
    enabled: true
    workspaceMappings:
      'engineering-group-id': 'engineering-workspace'
```

### 6.5 Generic OIDC Adapter (`packages/adapters/identity-oidc`)

For customers using IdPs that aren't Entra but do speak OIDC: Okta, Auth0, Keycloak, Google Workspace, Authelia, custom identity servers.

**Capabilities:**

- Same as Entra except provider-specific features (group sync, attribute mapping) depend on the IdP

**Configuration:**

```yaml
identity:
  provider: oidc
  issuerUrl: 'https://identity.example.co.za'
  clientId: '...'
  clientSecret: '...'
  redirectUri: '...'
  scopes: ['openid', 'profile', 'email']
  attributeMapping: { ... }
```

The adapter discovers metadata from `<issuerUrl>/.well-known/openid-configuration`. PKCE, state, nonce all required.

### 6.6 SAML 2.0 Adapter (`packages/adapters/identity-saml`)

For customers using older enterprise IdPs (ADFS, on-prem AD with SAML, Shibboleth, some PingFederate deployments).

**Capabilities:**

- `saml`: yes
- `oauth`/`oidc`: no
- `attribute_mapping`: yes (SAML attribute statements)
- `group_sync`: yes (via SAML attributes containing group lists)

**Components:**

- Acts as a SAML 2.0 Service Provider (SP)
- IdP metadata can be loaded from a URL or pasted XML
- Signed assertions required; encrypted assertions supported
- IdP-Initiated and SP-Initiated flows supported
- AuthnRequest signed; assertions verified against IdP signing certificate

**Configuration:**

```yaml
identity:
  provider: saml
  idpMetadataUrl: 'https://idp.example.co.za/metadata.xml'
  spEntityId: 'https://platform.example.co.za'
  acsUrl: 'https://platform.example.co.za/auth/saml/callback'
  signingCert: '...'
  signingKey: '<from secret store>'
  attributeMapping:
    email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'
    displayName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'
    groups: 'http://schemas.xmlsoap.org/claims/Group'
```

### 6.7 SessionPort

```typescript
export interface SessionPort {
  /** Create a new session for a user. */
  create(input: CreateSessionInput): Promise<Result<Session, SessionError>>;

  /** Look up a session by token. */
  findByToken(token: string): Promise<Result<Session | null, SessionError>>;

  /** Touch — update last_seen, sliding expiry. */
  touch(sessionId: string): Promise<Result<Session, SessionError>>;

  /** Refresh — issue a new token, invalidate the old. */
  refresh(token: string): Promise<Result<{ session: Session; newToken: string }, SessionError>>;

  /** Revoke a single session. */
  revoke(sessionId: string): Promise<Result<void, SessionError>>;

  /** Revoke all sessions for a user (e.g., on password change). */
  revokeAllForUser(userId: string): Promise<Result<void, SessionError>>;

  /** List active sessions for a user. */
  listForUser(userId: string): Promise<Result<Session[], SessionError>>;

  /** Garbage-collect expired sessions. Called by a scheduled job. */
  cleanupExpired(): Promise<Result<{ deleted: number }, SessionError>>;
}

export interface Session {
  id: string;
  userId: string;
  tokenHash: string; // never the plain token
  identityProvider: string; // 'builtin', 'entra', etc.
  workspaceId: string | null; // sessions are workspace-bound for some flows
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
}
```

The session adapter is database-backed (uses persistence ports). The token returned to the client is the plaintext value; only its hash is stored. Lookup is by hash (using a deterministic HMAC, since random hashing wouldn't be reversible from a client token).

### 6.8 MfaPort

```typescript
export interface MfaPort {
  /** Generate a new TOTP secret for enrollment. */
  generateTotpSecret(userId: string): Promise<Result<TotpEnrollment, MfaError>>;

  /** Confirm enrollment by verifying a code against the new secret. */
  confirmEnrollment(userId: string, code: string): Promise<Result<RecoveryCodes, MfaError>>;

  /** Verify a TOTP code during sign-in. */
  verifyTotp(userId: string, code: string): Promise<Result<void, MfaError>>;

  /** Verify a recovery code during sign-in. */
  verifyRecoveryCode(userId: string, code: string): Promise<Result<void, MfaError>>;

  /** Disable MFA (requires re-authentication; checked at the service layer). */
  disable(userId: string): Promise<Result<void, MfaError>>;

  /** Generate a new set of recovery codes (invalidates the old set). */
  regenerateRecoveryCodes(userId: string): Promise<Result<RecoveryCodes, MfaError>>;
}

export interface TotpEnrollment {
  secret: string; // base32 — only returned at enrollment time
  qrCodeData: string; // 'otpauth://totp/...' URI for QR code rendering
  expiresAt: Date; // enrollment window
}

export interface RecoveryCodes {
  codes: string[]; // plaintext, only returned at generation time
}
```

Stored secrets are encrypted at rest using a key from the secret store (`SecretStorePort`). Recovery codes are hashed (argon2id) at rest.

### 6.9 The Built-in Auth Schema

When the platform uses the built-in auth adapter, the User Directory schema includes additional tables for credentials. These are migrated in via the persistence layer.

```sql
-- Logical structure (translates to each database)

users (
  id uuid PK,
  primary_email varchar UNIQUE NOT NULL,
  email_verified boolean DEFAULT false,
  display_name varchar,
  status varchar NOT NULL DEFAULT 'pending_verification',
  archived_at timestamptz NULL,
  preferences json,
  -- ... standard columns
)

user_identities (
  user_id uuid FK,
  provider_id varchar,
  subject varchar,
  email varchar,
  email_verified boolean,
  primary boolean,
  linked_at timestamptz,
  last_used_at timestamptz NULL,
  metadata json,
  PRIMARY KEY (provider_id, subject)
)

user_credentials (              -- only used by built-in auth
  user_id uuid PK FK,
  password_hash varchar,         -- argon2id encoded with version prefix
  password_set_at timestamptz,
  password_must_change boolean DEFAULT false,
  failed_login_count int DEFAULT 0,
  locked_until timestamptz NULL
)

user_mfa (
  user_id uuid PK FK,
  totp_secret_encrypted varchar,
  totp_enabled boolean DEFAULT false,
  totp_enrolled_at timestamptz,
  recovery_codes_hashed json     -- array of argon2id hashes
)

email_verifications (
  token_hash varchar PK,         -- HMAC of the token
  user_id uuid FK,
  email varchar,                 -- the email being verified
  expires_at timestamptz,
  consumed_at timestamptz NULL
)

password_resets (
  token_hash varchar PK,
  user_id uuid FK,
  expires_at timestamptz,
  consumed_at timestamptz NULL,
  ip_address varchar,
  user_agent varchar
)

magic_links (
  token_hash varchar PK,
  email varchar,                 -- email the link was sent to
  expires_at timestamptz,
  consumed_at timestamptz NULL
)

sessions (
  id uuid PK,
  user_id uuid FK,
  token_hash varchar UNIQUE,
  identity_provider varchar,
  workspace_id uuid NULL,
  created_at timestamptz,
  last_seen_at timestamptz,
  expires_at timestamptz,
  ip_address varchar,
  user_agent varchar,
  metadata json
)

oauth_state_tokens (              -- short-lived, holds OAuth flow state
  token_hash varchar PK,
  state varchar,
  nonce varchar,
  pkce_verifier varchar,
  redirect_after varchar,
  expires_at timestamptz,
  consumed_at timestamptz NULL
)
```

For Mongo: the same logical structure as collections, with appropriate validators. For MSSQL: tables with appropriate types. The persistence ports abstract the differences.

### 6.10 Audit Events

Every auth action emits an audit event:

- `auth.signin.started` — user initiated sign-in
- `auth.signin.succeeded` — sign-in completed
- `auth.signin.failed` — sign-in attempt failed (with reason)
- `auth.signin.locked_out` — account or IP lockout triggered
- `auth.signout.completed`
- `auth.session.created`
- `auth.session.refreshed`
- `auth.session.revoked` (with reason: explicit, password change, admin action, expiry)
- `auth.password.set` (signup, change, reset)
- `auth.password.reset_requested`
- `auth.email.verification_sent`
- `auth.email.verified`
- `auth.email.changed`
- `auth.mfa.enrollment_started`
- `auth.mfa.enrolled`
- `auth.mfa.disabled`
- `auth.mfa.verified`
- `auth.mfa.failed`
- `auth.mfa.recovery_code_used`
- `auth.identity.linked`
- `auth.identity.unlinked`
- `auth.user.created`
- `auth.user.archived`
- `auth.user.restored`
- `auth.user.hard_deleted`

Each event carries: actor (user_id if known), target (user_id), provider, ip_address, user_agent, request_id (for tracing), and event-specific metadata.

### 6.11 Conformance Tests

Added to `packages/ports/identity/conformance/`:

**UserDirectoryPort tests:**

- Create user; find by id, email, identity
- Link a second identity; find by either
- Unlink; verify only one remains
- Cannot unlink the last identity
- Cannot have two users with the same email
- Cannot have two users sharing a (provider, subject)
- Archive; archived user not found by sign-in but found by admin search
- Restore; user is signable in again
- Hard delete; record gone, but no FK breakage (audit logs still reference the user_id, which is now orphaned-but-stable)
- MFA secret round-trip
- Recovery code consumption is single-use
- Failed login counter increments and locks out at threshold

**IdentityProviderPort (per adapter):**

- beginSignIn returns a challenge
- completeSignIn with valid challenge returns VerifiedIdentity
- completeSignIn with invalid challenge fails
- verifyToken with valid token returns VerifiedIdentity
- verifyToken with expired token returns SessionExpiredError
- signOut invalidates the session

**SessionPort:**

- Create returns plaintext token; only hash stored
- Find by token returns the session
- Touch updates last_seen_at and extends expiry
- Refresh issues new token, invalidates old
- Revoke prevents subsequent use
- Cleanup removes expired sessions

**Cross-adapter (per database):**

- All UserDirectoryPort tests pass identically against Postgres, MSSQL, Mongo
- All SessionPort tests pass identically across databases
- Audit events are equivalently structured across adapters

### 6.12 Operational Runbooks

New files in `docs/runbooks/`:

- `identity-provider-config-builtin.md` — full setup guide for the built-in auth: SMTP, OAuth provider configs, password policy
- `identity-provider-config-entra.md` — Entra ID setup: app registration, redirect URIs, secrets, group sync
- `identity-provider-config-oidc.md` — generic OIDC setup; how to discover endpoints, configure attribute mapping
- `identity-provider-config-saml.md` — SAML SP setup; metadata exchange; signing cert rotation
- `identity-troubleshooting.md` — "user can't sign in"; the diagnostic flowchart
- `identity-mfa-recovery.md` — how an admin helps a user who lost their authenticator AND their recovery codes
- `identity-account-takeover-response.md` — incident response when a user reports their account is compromised
- `identity-mass-revocation.md` — revoking all sessions for a workspace or installation (e.g., after a credential leak)
- `identity-key-rotation.md` — rotating signing keys, password hashing parameters, encryption keys for stored secrets

---

## 7. Implementation Order

1. **UserDirectoryPort interface and conformance suite.** Build the contract first, since adapters depend on it.

2. **UserDirectoryPort adapters for all three databases.** Built on the persistence ports from Objective 4 family. Each adapter passes the conformance suite.

3. **SessionPort interface, adapter, and conformance.** Same pattern: one port, three database-backed adapters via the persistence layer.

4. **MfaPort interface, adapter, and conformance.** TOTP via `otpauth`; recovery codes generated and hashed; database-backed via UserDirectoryPort.

5. **The built-in auth adapter** (`identity-builtin`):

   - PasswordVerifier (argon2id with version dispatch)
   - Email verification flow
   - Password reset flow
   - Magic link flow
   - Account lockout and rate limiting
   - HIBP password check (k-anonymity API)
   - Each component built and tested in isolation, then integrated

6. **OAuth provider integration in the built-in adapter.** Using `openid-client` for Google, GitHub, Microsoft consumer, Apple. Each provider as a config; flows tested end-to-end with sandbox accounts.

7. **The Entra ID adapter.** OIDC under the hood; Microsoft-specific extensions (Graph claims, group sync). Tested against a real Entra tenant (Microsoft offers free dev tenants).

8. **The Generic OIDC adapter.** Tested against Keycloak (self-hostable; runs in dev Compose).

9. **The SAML adapter.** Tested against SimpleSAMLphp (self-hostable test IdP) and ADFS lab.

10. **Audit events emitted from every auth action.** Already covered by AuditPort from Objective 7 (or its earlier scaffolding).

11. **Workspace-level IdP overrides:** the workspace settings include an optional IdP config; the AuthService routes sign-in based on workspace.

12. **Identity linking flow:** UI doesn't exist yet, but the service layer methods do; tested via the conformance suite.

13. **Operational scripts:**

    - Scheduled session cleanup job (uses JobQueuePort or SchedulerPort)
    - Scheduled cleanup of expired email verifications, password resets, magic links, OAuth state tokens
    - Per-user "list active sessions" capability for the data management module's UI later

14. **Observability:** auth-specific metrics — sign-in success rate, MFA usage, locked-out accounts, OAuth flow completion rate, etc.

15. **Write all runbooks.**

16. **Write ADRs.**

17. **Run a security review** — internal first, ideally external before any production deployment. This is the most attacker-targeted code in the platform.

18. **Verify Definition of Done.**

---

## 8. ADRs to Write

- **ADR-0052: Identity Provider vs. User Directory Separation** — why two ports, how they connect, what enables what
- **ADR-0053: argon2id with Versioning** — parameters, why not bcrypt, migration story
- **ADR-0054: Database-Backed Sessions over JWT** — why opaque tokens with revocable backing store, vs. stateless JWTs
- **ADR-0055: TOTP and Recovery Codes for MFA** — why these first, why WebAuthn deferred
- **ADR-0056: Built-in Auth as a First-Class Feature, Not a Default** — the platform's auth IS the data management module's auth; same code path
- **ADR-0057: Just-in-Time vs. Pre-Provisioning** — workspace-level configuration; defaults; security implications
- **ADR-0058: Email Enumeration Prevention** — uniform responses; trade-offs with UX
- **ADR-0059: Password Policy Choice** — length over complexity, HIBP check, rationale

---

## 9. Verification Steps

1. **All UserDirectoryPort conformance tests pass** on all three database adapters.

2. **All SessionPort conformance tests pass** on all three database adapters.

3. **All MfaPort conformance tests pass.**

4. **All IdentityProviderPort conformance tests pass** for the built-in adapter.

5. **OAuth flow with at least one external provider (Google or GitHub) works end-to-end** against the real IdP.

6. **Entra ID flow works** against a real Entra tenant (free dev tenant).

7. **OIDC flow works** against a self-hosted Keycloak.

8. **SAML flow works** against SimpleSAMLphp test IdP.

9. **Email verification works.** Sign up; verify email arrives at MailHog (dev SMTP); click link; account is verified.

10. **Password reset works.** Request reset; email arrives; click link; set new password; old sessions revoked.

11. **Magic link works.** Request link; email arrives; click link; signed in.

12. **MFA enrollment, challenge, and verification all work.**

13. **Recovery code consumption is single-use.** Try to use a code twice; second attempt fails.

14. **Account lockout fires.** Five failed sign-ins → account locked for 15 minutes; sign-in attempts return appropriate error.

15. **Per-IP rate limiting** blocks rapid-fire attempts even with correct credentials.

16. **Email enumeration prevention.** Sign-in attempt with non-existent email returns the same response shape as wrong password.

17. **Identity linking works.** Sign in with built-in auth; link an Entra identity; sign out; sign in via Entra; same user account.

18. **Workspace-level IdP override works.** Configure workspace A with built-in, workspace B with Entra; users access each via the appropriate flow.

19. **JIT provisioning works (when enabled).** Sign in via Entra with a brand-new identity; user is created; subsequent sign-ins find the existing user.

20. **Session refresh and revocation work.**

21. **Mass revocation works.** Trigger "revoke all sessions for user X"; all their tokens become invalid immediately.

22. **Audit events flow.** Every action above produces an audit entry visible in the audit log.

23. **HIBP password check** rejects known-pwned passwords.

24. **TLS enforced** on all IdP communication.

25. **Cryptographic agility verified.** Manually change argon2id parameters; old hashes still verify; new hashes use new params; on next login, hash is rotated.

26. **No secrets logged.** Audit logs and application logs do not contain plaintext passwords, magic link tokens, OAuth code values, MFA secrets, or session tokens. Verified by gitleaks-style scanning of test logs.

27. **Internal security review completed.** Threat model documented; OWASP ASVS 4.0 Level 2 controls verified.

If all 27 pass, the objective is met.

---

## 10. Definition of Done

**Ports and Conformance**

- [ ] `UserDirectoryPort` defined with full contract
- [ ] `SessionPort` defined with full contract
- [ ] `MfaPort` defined with full contract
- [ ] `IdentityProviderPort` (from Objective 1.5) refined with implementation context
- [ ] Conformance suites for all four ports
- [ ] All conformance tests pass against Postgres, MSSQL, Mongo (where applicable)

**Adapters**

- [ ] Built-in auth adapter (`identity-builtin`)
- [ ] Entra ID adapter
- [ ] Generic OIDC adapter
- [ ] SAML 2.0 adapter
- [ ] UserDirectoryPort + SessionPort + MfaPort adapters per database

**Built-in Auth Features**

- [ ] Email/password
- [ ] Magic link
- [ ] OAuth: Google, GitHub, Microsoft consumer, Apple (configurable)
- [ ] Email verification
- [ ] Password reset
- [ ] HIBP password check
- [ ] Account lockout and rate limiting (per-account and per-IP)
- [ ] TOTP MFA enrollment, challenge, recovery codes
- [ ] Identity linking and unlinking
- [ ] Workspace-level IdP override

**Federated Auth Features**

- [ ] Entra ID end-to-end with attribute mapping and group sync
- [ ] OIDC end-to-end with PKCE, state, nonce
- [ ] SAML 2.0 end-to-end with signed assertions
- [ ] JIT provisioning (configurable per workspace per IdP)
- [ ] RP-initiated logout where supported

**Security**

- [ ] Argon2id with versioning and parameter calibration
- [ ] All secrets at rest encrypted via SecretStorePort key
- [ ] All tokens at rest stored only as hashes
- [ ] Email enumeration prevention
- [ ] TLS enforced on all IdP communication
- [ ] OAuth 2.1 / OIDC compliance verified (PKCE, state, nonce, signing keys)
- [ ] SAML signing cert validation strict
- [ ] Internal security review completed
- [ ] Threat model documented

**Observability**

- [ ] Auth-specific metrics emitted (sign-in rate, MFA usage, lockouts, OAuth completion)
- [ ] Audit events emitted for every action
- [ ] Grafana panels for auth health
- [ ] Alerts on suspicious patterns (lockout spike, unusual sign-in geographies, etc.)

**Operational**

- [ ] All runbooks in Section 6.12 written
- [ ] Scheduled cleanup jobs for expired tokens running
- [ ] Mass revocation tooling tested
- [ ] Key rotation procedure documented and tested

**Documentation**

- [ ] ADRs 0052–0059 written and Accepted
- [ ] Per-adapter README explaining configuration and operational concerns
- [ ] User-facing documentation drafted (will be expanded by the Data Management Module objective)

**Verification**

- [ ] All 27 verification steps in Section 9 pass

---

## 11. Anti-Patterns to Refuse

- **Storing passwords in any form other than argon2id with versioning.** No bcrypt-only, no SHA-anything, no encrypted-only.
- **Storing session tokens in plaintext.** Only hashes. The plaintext exists in transit only.
- **Logging credentials, tokens, MFA codes, magic link values, OAuth codes.** Ever. Even at debug. Even temporarily.
- **Skipping email enumeration prevention.** "An attacker probably already knows the email" is not a defense; signup forms reveal too much.
- **Trusting unsigned SAML assertions or unverified OIDC tokens.** Always verify signatures; always validate issuer; always check audience.
- **Reusing OAuth state values or skipping nonce checks.** These are how CSRF and replay attacks happen.
- **Keeping the default OAuth scope at `openid`.** Without `email` you can't identify the user; without `profile` you can't show a name.
- **Implementing "remember me" by extending session lifetime indefinitely.** Use refresh tokens; rotate them.
- **Allowing weak passwords because UX.** Length over complexity; HIBP check is mandatory; the policy is conservative.
- **Letting MFA enrollment partially complete.** Atomic enrollment or none.
- **Building "magic link login" without rate limiting per email.** Spam vector and account takeover vector.
- **Treating archived users as "almost deleted" — letting them sign in if "the system gets confused."** Archived means cannot sign in. Period.
- **Rolling our own crypto.** Use libsodium / native crypto / openid-client / node-saml. Don't write key derivation, signature verification, or encryption from scratch.
- **Skipping the security review.** This is the highest-risk code in the platform. External review before production is non-negotiable.

---

## 12. Open Questions for Confirmation Before Starting

1. **WebAuthn deferred** — confirmed acceptable? It's increasingly important for enterprise sales. I'd recommend adding WebAuthn as a follow-up objective immediately after this one rather than waiting for the data management module.

2. **Apple OAuth in initial set** — Apple's OAuth is fiddly (requires JWT-based client secrets, has periodic key rotation requirements). Worth including in v1 or defer to a follow-up?

3. **HIBP integration via k-anonymity API** — defaults to enabled. Network call on every password set. Acceptable, or should it be opt-in?

4. **Argon2id parameters** — proposing memory 64 MB, iterations 3, parallelism 4 as starting point. These cause ~150-300ms login latency on a typical server. Tune based on server capacity at deployment time. The runbook covers this.

5. **Session lifetime default** — proposing 30 days rolling. Some products use 14 days; some use 90. Trade-off: longer = better UX, more risk if a token leaks. Confirmed 30?

6. **External security review** — required before production launch. Recommendation: start with an internal review using OWASP ASVS Level 2 checklist; commission an external review when the platform has its first paying customer.

7. **The built-in auth UI** — out of scope for this objective (engine only); will land with the Data Management Module. Confirm we're OK with no end-user-visible auth UI until that objective?

---

## 13. What Comes Next

With Objective 5 complete, the platform can authenticate users — through its own auth or through the customer's chosen enterprise IdP — and has a User Directory backed by whichever database the customer chose. Sessions, MFA, password management, OAuth, OIDC, SAML are all working.

**Objective 6: Multi-Tenancy and Authorization (RBAC)** is next. It builds on the User Directory: workspace memberships, roles, the configurable approval routing from the master plan, and authorization enforcement at the service layer. This is the layer that turns "authenticated user" into "authorized to perform action X on resource Y in workspace Z."

Then **Objective 7: Audit and Compliance** consolidates the audit infrastructure (much of which has already been built across earlier objectives), adds retention policies, exports, and the compliance posture documents.

After that, the foundation is genuinely complete and the **Data Management Module** can begin — the Supabase-clone-for-any-database that includes (and surfaces) the built-in auth as one of its features.

---

_This document is the contract. Every checkbox in Section 10 must be true before moving on._
