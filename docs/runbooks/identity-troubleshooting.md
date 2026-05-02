# Runbook: Identity Troubleshooting

Diagnostic flowchart for "a user cannot sign in."

---

## Step 1: Gather context

Ask the user or check logs for:

- Which sign-in method? (password / magic link / OIDC / SAML)
- What error message do they see? (exact text or error code)
- Is it happening for all users or just this user?
- Has this user ever signed in successfully before?
- Did anything change recently? (password reset, new IdP config, cert rotation)

---

## Step 2: Check if the user account exists

```sql
SELECT id, primary_email, status, email_verified, mfa_enabled, created_at
FROM identity_users
WHERE LOWER(primary_email) = LOWER('<user@example.com>');
```

| `status` value         | Action                                                 |
| ---------------------- | ------------------------------------------------------ |
| `active`               | Account is fine; continue diagnosis                    |
| `pending_verification` | User has not verified their email                      |
| `archived`             | Account is archived; restore or explain to user        |
| No row                 | Account does not exist; check if using the right email |

---

## Step 3: Check for account lockout

```sql
SELECT failed_login_count, lockout_until
FROM identity_credentials
WHERE user_id = '<user-id>';
```

If `lockout_until` is in the future, the account is locked. To unlock:

```sql
UPDATE identity_credentials
SET failed_login_count = 0, lockout_until = NULL
WHERE user_id = '<user-id>';
```

Inform the user and advise them to use a password manager.

---

## Step 4: Password sign-in issues

**Wrong password:** `INVALID_CREDENTIALS` — user must reset via the password reset flow.

**Email not found:** Same `INVALID_CREDENTIALS` response (email enumeration prevention). Verify the account exists (Step 2).

**Password hash missing:**

```sql
SELECT password_hash IS NOT NULL as has_password
FROM identity_credentials
WHERE user_id = '<user-id>';
```

If `has_password = false`, the user may have signed up via OAuth/SAML and has no password. They should use their IdP or request a password set link from an admin.

---

## Step 5: Magic link / password reset not arriving

1. Check spam/junk folder.
2. Verify SMTP is functional:
   ```bash
   platform-cli email test --to user@example.com
   ```
3. Check the application logs for SMTP errors around the time of the request.
4. Verify the user's email address matches exactly (case-insensitive lookup).
5. Check that the flow token has not expired (magic link: 15 min; password reset: 1 hour).

---

## Step 6: MFA issues

**Lost authenticator app:** See runbook `identity-mfa-recovery.md`.

**TOTP codes rejected:**

- Verify the device clock is synchronized (TOTP requires <30s skew).
- The platform allows ±1 window (60 seconds total). If the device is further off, NTP sync is required.
- If the user cannot get a correct code, perform MFA recovery.

---

## Step 7: OIDC / SAML sign-in failure

Check the application error log for the specific error code:

- `TOKEN_INVALID` / `OIDC state is invalid or expired` → state expired (user took too long); ask them to retry.
- `PROVIDER_ERROR` → upstream IdP returned an error; check IdP logs.
- `ACCOUNT_NOT_FOUND` + JIT disabled → admin must provision the user first.
- `No claims in OIDC token response` → IdP config issue (see OIDC runbook).
- `Invalid signature` (SAML) → cert mismatch (see SAML runbook).

---

## Step 8: Escalation

If none of the above resolve the issue:

1. Enable debug logging for the auth service: `LOG_LEVEL=debug`.
2. Reproduce the sign-in failure and capture the full request/response trace.
3. Search the trace for the user's email or session ID.
4. File an issue with: error code, sign-in method, timestamp, and sanitised trace.
