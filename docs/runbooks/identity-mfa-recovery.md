# Runbook: MFA Recovery

Steps to help a user who has lost their TOTP authenticator AND their recovery codes.

**This is a high-security operation.** Verify the user's identity by multiple channels before proceeding.

---

## Identity verification (required before any action)

Before resetting MFA, verify the user is who they claim to be:

1. Confirm the user's identity via a **secondary channel** (video call, in-person, HR ticket, manager confirmation).
2. Do not reset MFA based solely on an email request.
3. Log the recovery event (who approved, when, which secondary channel was used).

---

## Step 1: Confirm the user's account and MFA status

```sql
SELECT id, primary_email, status, mfa_enabled
FROM identity_users
WHERE LOWER(primary_email) = LOWER('<user@example.com>');
```

```sql
SELECT mfa_ciphertext IS NOT NULL as has_mfa, array_length(recovery_codes, 1) as code_count
FROM identity_credentials
WHERE user_id = '<user-id>';
```

---

## Step 2: Disable MFA for the user

```sql
-- Clear the TOTP secret and recovery codes
UPDATE identity_credentials
SET mfa_ciphertext = NULL,
    mfa_key_version = NULL,
    recovery_codes = '{}',
    updated_at = NOW()
WHERE user_id = '<user-id>';

-- Mark the user as not MFA-enrolled
UPDATE identity_users
SET mfa_enabled = FALSE,
    updated_at = NOW()
WHERE id = '<user-id>';
```

---

## Step 3: Revoke all active sessions

After resetting MFA, revoke existing sessions to force re-authentication:

```sql
DELETE FROM identity_sessions WHERE user_id = '<user-id>';
```

---

## Step 4: Notify the user and require re-enrollment

1. Inform the user that their MFA has been reset.
2. Instruct them to sign in with their password and immediately re-enroll MFA.
3. If MFA is mandatory in your deployment, set a deadline for re-enrollment and revoke access after that deadline if not completed.

---

## Step 5: Audit log entry

Record the recovery event in the audit log with:

- Admin user ID who performed the action
- Affected user ID
- Timestamp
- Reason (linked to the approval ticket or conversation)

---

## Prevention

Advise users to:

- Store recovery codes in a password manager (e.g., 1Password, Bitwarden).
- Print and store recovery codes in a secure physical location.
- Add the TOTP secret to multiple devices (authenticator app on phone + backup device or desktop app).
