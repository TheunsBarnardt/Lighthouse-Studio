# Runbook: Invitation Troubleshooting

**Applies to:** Workspace administrators and installation operators  
**Last updated:** 2026-05-05

## Overview

Workspace members are added by invitation. This runbook covers diagnosing and resolving invitation failures.

## Invitation flow summary

1. Workspace admin sends an invitation from `/workspaces/<slug>/members` → **Invite member**.
2. The platform creates an invitation record and sends an email to the invitee.
3. The invitee clicks the link in the email (contains a one-time token).
4. The link opens `/auth/accept-invitation?token=<token>`.
5. If the invitee has an account they sign in; if not they register.
6. On acceptance, the invitee is added to the workspace as a member.

## Common issues

### Invitation email not received

1. Check the workspace's **SMTP configuration** is set and valid.
2. Check your SMTP server's outbound logs for delivery status.
3. Verify the invitee's email address is correct on the `/workspaces/<slug>/invitations` page.
4. Check spam/junk folders.
5. If SMTP is not configured, the invitation email is logged to the application console in development mode (look for `[DEV] Invitation email for ...`).

### "Invalid or expired invitation" on the acceptance page

Invitation tokens expire after 7 days by default. If the link has expired:

1. Go to `/workspaces/<slug>/invitations`.
2. The expired invitation may still appear. Revoke it and send a new one.

If the token is reported invalid immediately after sending, check:

- The base URL is configured correctly (`NEXT_PUBLIC_APP_URL` / `APP_URL` env var). If the link in the email uses `localhost` but the user clicks it on a different machine, the token validation endpoint returns invalid.

### User accepted but not appearing in member list

1. Navigate to `/workspaces/<slug>/members` and check the **Pending** tab — the user may appear there instead of the **Members** tab if the acceptance flow completed partially.
2. Check the audit log at `/admin/audit` for `workspace.member_added` events around the acceptance time.
3. If absent, check application logs for errors during the `POST /api/v1/auth/invitations/<token>/accept` request.

### Invitation sent to wrong email

1. Navigate to `/workspaces/<slug>/invitations`.
2. Click **Revoke** next to the incorrect invitation.
3. Send a new invitation to the correct email.

Revoking an invitation prevents the link in the original email from being used, even if it hasn't expired.

### User already has an account but is prompted to register

The acceptance page at `/auth/accept-invitation` detects whether the user is signed in. If they are not, it shows a sign-in / register toggle. The user should click **Sign in** and use their existing credentials. After sign-in, the acceptance is completed automatically.

## Checking invitation status via API

```
GET /api/v1/workspaces/<slug>/invitations
```

Returns pending invitations with `token`, `email`, `roleIds`, `expiresAt`, and `createdAt`.

```
GET /api/v1/auth/invitations/<token>/validate
```

Returns the invitation details (email, workspace, roles) without consuming the token. Useful for debugging token validity.

## Audit events

| Event                          | Trigger                                            |
| ------------------------------ | -------------------------------------------------- |
| `workspace.invitation_sent`    | Invitation created and email dispatched            |
| `workspace.invitation_revoked` | Admin revokes pending invitation                   |
| `workspace.invitation_expired` | Invitation token TTL elapsed (recorded at cleanup) |
| `workspace.member_added`       | Invitation accepted and member added to workspace  |
