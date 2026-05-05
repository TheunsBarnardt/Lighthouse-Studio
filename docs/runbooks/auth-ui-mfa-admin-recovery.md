# Runbook: MFA Admin Recovery

**Applies to:** Installation administrators  
**Last updated:** 2026-05-05

## Overview

When a user loses access to their MFA device (lost phone, lost authenticator app), they cannot sign in. This runbook covers how an installation administrator resets MFA for a user.

## Prerequisites

- Installation admin access (the `installation:owner` role)
- The user's email address or user ID

## Step 1: Locate the user

Navigate to `/admin/users` and search by the user's email address or name. Click the user row to open their detail page at `/admin/users/<userId>`.

## Step 2: Reset MFA

On the user detail page, click **Reset MFA (admin recovery)** if the user has MFA enabled. Confirm the action.

This sets `mfa_enabled = false` on the user record and invalidates all existing TOTP secrets for the user.

Alternatively, via the API:

```
PATCH /api/v1/admin/users/<userId>
Content-Type: application/json

{ "mfaEnabled": false }
```

## Step 3: Notify the user

The platform sends an `mfa_disabled` email to the user automatically when MFA is reset via the admin panel (once the email service is wired up). Until then, notify the user out-of-band that they can now sign in with password only and should re-enrol MFA.

## Step 4: User re-enrols MFA

The user signs in at `/auth/sign-in` with their password. They navigate to `/account/mfa` and follow the MFA enrolment flow to add a new TOTP device.

## Audit trail

The MFA reset action is recorded in the audit log with:

- `eventType`: `user.mfa_reset_by_admin`
- `actorId`: the admin's user ID
- `targetId`: the affected user's ID
- `metadata.reason`: `admin_recovery`

Review the audit log at `/admin/audit` to confirm the action was recorded.

## Troubleshooting

### Reset MFA button is greyed out

The user does not have MFA enabled. No action is needed; they can sign in with password only.

### User still cannot sign in after MFA reset

Check:

- The `mfa_enabled` field in the database is `false` for this user
- The user is not suspended (`status = 'active'`)
- The user is using the correct password; reset their password if needed via `/admin/users/<userId>` → temporary password or password-reset email flow

### Admin cannot access `/admin/users`

The account must have the `installation:owner` role. Verify in the database:

```sql
SELECT roles FROM users WHERE email = 'admin@example.com';
```

If the role is missing, add it directly to the database for the bootstrapped owner account.
