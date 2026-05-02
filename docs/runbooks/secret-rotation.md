# Runbook: Secret Rotation

How to rotate secrets without downtime. Follow the order of operations carefully — rotating in the wrong order can cause an outage.

---

## When to rotate

- Immediately: suspected compromise, team member departure
- Periodically: annually for database passwords, every 6 months for API keys
- On demand: provider requests rotation, key expiry warning

---

## AUTH_SECRET rotation

**Impact:** All active sessions are invalidated — users must re-login.
**Downtime:** None if done via rolling restart.

1. Generate a new secret:
   ```bash
   openssl rand -base64 48
   ```
2. In Coolify, open the environment resource settings for the target environment
3. Update `AUTH_SECRET` to the new value
4. Trigger a redeploy (Coolify restarts the web container with the new secret)
5. Verify the `/_status` endpoint is healthy after redeploy
6. Update the secret in your password manager
7. Inform affected users that they need to re-login

---

## Database password rotation

**Impact:** Brief connection interruption during restart.

1. Connect to Postgres:
   ```bash
   docker exec -it postgres-dev psql -U platform -d platform_dev
   ```
2. Change the password:
   ```sql
   ALTER USER platform WITH PASSWORD 'new-strong-password';
   \q
   ```
3. In Coolify, update `POSTGRES_URL` and `POSTGRES_DIRECT_URL` with the new password
4. Update `POSTGRES_PASSWORD` (used by the Compose stack)
5. Trigger a redeploy
6. Verify connectivity: `pnpm env:check` (from local, with updated `.env.local`)
7. Update the password in your password manager

---

## S3 / Storage key rotation

1. In your S3 provider (B2, AWS, Wasabi), create a new access key pair
2. In Coolify, update `STORAGE_S3_ACCESS_KEY` and `STORAGE_S3_SECRET_KEY`
3. Trigger a redeploy
4. Verify `/_status` reports storage adapter healthy
5. Delete the old key pair from the S3 provider
6. Update credentials in your password manager

---

## SMTP credentials rotation

1. Generate new credentials in your email provider
2. In Coolify, update `SMTP_USER`, `SMTP_PASSWORD`
3. Trigger a redeploy
4. Test email sending (the platform should send a test email if configured; otherwise test via the app)
5. Revoke the old credentials
6. Update in your password manager

---

## Coolify admin password rotation

1. Log in to the Coolify UI
2. Navigate to Account Settings → Security
3. Change the password
4. Update in your password manager
5. If using API tokens: regenerate them and update in GitHub Actions Secrets

---

## GitHub Actions Secrets (Coolify webhook tokens)

1. In Coolify, regenerate the webhook token for the affected environment
2. In GitHub Settings → Environments → `<env>` → Secrets, update `COOLIFY_<ENV>_WEBHOOK_TOKEN`
3. Trigger a test deploy to verify the webhook works

---

## Restic encryption passphrase

This is the most critical secret — losing it makes all backups permanently unreadable.

**Only rotate if:**

- You believe the passphrase has been compromised
- You are doing a planned re-encryption exercise

**Process:**

1. Create a new Restic repository with the new passphrase:
   ```bash
   restic init --repo s3:s3.us-west-000.backblazeb2.com/<BUCKET>/new-repo
   ```
2. Copy all snapshots from the old repo to the new repo (this takes time for large repos)
3. Verify the new repo integrity: `restic check --repo <new-repo>`
4. Update the passphrase in the backup scripts and Coolify env vars
5. Update the passphrase in your password manager AND update the offline printed copy
6. Keep the old repo for 30 days as insurance, then delete it

**Never** rotate the Restic passphrase without first verifying you have the new passphrase stored in multiple locations.

---

## After any rotation

- Update your password manager immediately
- Verify the `/_status` endpoint reports all adapters healthy
- Document the rotation in your ops log (date, what was rotated, why)
