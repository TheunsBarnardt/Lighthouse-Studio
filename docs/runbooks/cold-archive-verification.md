# Runbook: Cold Archive Verification

_For verifying archived audit log chunks stored in immutable object storage (Backblaze B2 or Azure Blob with object lock)._

**Note:** Cold archival is an optional feature. If your installation has not enabled `PLATFORM_COLD_ARCHIVE_ENABLED=true`, this runbook does not apply.

---

## Purpose

Cold archival exports daily audit log chunks to immutable object storage with cryptographic signatures. This provides tamper-proof evidence (not just tamper-evident) for audit events, because archived chunks cannot be modified even by a database administrator.

This runbook covers:

1. How to verify archived chunks are intact and signed correctly
2. How to retrieve specific chunks for incident response or auditor review
3. How to perform the periodic verification drill

---

## Architecture Overview

The cold archive system:

1. Daily at UTC 02:00, the archival job collects all audit events from the previous day
2. Events are serialized to JSONL format, one workspace per file
3. A manifest is produced: SHA-256 hash of each file, workspace IDs, event count, date
4. The manifest is signed with the installation's private key (stored in SecretStorePort)
5. Files and manifest are uploaded to object storage with object lock (immutable for the configured retention period)

---

## Verifying a Chunk

### Step 1: List available chunks

```bash
# Via the admin API
curl -s -H "Authorization: Bearer $INSTALLATION_AUDITOR_TOKEN" \
  "https://your-platform/api/v1/installation/cold-archive?startDate=2026-01-01&endDate=2026-05-01" \
  | jq '.chunks[] | {date, workspaceId, eventCount, uploadedAt, manifestSigned}'
```

Or directly from object storage:

```bash
# Backblaze B2
b2 ls --long your-bucket-name audit-archive/

# Azure Blob
az storage blob list \
  --container-name audit-archive \
  --prefix "2026/" \
  --output table
```

### Step 2: Download a chunk and its manifest

```bash
# Example: download a specific day's chunk for a workspace
b2 download-file-by-name \
  your-bucket-name \
  "audit-archive/2026/05/01/workspace-abc123.jsonl.gz" \
  workspace-abc123-2026-05-01.jsonl.gz

b2 download-file-by-name \
  your-bucket-name \
  "audit-archive/2026/05/01/manifest.json" \
  manifest-2026-05-01.json
```

### Step 3: Verify the manifest signature

```bash
# The platform provides a standalone verification tool
node packages/tools/verify-archive-chunk.js \
  --manifest manifest-2026-05-01.json \
  --public-key config/archive-signing-key.pub \
  --chunk workspace-abc123-2026-05-01.jsonl.gz
```

Expected output:

```
Manifest signature: VALID
Chunk hash: MATCHES MANIFEST
Event count: 1,847 (matches manifest: 1,847)
Date range: 2026-05-01T00:00:00Z to 2026-05-01T23:59:59Z
Verification: PASSED
```

### Step 4: Verify chain continuity

The manifest includes the first and last sequence numbers for each workspace chunk. These should be contiguous with adjacent days' chunks:

```bash
# Check sequence continuity across days
node packages/tools/verify-archive-continuity.js \
  --workspace-id workspace-abc123 \
  --start-date 2026-04-01 \
  --end-date 2026-05-01 \
  --manifest-dir ./manifests/
```

---

## Periodic Verification Drill

Run quarterly in conjunction with the chain integrity drill:

1. Select a representative sample of days: oldest available, most recent, and one from the middle of the retention window
2. For each selected day, download the chunk and manifest
3. Run signature verification
4. Run hash verification
5. Spot-check event content: do the events look plausible? Are the workspace IDs expected?
6. Record results

### Recording drill results

```
COLD ARCHIVE VERIFICATION DRILL — YYYY-MM-DD
Performed by: [name]
Chunks verified: [count]
Date range sampled: [start] to [end]
Signature checks: [X/Y passed]
Hash checks: [X/Y passed]
Continuity check: [result]
Issues found: [none / description]
Next drill scheduled: [date]
```

File under SOC 2 evidence artifacts (CC4.1).

---

## Retrieving Chunks for Incident Response

When an incident requires audit evidence from a specific time window:

```bash
# Download all chunks for a workspace for a date range
for DATE in $(seq -w 01 30 | xargs -I{} echo "2026-04-{}"); do
  b2 download-file-by-name \
    your-bucket-name \
    "audit-archive/2026/04/$DATE/workspace-$WORKSPACE_ID.jsonl.gz" \
    "evidence/workspace-$WORKSPACE_ID-$DATE.jsonl.gz" 2>/dev/null || true
done

# Decompress and concatenate
zcat evidence/*.jsonl.gz | sort -t'"' -k... > combined-audit-evidence.jsonl
```

Before providing to an external investigator or auditor, verify the signature and hash for each chunk and provide the verification record alongside the evidence.

---

## Troubleshooting

| Issue                      | Likely Cause                                      | Resolution                                                                           |
| -------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Manifest signature invalid | Signing key rotated without re-signing old chunks | Check key rotation history; re-sign with current key if authorized                   |
| Chunk hash mismatch        | Object storage corruption, or chunk was modified  | This is a critical finding; treat as tampering; escalate                             |
| Missing chunk for a date   | Archival job did not run                          | Check worker logs for that date; re-run archival manually if within retention window |
| Object lock expired        | Retention period configured too short             | Review retention configuration; cannot recover unlocked objects that were modified   |

### If a chunk hash mismatches

A chunk hash mismatch means the chunk file in object storage does not match the hash in the manifest. This is a serious finding:

1. Preserve everything — download all chunks and manifests immediately
2. Determine if object lock was in effect (should prevent modification)
3. Check object storage access logs for unexpected access to that file
4. Escalate to security incident response
5. The database-level audit log is still the primary record; compare the chunk content against the database for the same date

---

## Configuration Reference

Cold archive is configured via:

```bash
PLATFORM_COLD_ARCHIVE_ENABLED=true
PLATFORM_COLD_ARCHIVE_PROVIDER=b2          # or azure
PLATFORM_COLD_ARCHIVE_BUCKET=your-bucket
PLATFORM_COLD_ARCHIVE_RETENTION_DAYS=2555  # 7 years
PLATFORM_COLD_ARCHIVE_SIGNING_KEY_SECRET=cold-archive-signing-key
```

The signing key is a RSA-2048 or Ed25519 private key stored in the secret store. The corresponding public key should be stored externally (not in the same system) so it can be used to verify archives even if the platform is compromised.
