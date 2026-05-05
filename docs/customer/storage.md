# Storage Guide

This guide covers file storage on the Platform: uploading, organizing, securing, and accessing files through the Storage Browser and REST API.

---

## Concepts

### Buckets

A **bucket** is a top-level container for files in your workspace. Think of it like a drive or top-level folder. Every workspace starts with a default bucket; you can create additional buckets to logically separate different types of content (e.g., `documents`, `media`, `exports`).

Each bucket has:

- **Slug** — a URL-safe identifier (e.g., `documents`, `hr-files`)
- **Default permissions** — which workspace roles can read, write, or delete files
- **Default PII flag** — mark all files in this bucket as containing personal data by default
- **Storage class** — `standard` (hot, fast), `infrequent` (cooler, cheaper), or `archive` (cold, cheapest) — availability depends on your storage adapter

### Files

Files have two layers of metadata:

1. **Adapter metadata** — size, ETag, content type (stored in the storage backend)
2. **Platform metadata** — filename, folder path, tags, custom metadata, PII flags, uploader (stored in the platform database and queryable)

### Folders

Folders are a **logical convention** over flat object storage, not real objects. A file at path `reports/2024/q1.pdf` lives in a flat storage bucket under the key `workspaces/<id>/buckets/<bucket>/<path>`. Creating a folder writes a tiny placeholder object (`<path>/.keep`). Deleting a folder deletes all files with that path prefix — this is **not atomic**, so partial failures are reported individually.

### Quota

Every workspace has a storage quota (default: 100 GB). The platform enforces it:

| Usage | Action                                        |
| ----- | --------------------------------------------- |
| ≥ 80% | Warning email to workspace owner              |
| ≥ 95% | Warning email + UI banner                     |
| 100%  | Upload rejected with `STORAGE_QUOTA_EXCEEDED` |

---

## API Reference

All storage endpoints are workspace-scoped:

```
/api/v1/data/{workspaceId}/storage/
```

### Buckets

| Method   | Path                  | Description                     |
| -------- | --------------------- | ------------------------------- |
| `GET`    | `/buckets`            | List all buckets                |
| `POST`   | `/buckets`            | Create a bucket                 |
| `GET`    | `/buckets/{bucketId}` | Get a bucket                    |
| `PUT`    | `/buckets/{bucketId}` | Update a bucket                 |
| `DELETE` | `/buckets/{bucketId}` | Delete a bucket (must be empty) |

### Files

| Method   | Path                                 | Description                         |
| -------- | ------------------------------------ | ----------------------------------- |
| `GET`    | `/files?bucketId=...&folderPath=...` | List files                          |
| `POST`   | `/files`                             | Upload a file (multipart/form-data) |
| `GET`    | `/files/{fileId}`                    | Get file metadata                   |
| `DELETE` | `/files/{fileId}`                    | Delete a file                       |
| `POST`   | `/files/{fileId}/rename`             | Rename a file                       |
| `POST`   | `/files/bulk-delete`                 | Delete multiple files               |
| `POST`   | `/files/bulk-move`                   | Move multiple files                 |
| `PUT`    | `/files/{fileId}/tags`               | Update tags                         |
| `PUT`    | `/files/{fileId}/metadata`           | Update custom metadata              |
| `GET`    | `/files/{fileId}/preview-url`        | Get a short-lived preview URL       |

### Folders

| Method   | Path       | Description                        |
| -------- | ---------- | ---------------------------------- |
| `POST`   | `/folders` | Create a folder                    |
| `DELETE` | `/folders` | Delete a folder (and all contents) |

### Signed URLs

| Method | Path                          | Description         |
| ------ | ----------------------------- | ------------------- |
| `POST` | `/files/{fileId}/signed-url`  | Create a signed URL |
| `POST` | `/signed-urls/{urlId}/revoke` | Revoke a signed URL |

### Quota

| Method | Path     | Description                 |
| ------ | -------- | --------------------------- |
| `GET`  | `/quota` | Get current workspace quota |

---

## Uploading Files

### Small files (< 5 MB)

Use a `multipart/form-data` POST:

```bash
curl -X POST \
  https://your-platform/api/v1/data/{workspaceId}/storage/files \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@report.pdf" \
  -F "bucketId=documents" \
  -F "folderPath=reports/2024"
```

Response:

```json
{
  "id": "01j...",
  "filename": "report.pdf",
  "bucketId": "documents",
  "folderPath": "reports/2024",
  "sizeBytes": 204800,
  "contentType": "application/pdf",
  "tags": [],
  "piiFlag": false,
  "status": "available",
  "createdAt": "2024-01-15T10:00:00Z",
  "updatedAt": "2024-01-15T10:00:00Z"
}
```

### Large files (≥ 5 MB) — resumable via tus.io

Use the tus protocol for files over 5 MB. The platform's upload endpoint is compatible with any tus client.

```bash
# Initiate upload
curl -X POST \
  https://your-platform/api/v1/data/{workspaceId}/storage/uploads \
  -H "Tus-Resumable: 1.0.0" \
  -H "Upload-Length: 1073741824" \
  -H "Upload-Metadata: filename $(echo -n 'bigfile.zip' | base64)" \
  -H "Authorization: Bearer $TOKEN"
# → 201 Created with Location: /api/v1/data/{workspaceId}/storage/uploads/abc123

# Upload in chunks
curl -X PATCH \
  https://your-platform/api/v1/data/{workspaceId}/storage/uploads/abc123 \
  -H "Tus-Resumable: 1.0.0" \
  -H "Content-Type: application/offset+octet-stream" \
  -H "Upload-Offset: 0" \
  --data-binary @chunk.bin
```

If interrupted, resume by checking the current offset:

```bash
curl -X HEAD \
  https://your-platform/api/v1/data/{workspaceId}/storage/uploads/abc123 \
  -H "Tus-Resumable: 1.0.0"
# → Upload-Offset: 524288000
```

---

## Signed URLs

Signed URLs grant time-limited access to a file without authentication. The platform's signed URLs are **revocable** by default — they are verified server-side on every access.

### Creating a signed URL

```bash
curl -X POST \
  https://your-platform/api/v1/data/{workspaceId}/storage/files/{fileId}/signed-url \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ttlSeconds": 3600, "downloadLimit": 5, "description": "Shared with client"}'
```

Response includes a `url` field — share this URL directly. It resolves through the platform and checks revocation on every access.

### Revoking a signed URL

```bash
curl -X POST \
  https://your-platform/api/v1/data/{workspaceId}/storage/signed-urls/{urlId}/revoke \
  -H "Authorization: Bearer $TOKEN"
```

After revocation, the URL returns `404` immediately.

### Direct-mode signed URLs

For high-traffic public assets (e.g., website images), use `"directMode": true` when creating the signed URL. The URL points directly at the storage backend — faster (no platform hop), but **not revocable** without rotating storage credentials.

```json
{ "ttlSeconds": 3600, "directMode": true }
```

---

## File Permissions

### Bucket-level (default)

All files inherit the bucket's role grants. Set them when creating or updating a bucket:

```json
{
  "name": "Public Assets",
  "slug": "public",
  "defaultRoleGrants": {
    "role-member-id": ["read"],
    "role-editor-id": ["read", "write"],
    "role-admin-id": ["read", "write", "delete"]
  }
}
```

### File-level ACL (override)

For individual files that need different permissions than their bucket:

```bash
curl -X POST \
  https://your-platform/api/v1/data/{workspaceId}/storage/files/{fileId}/acl \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "acl": {
      "user:alice-user-id": ["read", "write"],
      "role:auditor-role-id": ["read"]
    }
  }'
```

To remove the override and revert to the bucket default:

```bash
curl -X DELETE \
  https://your-platform/api/v1/data/{workspaceId}/storage/files/{fileId}/acl \
  -H "Authorization: Bearer $TOKEN"
```

---

## PII Tagging

Files containing personal data should be tagged for compliance:

```bash
curl -X PUT \
  https://your-platform/api/v1/data/{workspaceId}/storage/files/{fileId}/metadata \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "metadata": {
      "piiFlag": true,
      "piiCategories": ["identity", "contact"]
    }
  }'
```

PII-tagged files are included in Data Subject Access Requests (DSAR) exports and are eligible for erasure under GDPR "right to be forgotten" workflows.

---

## Storage Browser UI

Navigate to **Storage** in the workspace sidebar to open the browser. Features:

- **Tree view** — browse buckets and folders
- **Grid / List view** — switch between thumbnail grid and metadata table
- **Drag-and-drop upload** — drop files anywhere in the file area
- **Search** — filter by filename, tags, or uploader
- **Bulk operations** — select multiple files to move or delete
- **Previews** — click a file to preview images, PDFs, videos, and markdown inline
- **Quota panel** — see current workspace storage usage
- **Live updates** — file changes from other users appear automatically

---

## Storage Classes

| Class        | When to use                          | Notes                                                                 |
| ------------ | ------------------------------------ | --------------------------------------------------------------------- |
| `standard`   | Frequently accessed files            | Default; supported by all adapters                                    |
| `infrequent` | Accessed less than once a month      | Lower cost; adapter-dependent (Azure: Cool tier)                      |
| `archive`    | Rarely accessed, long-term retention | Very low cost; retrieval takes minutes to hours (Azure: Archive tier) |

Check your workspace's capability matrix to see which classes your storage adapter supports.

---

## Limits

| Limit                    | Default           | Configurable? |
| ------------------------ | ----------------- | ------------- |
| Workspace quota          | 100 GB            | Yes (admin)   |
| Max file size            | 5 GB              | Yes (admin)   |
| Multipart threshold      | 5 MB              | No            |
| Signed URL max TTL       | 7 days            | No            |
| Bulk operation max files | 1,000 per request | No            |
