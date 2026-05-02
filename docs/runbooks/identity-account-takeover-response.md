# Runbook: Account Takeover Incident Response

Steps to take when a user reports (or you detect) that their account has been compromised.

**Act quickly.** Every minute a compromised account remains active risks further damage.

---

## Immediate containment (< 5 minutes)

### 1. Revoke all sessions

```sql
DELETE FROM identity_sessions WHERE user_id = '<compromised-user-id>';
```

This immediately invalidates all active tokens. Any attacker using a session token will be logged out on their next request.

### 2. Lock the account

```sql
UPDATE identity_credentials
SET lockout_until = NOW() + INTERVAL '24 hours',
    failed_login_count = 99,
    updated_at = NOW()
WHERE user_id = '<compromised-user-id>';
```

This prevents sign-in (including with the correct password) while the investigation is active.

---

## Investigation

### 3. Review recent session activity

```sql
SELECT id, identity_provider, ip_address, user_agent, created_at, last_seen_at
FROM identity_sessions
WHERE user_id = '<compromised-user-id>'
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

Note any IP addresses or user agents that differ from the user's normal pattern.

### 4. Check if additional accounts were accessed

If the attacker had access to email, check for password reset requests:

Look in application logs for recent password reset / magic link requests for the affected email address.

### 5. Determine the breach vector

Common vectors:

- Phishing → check the user's recent sign-in IP against known VPN/Tor exits
- Credential stuffing → check if the same password was used on other services (advise HIBP personal check)
- Session token theft → review sign-in location vs. usage location
- MFA bypass → check if MFA was enrolled; if not, flag as a gap

---

## Remediation

### 6. Reset the password

Generate a password reset link for the user via the legitimate channel:

```bash
platform-cli identity password-reset --email user@example.com --admin
```

Send the link via a verified out-of-band channel (phone call, IT help desk ticket — NOT the potentially compromised email).

### 7. Reset MFA if needed

If the attacker enrolled MFA (to lock out the legitimate user), follow `identity-mfa-recovery.md`.

### 8. Re-verify the email address if changed

If the attacker changed the email address, restore it:

```sql
UPDATE identity_users
SET primary_email = '<correct-email>',
    email_verified = TRUE,
    updated_at = NOW()
WHERE id = '<user-id>';
```

### 9. Lift the lockout after verification

After the user has regained control via the password reset flow:

```sql
UPDATE identity_credentials
SET failed_login_count = 0, lockout_until = NULL, updated_at = NOW()
WHERE user_id = '<user-id>';
```

---

## Post-incident

### 10. Audit log review

Pull the complete audit trail for the affected user during the compromise window. Identify any data accessed or modified.

### 11. Notify affected parties

Depending on data accessed and your jurisdiction, GDPR / breach notification obligations may apply. Consult your legal team.

### 12. Harden

- Enable MFA for all administrative accounts if not already mandatory.
- Review access logs for the affected workspace.
- Consider increasing argon2id parameters if the vector was a leaked database (see `identity-key-rotation.md`).
