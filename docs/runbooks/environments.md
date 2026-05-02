# Runbook: Environments

Overview of the platform's three environments, their URLs, access, and operational procedures.

---

## Environment overview

| Environment | Web URL            | Status  | Branch    | Deploy trigger    |
| ----------- | ------------------ | ------- | --------- | ----------------- |
| dev         | `dev.<DOMAIN>`     | Active  | `develop` | Auto (CI webhook) |
| staging     | `staging.<DOMAIN>` | Dormant | `staging` | Manual approval   |
| prod        | `<DOMAIN>` (apex)  | Dormant | `main`    | Manual approval   |
| Coolify     | `coolify.<DOMAIN>` | Active  | n/a       | n/a               |

---

## Access

**dev:** Open (no auth required). Accessible to the development team.

**staging:** Accessible to the development team. When activated, requires the same credentials as production (same user base, different data).

**prod:** When activated, restricted to production users.

**Coolify admin:** IP-restricted. Only accessible from whitelisted IPs. See `docs/runbooks/server-provisioning.md` for IP management.

---

## Switching the AI worker between environments

The worker reads its environment from `APP_ENV` and `POSTGRES_URL`.

**Worker running locally (Phase 1):**

1. Edit `.env.local`
2. Set `APP_ENV=development` and `POSTGRES_URL=<dev-db-url>`
3. Restart pm2: `pm2 restart worker`

**When switching to a different env:** Never point the local worker at staging or prod. Local machines should only connect to dev.

---

## Switching adapter drivers

To change, e.g., from `local` storage to `s3`:

1. In Coolify, open the environment's resource settings
2. Update `STORAGE_DRIVER=s3`
3. Add the required `STORAGE_S3_*` variables
4. Trigger a redeploy
5. Verify the `/_status` endpoint reports the storage adapter as healthy

See `docs/runbooks/adapter-switching.md` for the full procedure including data migration.

---

## Promoting changes

**dev:** Merge a PR to `develop`. GitHub Actions builds and deploys automatically.

**staging (dormant):** Follow `docs/runbooks/provisioning-staging.md` first. Once active, merge to `staging` and approve in GitHub Actions.

**prod (dormant):** Follow `docs/runbooks/provisioning-prod.md` first. Once active, merge to `main`, approve in GitHub Actions, wait 5-minute timer.

---

## Checking environment health

```bash
curl https://dev.<DOMAIN>/_status
```

Returns JSON with adapter health status. In staging/prod (once activated), requires admin auth.

---

## Emergency: manually restarting a stack

SSH to the server, then:

```bash
# Restart dev stack
docker compose -f /opt/platform/infra/docker/dev.yml restart

# Or restart a specific container
docker restart web-dev
```

---

## Viewing logs

```bash
# Web app logs
docker logs web-dev --follow

# Postgres logs
docker logs postgres-dev --follow

# All containers in the dev stack
docker compose -f /opt/platform/infra/docker/dev.yml logs --follow
```

Caddy access logs: `/var/log/caddy/dev-access.log`
