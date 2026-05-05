# ADR-0133: hCaptcha / Cloudflare Turnstile over reCAPTCHA

**Status:** Accepted
**Date:** 2026-05-05
**Deciders:** solo

## Context

The sign-up and forgot-password flows are exposed publicly and are targets for credential-stuffing and account-enumeration bots. A CAPTCHA challenge adds friction for automated submissions while remaining transparent for human users.

Three mainstream CAPTCHA services:

1. **Google reCAPTCHA v3** — score-based, invisible, requires sending user data to Google
2. **hCaptcha** — challenge-based or invisible, privacy-respecting, no data sharing with Google
3. **Cloudflare Turnstile** — fully invisible, client-side token validation, privacy-first

The platform's operator base includes privacy-conscious enterprises and self-hosters who may have GDPR or data-residency requirements that conflict with sending user traffic data to Google.

## Decision

**Support hCaptcha and Cloudflare Turnstile; do not integrate reCAPTCHA.**

The CAPTCHA integration is abstracted behind a `CaptchaProvider` interface with a single method: `verify(token: string, remoteIp?: string): Promise<boolean>`. Concrete implementations:

- `HCaptchaProvider` — calls `https://api.hcaptcha.com/siteverify`
- `TurnstileProvider` — calls `https://challenges.cloudflare.com/turnstile/v0/siteverify`
- `NullCaptchaProvider` — always returns `true`; used when no CAPTCHA is configured (development / self-hosted installs that choose not to use CAPTCHA)

Which provider is active is determined by environment variables:

- `CAPTCHA_PROVIDER=hcaptcha|turnstile|none` (default: `none`)
- `CAPTCHA_SITE_KEY` (public, injected into the page)
- `CAPTCHA_SECRET_KEY` (server-side verification secret)

The CAPTCHA token is submitted with the sign-up and forgot-password form payloads. Route handlers call `captchaProvider.verify(token, request.ip)` before processing the request. If verification fails, the handler returns 400 with `{ code: 'CAPTCHA_FAILED' }`.

CAPTCHA is **not required in development** (`CAPTCHA_PROVIDER=none` is the default).

## CAPTCHA configuration scope

**Objective 16's Definition of Done listed "Configurable per workspace." The v1 implementation is installation-scoped (environment variables), not per-workspace.**

Rationale: per-workspace CAPTCHA configuration requires storing the site key and secret per workspace in the database and serving different CAPTCHA widgets depending on which workspace the sign-up URL targets. The workspace-scoped sign-in URL (`/workspaces/:slug/sign-in`) is not yet implemented in v1 (workspace-scoped branding deferred). Without it, sign-up always hits the installation-level route, making per-workspace CAPTCHA configuration meaningless for the current routing model.

When workspace-scoped sign-in pages are introduced (post-v1), CAPTCHA configuration should migrate to `workspace_settings` with per-workspace site key/secret, falling back to installation defaults. The `CaptchaProvider` abstraction is already in place; only the key-lookup and widget-injection layers need updating. This is tracked as a known DoD deviation for v1.

## Consequences

### Positive

- Privacy-aligned: neither hCaptcha nor Turnstile sends user behaviour data to Google.
- Self-hosters can run without any CAPTCHA (`none`) for internal installations where bot traffic is not a concern.
- The `CaptchaProvider` abstraction makes it straightforward to add additional providers (e.g., a self-hosted alternative) without changing route handler code.
- Turnstile is fully invisible for human users (no checkbox, no image challenges); hCaptcha falls back to an image challenge when the client risk score is high.

### Negative

- Not integrating reCAPTCHA may be a friction point for organisations already using reCAPTCHA across other properties. They would need to adopt a second CAPTCHA vendor.
- hCaptcha and Turnstile have smaller track records than reCAPTCHA v3 in enterprise-scale bot detection. Operators with extreme abuse concerns should evaluate their suitability.
- CAPTCHA adds a network round-trip to sign-up and forgot-password submission; latency depends on the CAPTCHA provider's server-side verification endpoint.

### Neutral

- The `CAPTCHA_SITE_KEY` is injected into the page at build time (Next.js `NEXT_PUBLIC_CAPTCHA_SITE_KEY`). Changing the provider requires a redeploy.
- The `NullCaptchaProvider` is not available in production builds (compile-time check or runtime guard against `NODE_ENV=production` with `CAPTCHA_PROVIDER=none` emitting a startup warning).

## Alternatives Considered

### Google reCAPTCHA v3

Industry standard with broad adoption and high detection accuracy.

**Why not chosen:** reCAPTCHA v3 requires sending the user's browser fingerprint and interaction data to Google. For self-hosted enterprise installations with GDPR data-processing agreements that exclude Google, this is a disqualifying requirement. The platform's positioning as a privacy-respecting self-hosted alternative makes Google dependency in core auth flows inappropriate.

### No CAPTCHA

Rely on rate limiting alone.

**Why not chosen:** Rate limiting by IP is insufficient against distributed bot networks. CAPTCHA with `none` provider achieves the same effect for operators who choose it, while giving the option to enable protection for public-facing installations.

## References

- Objective 16 (Auth & User Management UI)
- `apps/web/src/app/auth/sign-up/page.tsx`
- `apps/web/src/app/auth/forgot-password/page.tsx`
- `apps/web/src/app/api/v1/auth/sign-up/route.ts`
- `apps/web/src/app/api/v1/auth/forgot-password/route.ts`
