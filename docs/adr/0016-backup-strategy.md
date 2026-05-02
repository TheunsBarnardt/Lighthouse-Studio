# ADR-0016: Backup Strategy

**Status:** Accepted
**Date:** 2026-05-02
**Deciders:** solo

## Context

The platform hosts customer data (workspaces, projects, AI artifacts, user accounts). Data loss in production is a critical failure. The backup system must be:

- Encrypted (data at rest and in transit)
- Off-site (a server fire or provider failure cannot destroy both primary and backup)
- Deduplicated (cost-effective with frequent backups)
- Testable (restore drills must be practical)
- Simple enough for a solo maintainer to operate and recover from without external help

The reference deployment is on a single Afrihost VPS in South Africa. Off-site means a different provider and ideally a different geographic region.

## Decision

**Restic** (open-source backup tool) writing to **Backblaze B2** (S3-compatible object storage).

Retention schedule (when prod activates):

- Daily incremental at 03:00 SAST
- Weekly full snapshot at 04:00 Sunday SAST
- Retention: 30 daily, 12 weekly, 12 monthly

What gets backed up:

- Postgres database via `pg_dump` to a local volume, then Restic picks it up
- Storage volumes (file uploads)
- Encrypted env files

What does NOT get backed up:

- Dev environment (reproducible from seed scripts)
- Container images (rebuildable from git)
- Application code (it's in git)

Encryption:

- Restic repo encrypted with a passphrase
- Passphrase stored in maintainer's password manager + an offline printed copy in a physically secure location (single point of failure on password manager alone is unacceptable for disaster recovery)

Restore drills: quarterly. Documented in `docs/runbooks/disaster-recovery.md`.

## Consequences

### Positive

- Restic's deduplication keeps B2 storage costs low even with frequent backups
- End-to-end encryption: B2 never sees plaintext; Restic encrypts before upload
- B2 is extremely cheap (currently ~$6/TB/month) vs. AWS S3
- Restic supports a wide range of backends (B2, S3, SFTP, local) — switching is one config change
- `restic check` verifies integrity on demand; no silent corruption

### Negative

- Restic is a CLI tool; no managed UI — operations require shell access to the server
- B2's latency from South Africa is higher than a local cloud backup (but acceptable for DR — speed matters during restore, not during backup)
- The passphrase is critical — losing it makes all backups permanently unreadable. The offline copy is a real operational burden.

### Neutral

- Backups are configured from day one but the schedule is disabled for dev (dev data is not worth the operational overhead)
- `prod.yml` Compose stack includes a `restic-backup` sidecar that runs the backup cron job

## Alternatives Considered

### Option A: Backblaze B2 + rclone

Pros: rclone supports more providers and operations than Restic.
Cons: rclone does not do encryption natively — backups would be plaintext on B2. Restic is purpose-built for backups with encryption and deduplication.

### Option B: AWS S3 + aws-backup

Pros: Managed; audit logs; lifecycle policies.
Cons: AWS has latency from South Africa. Creates a cloud dependency. More expensive than B2.

### Option C: On-server snapshots (Vultr/Hetzner snapshots, if provider supports it)

Pros: Simple; provider manages the tooling.
Cons: Afrihost may not support automated snapshots with the right retention. A provider failure destroys both primary data and snapshots. Not truly off-site.

### Option D: Borg Backup to a second VPS

Pros: Self-hosted off-site.
Cons: Second VPS has ongoing cost. Borg requires managing SSH keys to the second server. Restic + B2 is cheaper and simpler.

## References

- Objective 2: Environment Strategy (Section 5.11)
- `docs/runbooks/backup-and-restore.md`
- `docs/runbooks/disaster-recovery.md`
