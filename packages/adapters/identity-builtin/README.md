# identity-builtin

The platform's own auth adapter — the "Supabase-clone auth" feature. Handles email/password, magic links, OAuth (Google, GitHub, Microsoft, Apple), TOTP MFA, and password resets without requiring an external identity provider.

## Configuration

Set via env vars or the config package:

```env
IDENTITY_PROVIDER=builtin

# Argon2id parameters (tune per server; defaults are secure starting points)
AUTH_ARGON2_MEMORY_MB=64
AUTH_ARGON2_ITERATIONS=3
AUTH_ARGON2_PARALLELISM=4

# Session lifetime (rolling)
AUTH_SESSION_LIFETIME_DAYS=30

# HIBP breach check (k-anonymity; no passwords leave the server)
AUTH_HIBP_CHECK_ENABLED=true

# OAuth providers — configure only the ones you need
AUTH_OAUTH_GOOGLE_CLIENT_ID=
AUTH_OAUTH_GOOGLE_CLIENT_SECRET=
AUTH_OAUTH_GITHUB_CLIENT_ID=
AUTH_OAUTH_GITHUB_CLIENT_SECRET=
AUTH_OAUTH_MICROSOFT_CLIENT_ID=
AUTH_OAUTH_MICROSOFT_CLIENT_SECRET=
AUTH_OAUTH_APPLE_CLIENT_ID=
AUTH_OAUTH_APPLE_TEAM_ID=
AUTH_OAUTH_APPLE_KEY_ID=
AUTH_OAUTH_APPLE_PRIVATE_KEY_FILE=
```

## Capabilities

| Feature                     | Supported                                      |
| --------------------------- | ---------------------------------------------- |
| password                    | ✅ argon2id                                    |
| magic_link                  | ✅                                             |
| oauth                       | ✅ Google, GitHub, Microsoft (consumer), Apple |
| oidc                        | ✅ (consumer of external OIDC IdPs)            |
| saml                        | ❌                                             |
| mfa_totp                    | ✅ RFC 6238 with recovery codes                |
| mfa_webauthn                | ❌ deferred                                    |
| self_service_signup         | ✅ configurable                                |
| self_service_password_reset | ✅                                             |
| rp_initiated_logout         | ✅                                             |
| just_in_time_provisioning   | n/a (this IS the directory)                    |

## Operational notes

- **Argon2 parameter calibration**: run `pnpm --filter identity-builtin calibrate` on the production server to find parameters that keep login latency under 300ms.
- **OAuth redirect URI**: must be registered in each OAuth provider's console as `https://<your-domain>/auth/callback/<provider>`.
- **Apple OAuth**: uses JWT client secrets (not client_secret strings); the private key file path must be readable by the process.
- **HIBP check**: makes a network call to `api.pwnedpasswords.com` on signup and password change. Disable in air-gapped environments.

## Account lockout

5 consecutive failures → 15-minute lockout (sliding window). Both per-account and per-IP limits apply. Thresholds are configurable:

```env
AUTH_LOCKOUT_MAX_ATTEMPTS=5
AUTH_LOCKOUT_WINDOW_MINUTES=15
AUTH_RATE_LIMIT_SIGNIN_PER_IP_PER_MINUTE=20
```

## Runbooks

- `docs/runbooks/identity-provider-config-builtin.md` — initial setup
- `docs/runbooks/identity-mfa-recovery.md` — MFA reset for locked-out users
- `docs/runbooks/identity-account-takeover-response.md` — incident response
- `docs/runbooks/identity-mass-revocation.md` — bulk session revocation
- `docs/runbooks/identity-key-rotation.md` — rotating signing keys and secrets
