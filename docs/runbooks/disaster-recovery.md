# Runbook: Disaster Recovery

Full server loss scenario: how to recover the platform from scratch.
**Estimated time:** 2–4 hours (depending on data volume).

---

## Scenario: Complete server loss

The VPS is gone (fire, provider failure, ransomware). You have:

- Access to your password manager (contains DB passwords, AUTH_SECRET, B2 credentials, Restic passphrase)
- The offline printed copy of the Restic passphrase (sealed envelope)
- The git repository (on GitHub)

You do NOT have the server or its data — everything must be restored from Restic backups in B2.

---

## Step 1: Provision a new server (30 minutes)

Follow `docs/runbooks/server-provisioning.md` from the beginning.

Critical: use the same domain and DNS — point the A record to the new server IP immediately.

---

## Step 2: Configure B2 and Restic (5 minutes)

```bash
sudo apt-get install restic

export B2_ACCOUNT_ID=<from-password-manager>
export B2_ACCOUNT_KEY=<from-password-manager>
export RESTIC_REPOSITORY=b2:<bucket-name>:/platform
export RESTIC_PASSWORD=<from-password-manager-or-offline-copy>

restic snapshots
```

Verify you can see snapshots. If you cannot, the passphrase is wrong — check the offline copy.

---

## Step 3: Restore Postgres data (20–60 minutes depending on size)

```bash
# Find the most recent snapshot
restic snapshots

# Restore the latest Postgres dump
restic restore latest --target /tmp/restore --path "/tmp/platform-*.sql"

# Start a fresh Postgres container
docker run -d \
  --name postgres-recover \
  -e POSTGRES_DB=platform_prod \
  -e POSTGRES_USER=platform \
  -e POSTGRES_PASSWORD=<prod-db-password> \
  -v platform-postgres-prod-data:/var/lib/postgresql/data \
  postgres:17-alpine

# Wait for it to be ready
sleep 10

# Import the dump
cat /tmp/restore/tmp/platform-prod-*.sql | \
  docker exec -i postgres-recover psql -U platform platform_prod

# Verify
docker exec postgres-recover psql -U platform platform_prod -c "SELECT count(*) FROM workspaces;"
```

---

## Step 4: Restore storage volumes (5–30 minutes)

```bash
restic restore latest --target /tmp/restore --path "/var/platform/storage"
mkdir -p /var/platform/storage
cp -r /tmp/restore/var/platform/storage/* /var/platform/storage/
```

---

## Step 5: Restore and apply Coolify configuration (15 minutes)

1. Install Coolify on the new server (as per provisioning runbook)
2. Restore environment variables from your password manager
3. Re-create the dev/staging/prod resources in Coolify with the recovered credentials
4. Point each stack at the existing Docker volumes (already restored in steps 3 and 4)

---

## Step 6: Redeploy application

```bash
# Trigger a CI deploy from GitHub Actions (runs against the new server's Coolify webhook)
# Or manually pull and start the last known image:
docker pull ghcr.io/<GITHUB_REPOSITORY>:latest
docker compose -f infra/docker/prod.yml up -d
```

---

## Step 7: Verify

- [ ] `https://<DOMAIN>` is reachable with valid SSL
- [ ] `/_status` returns `ok: true`
- [ ] Spot-check data: log in, verify a workspace, verify a recent artifact
- [ ] Run `restic check` on the restored repo to verify integrity
- [ ] Verify Caddy IP restrictions are active (try accessing `coolify.<DOMAIN>` from an unauthorized IP)

---

## Step 8: Notify and document

1. Notify affected users of the outage and recovery
2. Document the incident: what happened, when, what was lost (if anything), recovery time
3. Schedule a review: was the backup/restore process fast enough? what would speed it up?

---

## Contact in a crisis

- B2 account: see password manager
- Afrihost support: see password manager
- DNS registrar: see password manager
- GitHub: see password manager

All critical credentials must be accessible from a **separate device** from the one you normally work on — if the laptop is the disaster, the recovery credentials need to be accessible another way (phone, another machine, the printed offline copy).
