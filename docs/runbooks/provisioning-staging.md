# Runbook: Provisioning Staging

How to activate the dormant staging environment. Run this when buy-in lands.
**Estimated time:** 30–60 minutes.

---

## Prerequisites

- [ ] Staging-specific secrets generated and stored in password manager
- [ ] GitHub Actions Environment `staging` has required reviewers configured
- [ ] DNS is already configured (wildcard A record covers `staging.<DOMAIN>`)

---

## Step 1: Generate staging secrets

```bash
# AUTH_SECRET (different from dev — this is critical)
openssl rand -base64 48

# Postgres password (different from dev)
openssl rand -base64 32
```

Store both in your password manager under "Platform Staging".

---

## Step 2: Configure the staging resource in Coolify

1. In Coolify, open the platform project
2. Create a new Resource for staging (or enable the existing dormant staging resource)
3. Configure:
   - Source: this GitHub repository, `staging` branch
   - Compose file: `infra/docker/staging.yml`
   - Build: disabled (CI pushes images; Coolify only deploys)
4. Set all environment variables from `.env.example`, using staging-specific values for:
   - `APP_ENV=staging`
   - `POSTGRES_URL` — uses the staging Postgres password
   - `AUTH_SECRET` — the staging-specific secret generated above
   - All other variables appropriate for staging

---

## Step 3: Update the Caddyfile

In `infra/caddy/Caddyfile.platform`, replace the staging placeholder block:

```
# BEFORE (dormant):
staging.{$DOMAIN} {
  respond "Staging environment coming soon" 503
}

# AFTER (active):
staging.{$DOMAIN} {
  reverse_proxy web-staging:3001
  encode zstd gzip
  log {
    output file /var/log/caddy/staging-access.log
  }
}
```

Commit, merge to `develop`, then deploy.

---

## Step 4: Initial staging deploy

1. Push the Caddyfile change to `develop`
2. Merge `develop` into `staging`
3. In GitHub Actions, approve the staging deployment
4. Watch the deployment in the GitHub Actions workflow log
5. Wait for the smoke test to pass

---

## Step 5: Verify

- [ ] `https://staging.<DOMAIN>` returns a valid response (not 503)
- [ ] SSL certificate is valid (Let's Encrypt)
- [ ] `/_status` returns `ok: true` with all adapters healthy
- [ ] Attempting to access staging from an external identity works (if staging uses same identity provider)

---

## Notes

- Staging uses the same image tag as `staging` branch — CI controls what's deployed
- Staging database is separate from dev; do not seed with dev data
- Run `pnpm seed:staging` (with `APP_ENV=staging` in your shell) after first provisioning
