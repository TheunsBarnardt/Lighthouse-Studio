# @platform/adapter-audit-cold-archive-b2

Backblaze B2 cold-archive adapter for the platform's optional tamper-proof audit log feature.

**Status: stub — not yet fully implemented.** The port interface and composition boundary are in place. See implementation notes below.

## What this does

When `PLATFORM_COLD_ARCHIVE_ENABLED=true`, the daily retention worker:

1. Queries the previous day's audit events per workspace
2. Serializes them to JSON Lines and gzip-compresses
3. Computes a SHA-256 hash of the compressed bytes
4. Signs the hash with the installation's Ed25519 signing key
5. Uploads the signed chunk to B2 with object lock
6. Stores the chunk manifest in `audit_chain_state`

Any party with the platform's public key can independently verify a chunk without database access.

## Configuration

| Env var                         | Required | Description                                      |
| ------------------------------- | -------- | ------------------------------------------------ |
| `PLATFORM_COLD_ARCHIVE_ENABLED` | —        | Set to `true` to enable. Default: disabled.      |
| `B2_KEY_ID`                     | yes      | Backblaze B2 application key ID                  |
| `B2_APPLICATION_KEY`            | yes      | Backblaze B2 application key (secret)            |
| `B2_BUCKET_NAME`                | yes      | Target bucket (must have object lock enabled)    |
| `B2_BUCKET_ID`                  | yes      | B2 bucket ID                                     |
| `B2_LOCK_RETENTION_DAYS`        | yes      | Object lock retention in days (≥2555 for 7-year) |
| `COLD_ARCHIVE_SIGNING_KEY_PEM`  | yes      | PEM Ed25519 private key for chunk signing        |
| `COLD_ARCHIVE_SIGNING_KEY_ID`   | yes      | Key ID for rotation tracking                     |

## B2 bucket requirements

- Object lock must be enabled at bucket creation (cannot be enabled retroactively)
- Lock mode: **COMPLIANCE** (prevents modification even by the account owner during the lock period)
- Application key must have: `readFiles`, `writeFiles`, `listFiles` permissions

## Verification

```bash
# Verify a chunk from the command line (once implemented):
pnpm tsx scripts/verify-cold-archive-chunk.mts --key public-key.pem --object audit/2026/05/01/workspace-id.gz
```

## References

- [ADR-0074: Cold Archive as Optional Feature](../../docs/adr/0074-cold-archive-as-optional.md)
- [Runbook: cold-archive-verification](../../docs/runbooks/cold-archive-verification.md)
- Port interface: `packages/ports/audit/src/cold-archive.port.ts`
