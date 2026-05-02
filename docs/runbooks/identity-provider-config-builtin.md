# Runbook: Built-in Identity Provider Setup

Configure the platform's built-in auth (email/password, magic link, OAuth).

---

## Prerequisites

- A running Postgres instance with the identity schema applied (see `packages/adapters/identity-postgres/src/schema.sql`)
- SMTP credentials for sending email
- (Optional) OAuth app credentials from Google, GitHub, or Microsoft

---

## 1. Apply the identity database schema

```sql
-- Run schema.sql against your Postgres database once before starting the application.
psql $DATABASE_URL < packages/adapters/identity-postgres/src/schema.sql
```

---

## 2. Configure environment variables

Set the following in your deployment environment:

| Variable                   | Description                                                              |
| -------------------------- | ------------------------------------------------------------------------ |
| `AUTH_TOKEN_SECRET`        | HMAC secret for session token hashing (≥ 32 bytes of entropy)            |
| `AUTH_MFA_ENCRYPTION_KEY`  | Hex-encoded AES-256 key for TOTP secret encryption (64 hex chars)        |
| `AUTH_FLOW_SECRET`         | HMAC secret for email verification / password reset / magic link tokens  |
| `AUTH_SELF_SERVICE_SIGNUP` | `true` to allow self-registration, `false` to require admin provisioning |
| `AUTH_HIBP_CHECK`          | `true` (default) to check passwords against HaveIBeenPwned               |

Generate secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Generate the MFA encryption key with:

```bash
node -e "const {generateKey} = require('./packages/adapters/identity-builtin/dist/src/index.js'); console.log(generateKey())"
```

---

## 3. Configure SMTP

The built-in auth sends emails for: email verification, password reset, and magic link sign-in.

| Variable        | Description                               |
| --------------- | ----------------------------------------- |
| `SMTP_HOST`     | SMTP server hostname                      |
| `SMTP_PORT`     | SMTP port (typically 587 for STARTTLS)    |
| `SMTP_USER`     | SMTP username                             |
| `SMTP_PASSWORD` | SMTP password                             |
| `EMAIL_FROM`    | Sender address (`noreply@yourdomain.com`) |

Test the SMTP configuration:

```bash
pnpm --filter @platform/app-api exec tsx scripts/test-smtp.ts --to test@yourdomain.com
```

---

## 4. Configure OAuth providers (optional)

For each OAuth provider (Google, GitHub, Microsoft consumer), set:

| Variable                     | Description                    |
| ---------------------------- | ------------------------------ |
| `OAUTH_GOOGLE_CLIENT_ID`     | Google OAuth 2.0 Client ID     |
| `OAUTH_GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 Client Secret |
| `OAUTH_GITHUB_CLIENT_ID`     | GitHub OAuth App Client ID     |
| `OAUTH_GITHUB_CLIENT_SECRET` | GitHub OAuth App Client Secret |

Register redirect URIs in each provider's developer console:

- `https://yourdomain.com/api/auth/oauth/callback/google`
- `https://yourdomain.com/api/auth/oauth/callback/github`

---

## 5. Validate configuration

Start the platform in staging and verify:

```bash
# Sign up a test user
curl -X POST https://yourdomain.com/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@yourdomain.com","password":"CorrectHorseBatteryStaple1"}'

# Sign in
curl -X POST https://yourdomain.com/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"method":"password","email":"test@yourdomain.com","password":"CorrectHorseBatteryStaple1"}'
```

Check that a verification email was received.

---

## 6. Configure password policy

The default policy: 12-character minimum, no complexity rules, HIBP check enabled (see ADR-0036).

To change the minimum length, edit `packages/adapters/identity-builtin/src/hibp.ts` and update `MIN_PASSWORD_LENGTH`. This requires a code change and redeploy.

To disable HIBP checking (e.g., for air-gapped installations):

```typescript
// In your composition root
new BuiltinIdentityProvider(deps, { selfServiceSignup: true, hibpCheck: false });
```

---

## 7. Session cleanup

Schedule `SessionPort.cleanupExpired()` to run nightly:

```
0 3 * * * platform-cli identity sessions cleanup
```

This removes expired session rows from the `identity_sessions` table.
