# Runbook: First-Run Setup

**Applies to:** New Lighthouse Studio installations  
**Last updated:** 2026-05-05

## Overview

When Lighthouse Studio starts for the first time there is no owner account and no workspace. This runbook covers completing the first-run setup wizard and troubleshooting failures.

## Normal setup flow

1. Deploy Lighthouse Studio and navigate to `https://<your-domain>/setup`.
2. The wizard checks `/api/v1/setup/status`. If setup is already complete it redirects to sign-in — this means setup has already run (skip to step 6).
3. Fill in:
   - **Your name** — the installation owner's display name
   - **Email address** — used to sign in; must be a valid email
   - **Password** — at least 8 characters
   - **Workspace name** — human-readable name for the first workspace
   - **Workspace slug** — URL-safe identifier (lowercase, hyphens, no spaces)
4. Click **Complete setup**.
5. On success you are signed in automatically and redirected to the first workspace dashboard.
6. The `/setup` route now redirects to `/auth/sign-in` permanently.

## Troubleshooting

### "Setup already complete" error but I can't sign in

The database contains a user record from a previous attempt or migration, so `/api/v1/setup/status` returns `setupComplete: true`. To reset:

1. Connect to the database directly.
2. Verify with: `SELECT COUNT(*) FROM users;`
3. If there are orphaned records from a failed migration, delete them: `DELETE FROM users; DELETE FROM workspaces; DELETE FROM workspace_members;`
4. Restart the application to clear in-memory state (if using the in-memory adapter).
5. Navigate to `/setup` again.

**Warning:** Only do this on a fresh installation with no real data. This operation is destructive.

### Setup form submits but redirects to 500

Check application logs for the error. Common causes:

- Database is not reachable (check `DATABASE_URL` environment variable and network connectivity)
- The `users` or `workspaces` table does not exist (run migrations: `pnpm db:migrate`)
- The slug chosen is already taken (slug uniqueness is enforced at the DB level; choose a different slug)

### Password strength validation fails

Passwords must be at least 8 characters. The client validates this before submission; if you see the error server-side it means the validation middleware caught a bypassed request. Use a password of 8+ characters.

### Workspace slug validation fails

Slugs must match `^[a-z0-9-]+$`. Common issues:

- Contains uppercase letters — convert to lowercase
- Contains spaces — use hyphens instead
- Contains special characters — remove them

## Post-setup checklist

- [ ] Sign in at `/auth/sign-in` with the owner credentials
- [ ] Navigate to `/account/profile` and confirm display name is set correctly
- [ ] Navigate to `/workspaces/<slug>/members` and confirm you appear as a member
- [ ] Send a test invitation to a second email address
- [ ] Configure SMTP settings (if applicable) so outbound emails work
