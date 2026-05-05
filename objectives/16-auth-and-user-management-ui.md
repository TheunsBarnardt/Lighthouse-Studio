# Objective 16: Auth & User Management UI

**Status:** Ready for development
**Prerequisites:** Objective 5 (Identity, Auth, User Directory) complete; all foundation objectives complete; Objective 14 (Realtime) for live-updating user lists
**Blocks:** Objective 18 (Data Browser uses the user picker for owner-typed columns); Objective 19 (Public SDK exposes auth methods)

---

## 1. Purpose

Take the auth engine from Objective 5 — sign-in, sign-up, MFA, OAuth, OIDC, SAML, password reset, magic links, sessions — and expose it as **complete, customer-facing UI**. End users sign in through screens the platform owns. Workspace administrators manage members, roles, identities, and sessions through screens the platform owns. The auth feature stops being "an engine" and becomes "a polished part of the product."

This is the screen most users see first. The sign-in page is the platform's first impression. The user management page is what every workspace admin uses to onboard their team. Getting these screens right — fast, accessible, secure-by-default, customizable enough to match the customer's brand — is what separates "self-hostable platform with auth" from "self-hostable platform people actually want to deploy."

This objective produces no new auth backend functionality (Objective 5 finished that). It produces the **UI surface** and the small additional services that surface needs (avatar storage, user search, invitation acceptance flow, etc.).

---

## 2. Scope

### In Scope

- **End-user authentication screens**: sign-in (password, magic link, OAuth providers), sign-up, password reset, email verification, MFA enrollment and challenge, identity linking
- **Account settings screens** (logged-in user): profile, password, email, MFA management, linked identities, active sessions, account deletion
- **Workspace admin screens**: member list with search and filters, invite member, change member role, remove member, view member's session and activity history
- **Installation admin screens**: cross-workspace user search, suspend account, reset MFA (admin-assisted recovery), view audit history
- **Branding / customization**: per-workspace logo, color, custom CSS hooks
- **Avatars**: upload, crop, store via the storage layer (Objective 15)
- **Email templates**: every auth email (verification, password reset, magic link, invitation, MFA changed, etc.) is templated with platform/workspace branding
- **Realtime**: user lists update live; "user X just joined the workspace" notifications
- **Localization scaffolding**: every string is translation-ready; English ships first, framework supports more
- **Accessibility**: WCAG 2.2 AA on every auth screen
- **Anti-abuse**: CAPTCHA on sign-up forms when configured; rate limiting via the layer from Objective 12
- ADRs

### Out of Scope (Belongs to Later Objectives)

- WebAuthn / Passkeys UI (deferred with the engine; will land together)
- Organization-level management above workspaces (the platform's tenancy unit IS the workspace; no super-org concept)
- Self-service workspace creation by external users (deferred; current model is "installation admin creates workspaces")
- Custom hosted sign-in pages with full white-labeling (the platform supports per-workspace branding; full white-label hosting on customer domains is later)
- Built-in helpdesk / customer support workflows (out of scope for the platform)
- User onboarding tours / product tours (deferred — feature for the larger product later)
- Bulk user import via CSV (deferred — useful but not v1; covered by API in Objective 12)

---

## 3. Locked Decisions

| Decision                         | Choice                                                                                                         | Rationale                                            |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Routing                          | React Router; routes under `/auth/*` and `/account/*` and `/workspaces/<slug>/members`                         | Standard; clear separation                           |
| Forms                            | react-hook-form + zod                                                                                          | Already in the stack                                 |
| Component library                | shadcn/ui (established in Objective 1)                                                                         | Consistent                                           |
| Avatar storage                   | Goes through the StorageService from Objective 15                                                              | Reuse, don't duplicate                               |
| Avatar bucket                    | A platform-managed bucket per workspace named `avatars` (auto-created on workspace creation)                   | Predictable; isolated                                |
| Avatar image processing          | Crop client-side via a canvas component; upload the cropped result                                             | Keeps server simple                                  |
| Email templates                  | MJML-based templates compiled to HTML; per-workspace overrides                                                 | Industry standard; renders well across email clients |
| Branding scope                   | Logo, primary color, optional custom CSS variables, optional company name                                      | Modest set; covers common needs                      |
| CAPTCHA                          | hCaptcha or Turnstile (configurable); only on sign-up and password-reset by default                            | Privacy-preserving alternatives to reCAPTCHA         |
| First-run experience             | Installation onboarding flow — first user becomes installation_owner; create the first workspace               | One-time but smooth                                  |
| Default session duration         | 30 days rolling (matches Objective 5)                                                                          |                                                      |
| Sign-out behavior                | Local logout invalidates the session; "Sign out everywhere" revokes all the user's sessions across all devices | Standard pattern                                     |
| Email verification               | Required by default before sign-in completes; admin can disable for trusted SSO                                | Defense                                              |
| Self-service sign-up             | Configurable per workspace per IdP                                                                             | Some workspaces are invitation-only                  |
| MFA enrollment timing            | Optional by default; can be required at workspace level for "enrollment within N days of joining"              | Forces MFA without locking out new users             |
| Profile fields                   | Display name, email (primary), avatar, locale, timezone, custom fields per workspace                           | Reasonable default set                               |
| User status display              | Active, Pending Verification, Suspended, Archived                                                              | Visible to admins                                    |
| Real-time updates in admin views | Yes via Objective 14                                                                                           | Member list updates as people accept invites         |

---

## 4. Architectural Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                       END USER (browser)                              │
│                                                                       │
│   Auth Routes:                  Account Routes:                       │
│   /auth/sign-in                 /account/profile                      │
│   /auth/sign-up                 /account/password                     │
│   /auth/forgot-password         /account/mfa                          │
│   /auth/reset-password          /account/sessions                     │
│   /auth/verify-email            /account/identities                   │
│   /auth/magic-link              /account/danger-zone (delete)         │
│   /auth/mfa-challenge                                                 │
│   /auth/oauth-callback          Workspace Admin:                       │
│   /auth/saml-callback            /workspaces/:slug/members             │
│   /auth/accept-invitation        /workspaces/:slug/members/:id         │
│                                                                       │
│   Installation Admin:                                                 │
│   /admin/users (cross-workspace)                                      │
│   /admin/audit (cross-workspace)                                      │
│                                                                       │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ REST API
                             ▼
        ┌────────────────────────────────────┐
        │  Existing services (unchanged):     │
        │  - AuthService (Objective 5)        │
        │  - UserDirectoryPort + adapters     │
        │  - SessionPort                       │
        │  - MfaPort                           │
        │  - IdentityProviderPort + adapters   │
        │  - WorkspaceService (Objective 6)    │
        │  - MemberService (Objective 6)       │
        │                                      │
        │  New thin services:                  │
        │  - InvitationFlowService             │
        │  - AvatarService                     │
        │  - UserSearchService                 │
        │  - BrandingService                   │
        │  - EmailTemplateService              │
        └────────────────────────────────────┘
```

The existing services do the heavy lifting. This objective adds the UI plus a few small services that bridge UI needs (avatars, search, branding, email templates) into the existing infrastructure.

---

## 5. The Hard Parts

**5.1 The first-run experience**

A fresh installation has no users. The first time someone visits the platform's URL, they need to:

1. Become the first installation_owner
2. Create the first workspace
3. Get redirected into the workspace ready to use

The flow:

- The platform detects "no users exist" at startup, surfaces a special `/setup` route
- The setup route shows a one-time form: install owner email, password, workspace name
- On submit, the platform creates the user with `installation_owner` role, creates the workspace, signs the user in, redirects to the workspace
- Once any user exists, the `/setup` route returns 404 — it's a one-shot

This flow has subtle requirements: it must work even when no admin exists, but it must NOT be exploitable after the first run. The "is the platform initialized" check is in the database (the existence of any user); race conditions during initial setup are handled by an exclusive lock.

**5.2 The invitation acceptance flow**

A workspace admin invites someone via email. The email contains a tokenized link. Clicking the link:

- If the invited email already has an account: redirect to sign-in (with a return URL); after sign-in, the invitation is accepted automatically
- If the invited email doesn't have an account: redirect to sign-up; the sign-up form is pre-filled with the email; after sign-up, the invitation is accepted automatically
- If the invited email matches an existing user but they're signed in as someone else: explicit message asking them to sign in as the invited account or to switch
- If the invitation has expired (24 hours by default): clear error message with "request a new invite" option

The tokenized link is one-time-use; consumed at acceptance. The invitation record stores the original invited email; the platform verifies that the user's primary email matches before accepting (prevents one user from accepting another user's invitation).

If the workspace's IdP override (Objective 5) requires Entra ID / OIDC / SAML, the invitation flow redirects to the IdP; on return, the new identity is linked to the user account if the email matches a known user or creates one (with JIT provisioning if enabled).

**5.3 OAuth callback handling**

OAuth flows return to the platform via redirect URLs like `/auth/oauth-callback?code=...&state=...`. The handler:

1. Verifies the `state` matches one issued by the platform (prevents CSRF)
2. Exchanges the code for tokens at the IdP
3. Verifies the identity claim
4. Looks up the user by `(provider_id, subject)` in the User Directory
5. If found: signs them in
6. If not found and JIT enabled for this provider: creates the user, signs them in
7. If not found and JIT disabled: shows "no account exists; please request access" message
8. Redirects to the original target URL (preserved in the OAuth flow's state parameter)

OAuth providers must be configured per workspace (or installation-wide). The configuration UI surfaces this; the IdP-specific config is handled by Objective 5's adapters.

**5.4 SAML callback handling**

SAML is more involved than OAuth: the response is a base64-encoded XML assertion POSTed back to the SP (the platform). Handler:

1. Parses the XML
2. Verifies the signature against the IdP's signing certificate
3. Validates the audience, recipient, NotBefore/NotOnOrAfter
4. Extracts the subject and attribute statements
5. Maps attributes per the workspace's attribute mapping configuration
6. Same lookup-or-create flow as OAuth from there

The complexity is in the XML parsing and signature verification — handled by `node-saml` or `samlify`. The UI just shows progress and final status.

**5.5 MFA enrollment UX**

Most secure-by-default products require MFA. The platform's UX:

- After sign-in, if MFA is required by workspace policy AND the user hasn't enrolled, they're directed to enroll before reaching the workspace
- The enrollment flow:
  1. Show a QR code with the TOTP URI (already supports Google Authenticator, Authy, 1Password, etc.)
  2. User scans with their app
  3. User enters a 6-digit code to confirm
  4. Platform verifies; on success, generates 10 recovery codes
  5. Recovery codes are shown ONCE — user copies/downloads them
  6. User must check "I have saved my recovery codes" to proceed
  7. MFA is now active

If the user abandons the flow (closes the browser, navigates away), the partial enrollment expires after 10 minutes. They start over.

For sign-in challenges (post-enrollment), the user enters a 6-digit code or a recovery code. The UI distinguishes the two input formats but accepts either.

**5.6 Account recovery — when MFA is lost**

If a user loses both their authenticator and their recovery codes, they need admin help. The platform supports admin-assisted recovery:

- User contacts workspace admin (out-of-band)
- Workspace admin (with appropriate permission) can:
  1. View the user's enrollment status
  2. Trigger an "MFA reset" — disables current MFA; sends an email to the user; user re-enrolls on next sign-in
- The reset is heavily audited; the action is rate-limited (admins can't reset MFA for many users in a short period, prevents abuse)

For installation_owner users (who might be the only admin), a special recovery procedure exists involving the platform's master operator (filesystem access to the platform's host). Documented in `docs/runbooks/identity-mfa-recovery.md` from Objective 5.

**5.7 Active session management**

Users see their active sessions: device, IP, location (geo-IP), last seen. They can:

- Revoke individual sessions ("not me — sign me out from that device")
- Revoke all sessions except the current ("sign out everywhere else")
- Revoke all sessions including the current ("sign out everywhere" — useful when worried about compromise)

Session revocation propagates immediately via the realtime layer (using the same revocation events from Objective 14).

For workspace and installation admins: same capabilities for any user they have authority over. Admin-revoking a session is audited at info level (visible in user's audit history).

**5.8 Identity linking**

A user with built-in auth credentials can link their Entra account, GitHub OAuth, etc. The flow:

- From `/account/identities`, click "Link account"
- Choose the provider
- Standard OAuth/OIDC/SAML flow
- On callback, the new identity is linked to the existing user account
- Both identities can sign the user in to the same account

Constraints:

- A user can have at most one identity per provider
- A user must always have at least one identity (can't unlink the last one)
- Email mismatch between identities is allowed (a user might have built-in auth as `personal@example.com` and Entra as `name@company.com`)

The UI clearly shows all linked identities; the user can unlink any (subject to constraints) or change their primary identity.

**5.9 Per-workspace branding**

A workspace can customize the auth screens for its members:

- Upload a logo (stored via Objective 15's storage)
- Set a primary color
- Optionally set a small set of CSS variable overrides
- Optionally set a "company name" displayed on auth screens

This is modest by design. Full white-labeling (custom hosted sign-in domains, custom email-from addresses) is a later objective. The current scope: members of "Acme Corp" workspace see Acme's logo and color on the sign-in page; non-members see the platform default.

The branding is determined by which workspace the URL points at. The default sign-in page (`/auth/sign-in`) shows platform branding. A workspace-scoped sign-in (`/workspaces/acme/sign-in`) shows Acme's branding.

**5.10 Email templates**

Every auth email is generated from a template. Default templates ship with the platform; workspaces can override per template. Templates include:

- Sign-up email verification
- Welcome (after first verification)
- Password reset request
- Magic link
- Workspace invitation
- MFA enabled / disabled
- Email address changed
- Password changed
- Sign-in from new device (security alert)
- Account deletion confirmation

Templates use MJML for HTML emails (renders consistently across email clients) plus a plain-text fallback. Per-workspace overrides can change copy, branding, and from-address (within authorization — a workspace can't impersonate another workspace's email domain).

The EmailTemplateService renders templates at send time with the appropriate branding; the EmailPort delivers them.

**5.11 Localization scaffolding**

The platform ships with English. Future languages: the codebase uses an i18n framework (`react-intl` or `next-intl`) so every user-facing string is keyed:

```typescript
<FormattedMessage id="auth.signIn.title" defaultMessage="Sign in to your account" />
```

Translation files live in `apps/web/src/i18n/<locale>/`. Adding a new language is a translation effort, not a code change.

User locale comes from: explicit user preference > workspace default > browser language > English. Stored in the user's profile.

For v1, only English is shipped, but every screen is keyed and translation-ready.

**5.12 Accessibility on auth screens**

Sign-in screens are the highest-stakes accessibility surface — a user who can't sign in can't use anything else. Specifically:

- Every form field has a visible label and accessible name
- Errors are announced via `aria-live` regions
- Focus management on multi-step flows (MFA challenge follows password)
- Keyboard navigation works for everything (no mouse-only flows)
- Color contrast meets WCAG AA (4.5:1 for normal text)
- Focus rings visible
- Screen-reader testing on NVDA + VoiceOver as part of the verification

These are baseline requirements verified in Objective 10's accessibility gate; this objective extends that to the new screens added here.

---

## 6. Component Specifications

### 6.1 Pages and Routes

```
End User (Public/Unauthenticated):
  /setup                            (one-time first-run; redirects to / once initialized)
  /auth/sign-in
  /auth/sign-up
  /auth/forgot-password
  /auth/reset-password?token=...
  /auth/verify-email?token=...
  /auth/magic-link?token=...
  /auth/mfa-challenge
  /auth/oauth-callback
  /auth/saml-callback
  /auth/accept-invitation?token=...

End User (Authenticated):
  /                                 (workspace selector or last-used workspace)
  /account/profile
  /account/password
  /account/email
  /account/mfa
  /account/sessions
  /account/identities
  /account/preferences
  /account/danger-zone

Workspace-Scoped (Authenticated):
  /workspaces/:slug/                (workspace home; defaults configurable)
  /workspaces/:slug/members
  /workspaces/:slug/members/:userId
  /workspaces/:slug/invitations
  /workspaces/:slug/roles
  /workspaces/:slug/branding        (workspace settings → branding)

Installation Admin:
  /admin                            (admin dashboard)
  /admin/users
  /admin/users/:userId
  /admin/audit
  /admin/workspaces
```

Each route is a React component. Route guards check authentication and authorization; unauthorized requests redirect to sign-in or 403.

### 6.2 Sign-In Page

The most-visited screen. Specifically:

- Primary path: email + password
- Secondary path: "Sign in with [provider]" buttons for OAuth/OIDC providers configured for the workspace (or installation default if no workspace)
- Tertiary path: "Sign in with magic link" — enter email, receive link
- Footer links: forgot password, sign up (if self-service signup is enabled)
- Workspace branding if URL is workspace-scoped
- "Remember me" checkbox affecting session duration
- Detects existing valid session and redirects past the page

Edge cases handled:

- Account locked out → clear message with retry time
- Email not verified → resend verification option
- IdP error (Entra unreachable) → fallback to other configured methods if any
- Browser autofill works correctly with all fields

### 6.3 Sign-Up Page

- Email + password + display name
- Terms of service acceptance (configurable per workspace)
- CAPTCHA if enabled
- Verifies password meets policy (length, HIBP check, etc. per Objective 5)
- On submit: creates user with `pending_verification` status, sends verification email, displays "check your email" screen
- Self-service sign-up can be disabled per workspace; in that case, this page returns 403 with a "request access" message

### 6.4 MFA Challenge Page

- Reached after successful password validation when MFA is enrolled
- Six-digit code input with auto-advance between digits
- "Use recovery code instead" toggle that swaps the input format
- "I lost my MFA device" link → guidance on contacting workspace admin
- Wrong code: re-enter; rate-limited per session (5 attempts → must restart from password)

### 6.5 Account Sessions Page

- List of active sessions with: device fingerprint (browser + OS), IP, geo-location (best-effort), created at, last seen at
- Current session marked "This device"
- "Revoke" button for each session (except current can also be revoked but with confirmation)
- "Sign out everywhere else" button as a shortcut
- Real-time updates via Objective 14: revoking a session anywhere causes that session's tab to immediately log out

### 6.6 Workspace Members Page

For workspace admins:

- List view with: avatar, display name, email, role(s), status, last sign-in, joined at
- Filters: role, status, search by name/email
- Pagination
- Row actions: view details, change role, remove from workspace, view audit history
- Bulk actions: bulk role change, bulk remove (with confirmations)
- "Invite Member" button → opens invitation dialog
- "Pending Invitations" tab — see who's been invited but hasn't accepted; resend, revoke

Row click opens a member detail page with: roles, identities, sessions, audit history, recent activity (artifacts created, etc.).

### 6.7 Member Detail Page

- Profile section (read-only for non-owners; editable for the user themselves)
- Role assignment (admins only): list of current roles; add/remove with appropriate permission checks
- Linked identities (admins can view; only the user can modify their own)
- Sessions (admins can view; admins can revoke; the user themselves can do both)
- Activity history (audit events involving this user, scoped to the workspace)

The page is composed of permission-aware sub-components: an admin sees more controls than a regular user viewing their own page.

### 6.8 Account Settings Pages

Each `/account/*` page is a focused single-concern surface:

- **Profile**: display name, avatar (upload/crop), locale, timezone
- **Password**: current password + new password + confirmation; password policy preview; "I forgot my password" link if needed
- **Email**: current email; "change email" flow that sends verification to the new address; old email kept until new is verified
- **MFA**: current state; enroll if not enrolled; show recovery codes (generate new set if requested); disable MFA (requires re-auth)
- **Sessions**: as in 6.5
- **Identities**: link new providers; unlink (with constraint check); change primary
- **Preferences**: notifications, email opt-ins, language (for translation-ready future)
- **Danger zone**: download my data (data subject access), delete my account (initiates erasure flow with grace period)

### 6.9 Avatar Service

```typescript
// packages/core/src/services/data-management/avatar.service.ts

export class AvatarService {
  async uploadAvatar(ctx: RequestContext, file: Buffer | Stream, mimeType: string): Promise<Result<{ url: string }, AppError>>;

  async getAvatarUrl(userId: string, size?: 'small' | 'medium' | 'large'): Promise<Result<string, AppError>>;

  async deleteAvatar(ctx: RequestContext): Promise<Result<void, AppError>>;
}
```

Internally:

- Avatars stored in the workspace's `avatars` bucket via StorageService
- Storage key: `<user_id>/<size>.jpg` (jpeg-encoded, sized variants pre-generated)
- Cropping: client-side via canvas; server receives the final cropped image only
- Public-readable signed URLs with long TTL for embedding in member lists
- Default avatar (gravatar-style hash → identicon) generated for users without uploads

### 6.10 InvitationFlow Service

Wraps the invitation acceptance logic that was scattered between MemberService and the new UI flow:

```typescript
export class InvitationFlowService {
  /** Validate an invitation token; return the invitation if valid. */
  async validateInvitation(token: string): Promise<Result<Invitation, AppError>>;

  /** Accept an invitation as the currently-authenticated user. */
  async acceptInvitation(ctx: RequestContext, token: string): Promise<Result<{ workspaceId: string }, AppError>>;

  /** Resend an invitation (admin action). */
  async resendInvitation(ctx: RequestContext, invitationId: string): Promise<Result<void, AppError>>;

  /** Revoke an invitation (admin action). */
  async revokeInvitation(ctx: RequestContext, invitationId: string): Promise<Result<void, AppError>>;
}
```

### 6.11 UserSearchService

For installation admins searching across workspaces, and for workspace admins searching within their workspace:

```typescript
export class UserSearchService {
  async search(ctx: RequestContext, query: UserSearchQuery): Promise<Result<PaginatedResult<UserSummary>, AppError>>;
}

export interface UserSearchQuery {
  workspaceId?: string; // null = installation-wide (requires installation admin)
  searchText?: string; // matches email, display name
  status?: UserStatus[];
  roleIds?: string[];
  hasIdentityFromProvider?: string;
  joinedAfter?: Date;
  joinedBefore?: Date;
  signedInAfter?: Date;
  page: Page;
}
```

Permission-checked at the service level; uses the persistence layer's filter capability.

### 6.12 BrandingService

```typescript
export class BrandingService {
  async getBranding(workspaceId: string): Promise<Result<WorkspaceBranding, AppError>>;
  async setBranding(ctx: RequestContext, workspaceId: string, branding: WorkspaceBranding): Promise<Result<void, AppError>>;
  async resetBranding(ctx: RequestContext, workspaceId: string): Promise<Result<void, AppError>>;
}

export interface WorkspaceBranding {
  logoFileId?: string;
  primaryColor?: string; // hex
  companyName?: string;
  customCss?: string; // sanitized; only certain CSS variables allowed
  emailFromName?: string;
  emailFromAddressOverride?: string; // requires DNS verification (deferred mechanism)
}
```

### 6.13 EmailTemplateService

```typescript
export class EmailTemplateService {
  async render(templateKey: TemplateKey, context: TemplateContext, workspaceId?: string): Promise<Result<{ html: string; text: string; subject: string }, AppError>>;

  async setTemplateOverride(ctx: RequestContext, workspaceId: string, templateKey: TemplateKey, template: TemplateOverride): Promise<Result<void, AppError>>;
}
```

Default templates ship in `packages/core/src/email-templates/`. Workspace overrides stored in the database (`workspace_email_templates` table). Rendering uses MJML for HTML, derives plain-text from the HTML.

### 6.14 New Database Tables

```typescript
workspace_email_templates: {
  ...standardColumns,
  workspace_id: uuid,
  template_key: string(100),
  subject_template: text,
  html_template: text,            // MJML source
  text_template: text?,           // plain-text override (otherwise derived)
}
unique: [workspace_id, template_key]

workspace_branding: {
  ...standardColumns,
  workspace_id: uuid,
  logo_file_id: uuid?,
  primary_color: string(7)?,
  company_name: string(255)?,
  custom_css: text?,
  email_from_name: string(255)?,
}
unique: [workspace_id]
```

### 6.15 Audit Events

This objective doesn't add many new audit events (Objective 5 already defined the auth events). It does add:

```
data_management.user.avatar_uploaded
data_management.user.avatar_deleted
data_management.workspace.branding_updated
data_management.workspace.email_template_overridden
data_management.workspace.email_template_reset
data_management.workspace.invitation_resent
data_management.installation.user_searched (sampled, useful for admin behavior audit)
data_management.installation.mfa_admin_reset
```

The MFA admin-reset event is particularly important and always audited at info level — it's a sensitive operation and admins should be able to point to it later.

### 6.16 Real-time Updates

Several admin views update live:

- **Workspace members list**: subscribes to member-related events; new invitations accepted, members removed, role changes all reflected in real time
- **Pending invitations list**: invitation accepted moves the row from this list to the members list immediately
- **Active sessions page**: own-session changes (revocation from elsewhere) reflected immediately

These use the realtime infrastructure from Objective 14 with permission-filtered streams.

### 6.17 Operational Runbooks

New files in `docs/runbooks/`:

- `auth-ui-customization.md` — how to customize email templates, branding, OAuth provider configs
- `auth-ui-locale-addition.md` — adding a new translation
- `auth-ui-mfa-admin-recovery.md` — admin-assisted MFA recovery procedure
- `auth-ui-invitation-troubleshooting.md` — when invitations don't work (email delivery, expired tokens, mismatched emails)
- `auth-ui-first-run.md` — installing a fresh instance and the first-run flow

---

## 7. Implementation Order

1. **Routes and route guards** — set up React Router with auth-aware guards.

2. **Sign-in page** — basic email+password against existing AuthService. End-to-end working.

3. **Sign-up page with email verification flow.**

4. **Password reset flow** (forgot password + reset password pages).

5. **Magic link flow.**

6. **MFA challenge page** (post-password); MFA enrollment page in account settings.

7. **OAuth callback handler** (already supported by Objective 5; UI just needs to invoke and display).

8. **SAML callback handler** (similar).

9. **Account settings pages** (profile, password, email, MFA, sessions, identities, preferences, danger-zone).

10. **Avatar service + upload UI**.

11. **Workspace members page** with list, search, filters, pagination.

12. **Member detail page** with roles, identities, sessions, activity.

13. **Invite member dialog and invitation acceptance flow.**

14. **First-run setup flow.**

15. **Installation admin pages** (cross-workspace user search, audit access).

16. **BrandingService + workspace branding settings page.**

17. **EmailTemplateService + email template rendering for all auth emails.**

18. **CAPTCHA integration for sign-up and password reset (configurable).**

19. **Localization scaffolding** — every string keyed; English locale file complete.

20. **Realtime updates in admin views.**

21. **Accessibility audit on every screen** with axe-core; manual screen-reader testing.

22. **Documentation, runbooks, ADRs.**

23. **Verify Definition of Done.**

---

## 8. ADRs to Write

- **ADR-0126: First-Run Setup as One-Shot Route** — security of the bootstrap flow
- **ADR-0127: Per-Workspace Branding Scope** — modest set; full white-label deferred
- **ADR-0128: MJML for Email Templates** — alternatives (Handlebars+CSS, MJML, Maizzle); rationale
- **ADR-0129: Avatar Storage via the Storage Service** — reuse of Objective 15 vs. separate avatar microservice
- **ADR-0130: hCaptcha/Turnstile over reCAPTCHA** — privacy-preserving alternatives
- **ADR-0131: Localization Scaffolding from Day One** — i18n infrastructure even when only English ships

---

## 9. Verification Steps

1. **Sign-in with password** works end-to-end against the dev environment.

2. **Sign-up flow** creates a user with `pending_verification`, sends an email, allows verification, then sign-in completes.

3. **Password reset** flow works; new password takes effect; old sessions revoked.

4. **Magic link** works; link is one-time; expired link rejected.

5. **MFA enrollment** works; code from authenticator validates; recovery codes generated and shown.

6. **MFA challenge** at sign-in; correct code passes; wrong code rejected with appropriate retry behavior.

7. **OAuth sign-in** with at least one configured provider (Google or GitHub) works end-to-end.

8. **OIDC sign-in** against a test Keycloak instance works.

9. **SAML sign-in** against a test SimpleSAMLphp IdP works.

10. **Account settings** — every screen functional; updates persist; appropriate audit events emitted.

11. **Avatar upload + crop + display** works.

12. **Active sessions** displayed correctly; revocation works; "sign out everywhere" works.

13. **Identity linking** — sign in with built-in auth, link Entra, sign out, sign in via Entra, end up at the same account.

14. **Member list** displays workspace members; search and filters work; pagination handles 1000+ members.

15. **Invite member** sends an email; accepting the invitation links to the workspace; expired invitation shows a clear error.

16. **First-run flow** — fresh installation; first user becomes installation_owner; first workspace created; subsequent visitors see normal sign-in (not setup).

17. **Installation admin** can search users across workspaces; MFA admin reset works and is audited.

18. **Workspace branding** — uploaded logo and primary color appear on workspace-scoped sign-in.

19. **Email template override** — workspace-customized verification email renders correctly with the workspace's branding.

20. **CAPTCHA** rejects automated signup attempts when configured.

21. **Real-time member list** — open in two tabs; invitation accepted in tab 1 reflects in tab 2 within 2 seconds.

22. **Accessibility** — axe-core passes on every screen; manual screen-reader walkthrough completes.

23. **Localization-readiness** — verify every string is keyed (no hardcoded strings in components); a "translation in progress" pseudo-locale shows the keys instead of English text.

24. **Audit events** for sensitive operations (MFA reset, role changes, member removal) all produce expected entries.

25. **Performance** — sign-in page loads in < 1 second on a typical connection.

If all 25 pass, the objective is met.

---

## 10. Definition of Done

**Routes and Pages**

- [ ] All routes from Section 6.1 implemented
- [ ] Route guards enforce authentication and authorization
- [ ] Loading and error states for every page

**End-User Auth Flows**

- [ ] Sign-in (password, magic link, OAuth providers configured per workspace)
- [ ] Sign-up with email verification
- [ ] Password reset
- [ ] Magic link
- [ ] MFA enrollment
- [ ] MFA challenge
- [ ] OAuth/OIDC/SAML callbacks
- [ ] Invitation acceptance

**Account Settings**

- [ ] Profile (with avatar upload)
- [ ] Password
- [ ] Email change with verification
- [ ] MFA management
- [ ] Active sessions
- [ ] Linked identities
- [ ] Preferences
- [ ] Danger zone (delete account / data export)

**Workspace Admin**

- [ ] Members list with search, filters, pagination
- [ ] Member detail page
- [ ] Invite member dialog
- [ ] Pending invitations management
- [ ] Branding settings page
- [ ] Email template overrides

**Installation Admin**

- [ ] Cross-workspace user search
- [ ] User detail (read-only for cross-workspace)
- [ ] MFA admin reset
- [ ] Cross-workspace audit access

**First-Run**

- [ ] Setup route exists when no users
- [ ] Setup creates installation_owner + first workspace
- [ ] Setup route 404s once initialized

**Supporting Services**

- [ ] AvatarService implemented
- [ ] InvitationFlowService implemented
- [ ] UserSearchService implemented
- [ ] BrandingService implemented
- [ ] EmailTemplateService implemented
- [ ] All MJML templates for default auth emails

**Database**

- [ ] workspace_branding table migrated
- [ ] workspace_email_templates table migrated

**Real-time**

- [ ] Member list subscribes to live updates
- [ ] Pending invitations live
- [ ] Sessions page reflects revocations

**CAPTCHA**

- [ ] Configurable per workspace
- [ ] Default off; enabled for sign-up and password reset when configured

**Localization**

- [ ] i18n scaffolding in place
- [ ] All user-facing strings keyed
- [ ] English locale file complete

**Accessibility**

- [ ] WCAG 2.2 AA on every screen
- [ ] axe-core in CI for these pages
- [ ] Keyboard-only navigation works
- [ ] Screen-reader walkthrough documented

**Audit**

- [ ] All audit events from Section 6.15 emitted
- [ ] MFA admin reset always at info level

**Documentation**

- [ ] ADRs 0126–0131 written and Accepted
- [ ] All runbooks in Section 6.17 written
- [ ] Customer-facing auth user guide

**Verification**

- [ ] All 25 verification steps in Section 9 pass

---

## 11. Anti-Patterns to Refuse

- **Hardcoded user-facing strings.** Even if only English ships, strings are keyed via the i18n framework.
- **Custom auth UI built on top of a different auth system.** This UI sits on top of Objective 5's services; no auth logic lives in the UI.
- **Bypassing rate limits "for the platform's own UI."** The platform's UI uses the same APIs as customer apps; they get rate-limited the same way.
- **Storing passwords in form state longer than needed.** Cleared as soon as submitted.
- **Showing different error messages for "user doesn't exist" vs. "wrong password."** Email enumeration prevention applies to UI too.
- **Skipping accessibility because "this is a quick prototype."** Sign-in is the most-visited page. Get it right.
- **Letting CAPTCHA block users from accessing accounts they own.** CAPTCHA on sign-up and password-reset; never on sign-in (use rate limiting + lockout instead).
- **Accepting unsigned SAML responses or unverified OIDC tokens.** Same discipline as Objective 5.
- **Trusting the redirect URL parameter blindly after OAuth callback.** Validate against an allowlist; CSRF protection.
- **Auto-creating users from random IdP attributes without JIT being explicitly enabled.** JIT is a configuration choice; default is "must already exist."
- **Storing email/password forms outside HTTPS.** Should be impossible given the platform's TLS posture, but the UI also enforces it explicitly.
- **Letting branding CSS execute arbitrary rules.** Sanitized to a small allowlist of CSS variables.

---

## 12. Open Questions for Confirmation Before Starting

1. **Self-service workspace creation by external users** — confirmed deferred. Current model is "installation admin creates workspaces; admins invite members." Customer can override per-installation.

2. **WebAuthn / Passkeys UI** — confirmed deferred to a follow-up. Recommendation: add it after this objective ships, before stage one feature work begins.

3. **Custom hosted sign-in domains** — confirmed deferred. Workspace branding within the platform's domain is sufficient for v1.

4. **CAPTCHA provider** — proposing hCaptcha or Turnstile (Cloudflare's). Both are free and privacy-preserving. Recommendation: support both via a captcha-port abstraction; customer configures which.

5. **Locale support in v1** — English only ships. Translation-ready for others. Confirmed?

6. **Email-from address override** — proposing a workspace can change the "From: name" but not the address (which requires DNS verification — deferred mechanism). Acceptable?

7. **Bulk user import via CSV** — confirmed deferred to a follow-up; covered by API in the meantime.

8. **First-run flow security** — proposing the `/setup` route is enabled if `users` table is empty AND a setup token (from environment variable / config) matches. Adds protection against race conditions during initial deployment. Confirmed?

---

## 13. What Comes Next

With Objective 16 complete, the platform's auth feature is **a polished product**, not just a backend. End users sign in, sign up, manage their accounts. Workspace admins manage members, invitations, branding. Installation admins have cross-workspace tools. Every screen is accessible, branded per workspace, audit-logged, and live-updating.

**Objective 17: Query Console** is next. SQL/Mongo console with safety rails — read-only by default, query timeouts, result size limits, query history. For customer developers who want direct database access alongside the API. The fewer screens of this remaining (3), each more focused than the last:

**Objective 18: Data Browser & Editor** — the table viewer, row editor, CSV import/export. Real-time updates baked in. The screen most customers will spend the most time in.

**Objective 19: Public SDK** — the "Supabase client equivalent" wrapping REST, GraphQL, Realtime, Storage, Auth. The artifact customers' developers depend on.

After Objective 19, the Data Management Module is complete and sellable.

---

_This document is the contract. Every checkbox in Section 10 must be true before moving on to Objective 17._
