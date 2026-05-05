# Storage Adapter Capability Matrix

_Last updated: 2026-05-05 — Objective 15_

This matrix documents which features are available on each object storage adapter.
The platform's UI hides or disables options that the active adapter does not support.
Capability flags are returned by `ObjectStoragePort.supports(feature)`.

---

## Feature Support

| Feature        | Description                                   | B2                     | Azure Blob                 | MinIO/S3              |
| -------------- | --------------------------------------------- | ---------------------- | -------------------------- | --------------------- |
| `signed_urls`  | Time-limited pre-signed GET/PUT URLs          | ✅                     | ✅                         | ✅                    |
| `multipart`    | Native multipart/block upload (adapter-level) | ❌                     | ✅ (block blobs)           | ✅ (S3 multipart)     |
| `versioning`   | Native object versioning                      | ✅ (B2 lifecycle)      | ✅ (blob versioning)       | ✅ (MinIO versioning) |
| `object_locks` | Immutability / WORM locks                     | ❌                     | ✅ (immutability policies) | ✅ (object locking)   |
| `public_read`  | Objects readable without auth                 | ✅ (B2 public buckets) | ✅ (public containers)     | ✅ (bucket policies)  |

> **Note:** `versioning` and `object_locks` are surfaced as capability flags but the
> platform does not add its own versioning model on top (deferred per Obj 15 scope).
> Adapter-level features are documented per-adapter below.

---

## Platform-Managed Features (All Adapters)

These features are implemented by the platform and work identically on every adapter:

| Feature                    | Implementation                                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Resumable uploads (tus.io) | `POST /storage/uploads` — tus protocol on server side; chunks stored in `FileStore`, assembled on completion |
| Revocable signed URLs      | Proxied through `/api/v1/storage/resolve/[token]`; token recorded in `signed_urls` table                     |
| Per-workspace quota        | Tracked in `storage_quotas` table; soft limits at 80%, 95%; hard limit at 100%                               |
| File metadata & tags       | Stored in `file_records` table; queryable; not stored in adapter-native metadata                             |
| File ACLs                  | Per-file permission overlay stored in `file_acls` table                                                      |
| PII tagging                | `pii_flag` and `pii_categories` on `file_records`                                                            |
| Logical folders            | Path-prefix convention; zero-byte `.keep` placeholder                                                        |
| Image thumbnails           | Generated on first preview via `sharp`; stored at `<key>/.thumbnails/<size>.jpg`                             |
| Audit events               | All operations audited; see `STORAGE_AUDIT_EVENTS` in core                                                   |
| Realtime events            | File changes broadcast on `workspace:<id>:storage` topic                                                     |

---

## Adapter-Specific Details

### Backblaze B2

- **Signed URLs:** B2 download authorization tokens (native API)
- **Storage tiers:** B2 does not support hot/cold/archive tiers — `storageClass` setting is ignored
- **Versioning:** B2 File Versions — each `put` of the same key creates a new version; prior versions accessible via B2 API directly
- **Per-workspace credentials:** B2 application keys scoped to one bucket per workspace
- **Max file size:** 10 TB (B2 native)
- **Limitations:** No native multipart via adapter (tus handles chunking at the platform layer); no WORM locks

### Azure Blob Storage

- **Signed URLs:** Azure SAS tokens (native API)
- **Storage tiers:** Hot, Cool, Archive tiers supported — set via `storageClass` on the bucket
- **Versioning:** Azure Blob versioning — enable on container; each write creates a new version
- **Per-workspace credentials:** Container-level SAS tokens per workspace (read/write scoped)
- **Object locks:** Immutability policies on containers — configure via Azure portal; platform exposes as capability flag
- **Max file size:** 190.7 TiB (block blobs)

### MinIO / S3-Compatible

- **Signed URLs:** S3 pre-signed URLs (native API); works with AWS S3, MinIO, Cloudflare R2, DigitalOcean Spaces
- **Storage tiers:** Lifecycle rules on MinIO; varies by S3-compatible backend — exposed via `storageClass` when supported
- **Versioning:** S3 bucket versioning — enable on bucket; each put creates a new version
- **Per-workspace credentials:** MinIO access keys with policy-scoped bucket access; or AWS IAM policies on S3
- **Object locks:** S3 Object Lock / MinIO object locking — compliance or governance mode
- **Max file size:** 5 TB (S3 multipart max)
- **Path-style:** Enabled by default (`forcePathStyle: true`) for MinIO compatibility

---

## UI Behaviour

| Scenario                                   | Platform behaviour                                                     |
| ------------------------------------------ | ---------------------------------------------------------------------- |
| Adapter does not support `signed_urls`     | "Share via link" button hidden; direct-mode signed URLs unavailable    |
| Adapter does not support `multipart`       | Files ≥ 5 MB upload via platform tus endpoint (chunked at app layer)   |
| Adapter does not support storage tiers     | `storageClass` selector hidden in bucket settings                      |
| `cachePublic: true` set on bucket metadata | Signed URL resolve route returns `Cache-Control: public, max-age=3600` |

---

## Adding a New Storage Adapter

1. Implement `ObjectStoragePort` in `packages/adapters/storage-<name>/`
2. Declare feature support accurately via `supports(feature)`
3. Wire conformance tests in `tests/object-storage.spec.ts` using `runObjectStorageConformance`
4. Update this matrix
5. Reference ADR-0123 (per-workspace credentials) and ADR-0124 (bucket permissions)
