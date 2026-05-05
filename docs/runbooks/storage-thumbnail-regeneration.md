# Thumbnail Regeneration

**Audience:** On-call engineer  
**Severity:** Low to Medium — functional degradation (UI shows broken images)

---

## Overview

The platform generates thumbnails for image and document files and stores them as `.thumbnails/<size>.jpg` objects adjacent to the original file in the same bucket. For example, the thumbnail for `uploads/photo.jpg` at size `256` is stored at `uploads/photo.jpg/.thumbnails/256.jpg`.

Thumbnails are generated lazily on first view and cached. If they are missing, corrupt, or out of sync with the original file, users see broken image previews.

---

## 1. Detect the Problem

**Via user report:** customer reports broken thumbnails for a specific file or folder.

**Via monitoring:** check the Grafana **Storage** dashboard → **Thumbnail Generation Errors** panel for elevated error rates.

**Via logs:**

```bash
journalctl -u lighthouse-worker --since "1 hour ago" | grep "thumbnail"
# Look for: [thumbnail] generation_failed key=... error=...
```

**Via DB:**

```sql
-- Files with thumbnail errors in the last 24 hours
SELECT storage_key, thumbnail_error, thumbnail_error_at
FROM storage_objects
WHERE thumbnail_error IS NOT NULL
  AND workspace_id = '<workspace_id>'
ORDER BY thumbnail_error_at DESC
LIMIT 50;
```

---

## 2. Force Regeneration for a Single File

Delete the thumbnail objects so they are recreated on next view:

```bash
# B2 example — delete all thumbnail sizes for a file
b2 rm "b2://<bucket-name>/uploads/photo.jpg/.thumbnails/"

# MinIO example
mc rm --recursive myminio/<bucket-name>/uploads/photo.jpg/.thumbnails/
```

Clear the error state in the DB so the platform retries:

```sql
UPDATE storage_objects
SET thumbnail_error = NULL, thumbnail_error_at = NULL
WHERE storage_key = 'uploads/photo.jpg'
  AND workspace_id = '<workspace_id>';
```

On next view, the platform regenerates and caches the thumbnail automatically.

---

## 3. Bulk Regeneration for a Whole Bucket

Use the admin tool to queue regeneration for all files in a bucket:

```bash
pnpm --filter @lighthouse/worker exec ts-node src/tools/regenerate-thumbnails.ts \
  --workspace-id ws_abc123 \
  --bucket-id bkt_xyz789 \
  --sizes 64,256,1024
```

This queues a background job per file. Monitor progress:

```bash
journalctl -u lighthouse-worker -f | grep "thumbnail:regen"
```

The job logs `[thumbnail:regen] complete=N failed=M` when finished.

For very large buckets (>10,000 files), run with `--concurrency 4` to avoid saturating the storage backend.

---

## 4. Verify Thumbnails Are Working

1. Open a file in the platform UI — the thumbnail should render within 5 seconds on first load.
2. Check the DB for any remaining errors:
   ```sql
   SELECT COUNT(*) FROM storage_objects
   WHERE thumbnail_error IS NOT NULL
     AND workspace_id = '<workspace_id>';
   ```
3. Confirm the count reaches zero after regeneration completes.

---

## 5. Root Cause Checks

If thumbnails fail persistently:

- **Unsupported file type:** check `content_type`; only `image/*` and `application/pdf` are processed.
- **Corrupt source file:** try opening the original file outside the platform to confirm it is valid.
- **Worker OOM:** large images can exhaust the thumbnail worker's memory limit; raise `THUMBNAIL_WORKER_MEMORY_MB` in env config.
- **Storage credentials:** verify the worker can write to the bucket (run `verify-credentials` admin endpoint).
