# Runbook: Provisioning Production

How to activate the dormant production environment. Only do this when the platform is ready for real users.
**Estimated time:** 60–90 minutes.

---

## Prerequisites

- [ ] Staging has been live and stable for at least 2 weeks
- [ ] All known critical bugs are resolved
- [ ] Production secrets generated and stored in password manager + offline copy
- [ ] GitHub Actions Environment `prod` has required reviewers + 5-minute wait timer configured
- [ ] Backup strategy is verified (Restic repo, B2 bucket, passphrase tested)
- [ ] Disaster recovery runbook has been read and drilled on staging

---

## Step 1: Generate production secrets

```bash
# AUTH_SECRET — different from dev AND staging
openssl rand -base64 48

# Postgres password — different from dev AND staging
openssl rand -base64 32
```

Store both in your password manager under "Platform Production". Write the Restic passphrase on paper and store in a physically secure location (sealed envelope, safe, etc.).

---

## Step 2: Configure the production resource in Coolify

1. In Coolify, open the platform project
2. Create or enable the production resource
3. Configure:
   - Source: `main` branch
   - Compose file: `infra/docker/prod.yml`
4. Set all environment variables using production-specific values:
   - `APP_ENV=production`
   - `NODE_ENV=production`
   - All secrets with production-specific values (never reuse staging secrets)

---

## Step 3: Update the Caddyfile

In `infra/caddy/Caddyfile.platform`, replace the prod placeholder block:

```
# BEFORE (dormant):
{$DOMAIN}, www.{$DOMAIN} {
  respond "Production environment coming soon" 503
}

# AFTER (active):
{$DOMAIN}, www.{$DOMAIN} {
  redir https://www.{$DOMAIN}{uri} permanent
}

www.{$DOMAIN} {
  reverse_proxy web-prod:3002
  encode zstd gzip
  log {
    output file /var/log/caddy/prod-access.log
  }
}
```

Commit and merge to `develop`, then promote through to `main`.

---

## Step 4: Enable Restic backups

Update the backup schedule (in the backup sidecar config or cron):

```bash
# On the server, enable the backup cron
crontab -e
# Add:
# 0 3 * * * /opt/platform/scripts/backup.sh 2>&1 | logger -t platform-backup
# 0 4 * * 0 /opt/platform/scripts/backup-full.sh 2>&1 | logger -t platform-backup
```

Test a backup:

```bash
/opt/platform/scripts/backup.sh
restic snapshots
```

---

## Step 5: Initial production deploy

1. Merge `staging` into `main` (after a verified staging run)
2. In GitHub Actions, approve the production deployment
3. Wait for the 5-minute timer to expire
4. Watch the workflow log
5. Smoke test passes automatically

---

## Step 6: Verify

- [ ] `https://<DOMAIN>` returns a valid response with valid SSL
- [ ] `/_status` returns `ok: true` (admin auth required at this point)
- [ ] Restic backup ran successfully: `restic snapshots`
- [ ] Restore drill: restore a single file from the most recent backup
- [ ] Coolify shows the production stack as healthy

---

## Post-launch checklist

- [ ] Update team/stakeholders that production is live
- [ ] Schedule first restore drill (within 30 days)
- [ ] Verify monitoring (Objective 3) is alerting correctly
- [ ] Document the production URL in the team wiki/password manager
