# Objective 15: Storage Browser & File Management

**Status:** Ready for development
**Prerequisites:** All foundation objectives (1–10) complete; Objective 12 (REST APIs) for the upload endpoints; Objective 14 (Realtime) for live updates in the storage UI
**Blocks:** Objective 18 (Data Browser uses storage for image/file column types); Objective 19 (Public SDK exposes the storage client)

---

## 1. Purpose

Expose the platform's `ObjectStoragePort` (from Objective 1.5, with adapters for Backblaze B2, MinIO, Azure Blob Storage, etc.) as a **complete file management product feature**. Customers can:

- Upload files via API or the UI
- Organize files into buckets and folders (logical structure)
- Set per-file and per-folder permissions
- Generate signed URLs for time-limited public access
- Watch storage events in real time (file created, deleted, renamed)
- Browse files in a polished UI with previews, search, and bulk operations
- Use storage for typed columns (image, video, document) in their schemas (foundation for Objective 18)

This is the Supabase Storage equivalent. Like every other module objective, it must work consistently across all the underlying storage adapters — Backblaze B2 for self-hosted Linux deployments, Azure Blob for Microsoft houses, MinIO for fully on-premise environments — without leaking adapter-specific concerns into the customer-facing API.

This objective produces a **fully functional file management feature** that's part of the product, not a technical capability sitting underneath one. By the end, a customer can install the platform, navigate to "Storage" in the workspace UI, and have a working dropbox-like experience over their chosen storage backend.

---

## 2. Scope

### In Scope

- **Logical file model**: buckets, folders, files; metadata; tags
- **Storage service**: upload, download, copy, move, rename, delete, signed URLs
- **Multipart / resumable uploads**: large files don't have to fit in one request
- **Storage events**: realtime updates when files change (using the realtime layer from Objective 14)
- **Permissions on storage**: per-bucket roles; per-file ACLs as overlay
- **Signed URLs**: time-limited public access; revocable; scoped
- **File metadata**: content type, size, uploader, tags, custom metadata fields
- **Storage browser UI**: tree view + grid/list view, breadcrumb navigation, search
- **File previews**: image, PDF, video (basic), text/markdown rendering inline
- **Bulk operations**: multi-select, bulk delete, bulk move, bulk download (zipped)
- **Quotas**: per-workspace storage quota; soft warnings + hard limits
- **Audit events**: every file operation
- **Cross-adapter conformance**: tests verifying behavior is consistent on B2, Azure Blob, MinIO, S3-compatible backends
- **Per-workspace storage isolation**: customer A's files cannot be read by customer B's principals; verified by isolation tests
- **Optimistic concurrency**: ETags for conditional updates
- **Configurable storage classes**: hot vs. cold tiers where the adapter supports it (B2 doesn't tier; Azure Blob does; documented)
- **PII tagging on files**: customer can mark files as containing PII for compliance machinery
- ADRs

### Out of Scope (Belongs to Later Objectives)

- Image transformations / resizing on upload (deferred — most customers use a CDN or do it client-side; can add as a follow-up)
- Video transcoding (separate concern; vastly more complex; defer indefinitely)
- Full-text search over file contents (PDFs, Word docs) — the metadata is searchable; content search is a future feature
- File versioning beyond what the storage adapter natively provides (Backblaze B2 has versioning; Azure Blob does too; we surface but don't add a versioning model on top)
- Sharing with external (non-platform) users (deferred; customers use signed URLs for now)
- Scheduled delete / lifecycle policies (deferred — adapter-level policies are documented; platform-level lifecycle rules are a follow-up)
- ZIP / archive extraction (deferred)
- WebDAV / S3-API compatibility (defer; if a customer needs WebDAV, we provide it through MinIO directly)

---

## 3. Locked Decisions

| Decision                    | Choice                                                                                                                                  | Rationale                                                                             |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Logical model               | Bucket → folder hierarchy → file                                                                                                        | Matches user expectations; maps cleanly to flat object storage                        |
| Bucket scoping              | One platform-managed bucket per workspace by default; customers can configure additional buckets                                        | Simple isolation; customer can split if needed                                        |
| Folder representation       | Folders are conventions over flat object keys (no real folder objects)                                                                  | Standard object-storage pattern; nothing custom                                       |
| Path format                 | Unix-style forward-slash paths in the platform's logical model: `bucket/folder/subfolder/file.pdf`                                      | Standard; URL-friendly                                                                |
| Metadata location           | Two layers: (1) storage adapter native metadata (small, opaque); (2) database-backed extended metadata (queryable)                      | Native metadata for adapter-level concerns; DB metadata for searching, tagging, audit |
| Upload protocol             | tus.io for resumable uploads; simple HTTP POST for small files                                                                          | Industry standard; supported by client libraries                                      |
| Multipart threshold         | 5 MB — files above use resumable; below use direct POST                                                                                 | Reasonable cutoff; matches S3 multipart minimum                                       |
| Max single-file size        | 5 GB default; configurable per workspace                                                                                                | Sane default; some adapters limit higher                                              |
| Max workspace storage quota | Configurable; default 100 GB per workspace                                                                                              | Tunable; quota enforcement is mandatory                                               |
| File permissions model      | Bucket-level role grants; file-level ACL overlay (override)                                                                             | Simple by default; fine-grained when needed                                           |
| Signed URL TTL              | Default 1 hour; max 7 days; configurable per signed URL                                                                                 | Balances utility and security                                                         |
| Signed URL revocation       | URL contains a token recorded in the database; revocation flips a flag; verification checks the flag                                    | Standard pattern                                                                      |
| ETag strategy               | Storage adapter native ETag (S3-style MD5 or content hash); used for conditional updates                                                | Standard                                                                              |
| File previews               | Rendered server-side for images (thumbnails generated on first view); native browser rendering for PDF/video; markdown rendered to HTML | Pragmatic; thumbnails cached                                                          |
| Thumbnail storage           | Same bucket; `<file>/.thumbnails/<size>.jpg` convention                                                                                 | Adjacent to original; co-deleted on file delete                                       |
| File tags                   | Stored in DB-backed metadata; queryable; used for organization                                                                          | Customer-defined; not stored in object metadata for portability                       |
| Search                      | Filename + metadata search via the database; full-content search deferred                                                               | Adequate for typical use; doesn't require a search engine                             |
| Realtime updates            | Storage events flow through the realtime layer from Objective 14                                                                        | Reuse, don't duplicate                                                                |
| Adapters supported in v1    | B2, Azure Blob, MinIO/S3                                                                                                                | Covers Linux, Windows, on-premise scenarios                                           |

---

## 4. Architectural Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                        CUSTOMER UI                                    │
│                                                                       │
│   Storage Browser Page                                                │
│   - Tree view (left), Grid/List (right)                               │
│   - Breadcrumb, search, bulk actions                                  │
│   - Drag-and-drop upload                                              │
│   - File previews                                                     │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ REST API + Realtime subscription
                               ▼
        ┌────────────────────────────────────────┐
        │       StorageService                    │
        │                                          │
        │   - List/get/upload/copy/move/delete    │
        │   - Generate signed URLs                │
        │   - Manage tags and metadata             │
        │   - Enforce quotas                       │
        │   - Authorize via RBAC                   │
        │   - Audit every operation                │
        │   - Emit realtime storage events         │
        └─────────────────┬──────────────────────┘
                          │
              ┌───────────┴───────────┐
              │                        │
              ▼                        ▼
   ┌────────────────────┐   ┌────────────────────┐
   │ ObjectStoragePort  │   │  Persistence       │
   │ (one of:)          │   │   - file_records   │
   │ - storage-b2       │   │   - signed_urls    │
   │ - storage-azure    │   │   - file_acls       │
   │ - storage-minio    │   │   - storage_quotas │
   │ - storage-s3       │   └────────────────────┘
   └─────────┬──────────┘
             │
             ▼
   ┌────────────────────┐
   │  Cloud / on-prem   │
   │  object storage    │
   └────────────────────┘
```

The platform doesn't replace the object storage backend — it sits in front of it as a permission, audit, and metadata layer. The actual files live in B2, Azure Blob, or wherever the customer's adapter points. The platform's database tracks metadata and permissions; the storage adapter handles the bytes.

---

## 5. The Hard Parts

**5.1 The "logical folder" abstraction**

Object storage is flat. There are no "folders" — only object keys with slashes. But users expect folders. The platform fakes them:

- A folder is just a path prefix
- The "create folder" operation creates a zero-byte placeholder object (`<folder>/.keep`) so empty folders display in the UI
- The "move folder" operation lists all objects with that prefix and renames each (multi-object operation; not atomic)
- The "delete folder" operation lists and deletes all objects with that prefix (also non-atomic)

The non-atomicity is honest: bulk operations can partially fail. The UI surfaces partial failures clearly with retry options. The audit log records every individual file operation, not the bulk operation, so forensics can reconstruct exactly what happened.

For the user, this looks like Dropbox. Underneath, it's flat S3. The abstraction is pragmatic.

**5.2 Database-backed metadata for everything queryable**

Storage adapters have limited native metadata: a few key-value pairs (often capped at 2 KB total), and that's it. The platform needs much more:

- Custom tags (any number)
- Description / notes
- Uploader user_id
- PII flags
- Access count, last-accessed time
- Folder memberships (logical structure)

All this lives in a `file_records` table in the platform's database. Every file in storage has exactly one corresponding `file_records` row. The two are kept in sync:

- On upload: write to storage first, then write to DB
- On delete: delete from DB first (so subsequent operations don't find it), then from storage
- Periodic reconciliation job: detect orphans (DB rows pointing to missing storage objects, storage objects without DB rows) and flag them

Reconciliation is critical: storage uploads can fail after the bytes are written; cleanup is part of operations. The reconciliation job runs nightly; alerts on unexpected drift.

**5.3 Resumable uploads via tus.io**

Large files (multi-GB videos, datasets) can't be uploaded in one HTTP request reliably. The tus protocol handles this:

- Client initiates: `POST /uploads` with file metadata; server returns an upload URL
- Client uploads in chunks: `PATCH <upload_url>` with bytes and offset
- If interrupted: `HEAD <upload_url>` returns the offset; client resumes
- On completion: server finalizes; the file appears in the bucket

The platform implements tus on its API surface; the chunks land in the storage adapter via the adapter's multipart upload primitives (S3 multipart, Azure block blob, B2 large file). The mapping between tus protocol and the adapter primitive is per-adapter logic.

For files under 5 MB, a simpler `POST /buckets/<bucket>/files` with the file body works directly. The SDK picks the right method based on file size.

**5.4 Permissions: bucket-level + file-level overlay**

Most files inherit permissions from their bucket. A few may need overrides (e.g., a "private" file in a generally-shared bucket).

The model:

- A bucket has default permissions (read, write, delete) granted to roles
- A file can have an ACL that OVERRIDES the bucket default
- The effective permission for a (principal, file) pair: file ACL if present, else bucket default

This keeps the simple case simple (most files just inherit) while allowing exceptions. Per-folder permissions could be added later but aren't in the v1 scope — the bucket-level + file-level overlay is sufficient for typical needs.

The `data_table` permission pattern from Objective 12 is reused here as `storage_bucket` and `storage_file`:

- `storage_bucket.read`, `storage_bucket.write`, `storage_bucket.delete`
- `storage_file.read`, `storage_file.write`, `storage_file.delete` (for ACLs)

**5.5 Signed URLs that are revocable**

Standard signed URLs (S3, Azure Blob native) are stateless — the URL itself encodes the permission. Once issued, you can't revoke it without rotating the signing key (which invalidates all URLs).

The platform's signed URLs are different:

- The URL points at the platform, not at the storage backend directly
- The URL contains a token; the token's record is in the `signed_urls` table
- When the URL is hit, the platform verifies the token, looks up the underlying storage URL (if cached) or generates one with a short TTL, and proxies the response

Trade-off: every signed URL request hits the platform. For high-traffic public files (e.g., a customer's website assets), this is a performance concern. The platform addresses it two ways:

- **Caching**: signed URL hits are cached at the HTTP layer (Cache-Control: public, max-age=N) for files marked `cache_public: true`
- **Direct mode**: for files where revocability isn't needed, the signed URL points directly at the storage backend's native signed URL; revocation requires key rotation. Documented trade-off; chosen per-file or per-bucket.

The default is the proxied, revocable URL. Customers needing CDN-style performance switch specific buckets to direct mode.

**5.6 Quotas**

Per-workspace storage quota is enforced:

- Soft limit at 80% of quota: warning email to workspace owner
- Soft limit at 95% of quota: warning email + UI banner
- Hard limit at 100% of quota: uploads rejected with `STORAGE_QUOTA_EXCEEDED`

The current usage is tracked in a `storage_quotas` table, updated on every upload/delete. To avoid race conditions, updates use optimistic locking or per-workspace incremental updates. Periodic reconciliation against actual storage usage corrects any drift.

Workspace admins can request quota increases via an admin path (in early product, this is a configuration change; later, it could be self-service with billing).

**5.7 Cross-adapter conformance**

The same operations must produce equivalent results on every adapter:

- Upload a file to bucket X — same result on B2, Azure Blob, MinIO
- List files in folder Y — same result; same ordering (alphabetical)
- Generate a signed URL — same TTL behavior, same revocability
- Bulk delete — same partial-failure semantics
- ETag-based conditional update — same precondition behavior

Adapter-specific features (e.g., Azure's blob tiering, B2's lifecycle policies) are exposed via capability flags. Customers using Azure can configure tiering; customers on B2 can't (B2 doesn't have it). The UI shows or hides the option accordingly.

The conformance test suite from Objective 4c is extended with storage-specific tests; runs in the cross-database CI matrix (because storage often pairs with database choice — Azure Blob with MSSQL, B2 with anything else).

**5.8 Realtime storage events**

Customers want to know when files change in real time:

- A user uploads a file → another user sees it in their browser without refresh
- A file is deleted → it disappears from open browsers immediately

The platform routes storage events through the realtime layer from Objective 14:

- File operations emit a "storage event" of type `file.created`, `file.updated`, `file.deleted`, `file.moved`
- These events flow to a logical "storage" stream per workspace
- Subscribers (the storage browser UI, or customer code) subscribe via the same SubscriptionManager, with the same filter/permission/PII machinery

This means the storage browser feels live in the same way the data browser will feel live — the platform's UX consistency is structural, not stylistic.

**5.9 PII tagging on files**

Files can contain PII (a CV in the HR drive, a customer-uploaded ID document, etc.). The customer can tag a file as PII via the metadata:

- `pii: true`
- `pii_categories: ["identity", "contact"]`

This integrates with the personal data registry from Objective 7:

- On data subject access request: the platform's export includes references to PII-tagged files (with signed URLs, time-limited)
- On erasure request: PII-tagged files associated with the user are deleted (where eraseable) or anonymized (where retained for legal hold)

The customer can also create a default for a bucket: "all files in this bucket are PII." Useful for HR drives, customer document storage, etc.

**5.10 Thumbnail and preview generation**

Image previews:

- On first view of an image, generate thumbnails (small, medium, large)
- Store in the same bucket under a `.thumbnails/` prefix relative to the original
- Subsequent views serve cached thumbnails directly
- Original image deletion cascades to thumbnail deletion

PDF previews:

- Native browser rendering via `<embed>` or PDF.js
- Server-side generation of preview images is deferred (significant complexity for not much gain; browsers handle PDFs well)

Video previews:

- Native HTML5 `<video>` tag for browser-supported formats (MP4)
- Other formats display a placeholder; advise the user to download
- Server-side video transcoding is out of scope

Markdown / text:

- Rendered to HTML server-side using a sanitizing renderer
- Code blocks syntax-highlighted

The preview generation is itself an audited operation; the customer sees who viewed which file when (even if just for a preview).

**5.11 The "files in schemas" foundation**

For Objective 18 (Data Browser), customer schemas can have columns of type `file` (or `image`, `video`). A row's value for such a column is a reference to a file in storage. This objective lays the groundwork:

- The schema designer (Objective 11) supports `file` / `image` / `video` column types
- The REST/GraphQL APIs (Objectives 12, 13) handle these types: writes accept file IDs; reads return the file metadata (with optional thumbnail URLs)
- The data browser (Objective 18) renders these columns appropriately (image preview, file download link)

The actual rendering happens in Objective 18; this objective ensures the storage service supports being referenced this way.

---

## 6. Component Specifications

### 6.1 StorageService

```typescript
// packages/core/src/services/data-management/storage/storage.service.ts

export class StorageService {
  constructor(
    private readonly authz: AuthorizationPort,
    private readonly storage: ObjectStoragePort,
    private readonly fileRecords: RepositoryPort<FileRecord>,
    private readonly fileAcls: RepositoryPort<FileAcl>,
    private readonly signedUrls: RepositoryPort<SignedUrlRecord>,
    private readonly quotas: RepositoryPort<StorageQuota>,
    private readonly audit: AuditPort,
    private readonly logger: LoggerPort,
    private readonly realtime: RealtimeBroadcaster,
  ) {}

  // Bucket operations
  async listBuckets(ctx: RequestContext): Promise<Result<Bucket[], AppError>>;
  async createBucket(ctx: RequestContext, input: CreateBucketInput): Promise<Result<Bucket, AppError>>;
  async getBucket(ctx: RequestContext, bucketId: string): Promise<Result<Bucket, AppError>>;
  async updateBucket(ctx: RequestContext, bucketId: string, changes: BucketUpdate): Promise<Result<Bucket, AppError>>;
  async deleteBucket(ctx: RequestContext, bucketId: string): Promise<Result<void, AppError>>;

  // File operations
  async listFiles(ctx: RequestContext, opts: ListFilesOptions): Promise<Result<PaginatedResult<FileRecord>, AppError>>;
  async getFile(ctx: RequestContext, fileId: string): Promise<Result<FileRecord, AppError>>;
  async uploadFile(ctx: RequestContext, input: UploadFileInput): Promise<Result<FileRecord, AppError>>;
  async copyFile(ctx: RequestContext, fileId: string, destination: FileLocation): Promise<Result<FileRecord, AppError>>;
  async moveFile(ctx: RequestContext, fileId: string, destination: FileLocation): Promise<Result<FileRecord, AppError>>;
  async renameFile(ctx: RequestContext, fileId: string, newName: string): Promise<Result<FileRecord, AppError>>;
  async deleteFile(ctx: RequestContext, fileId: string): Promise<Result<void, AppError>>;

  // Bulk operations
  async bulkDelete(ctx: RequestContext, fileIds: string[]): Promise<Result<BulkOperationResult, AppError>>;
  async bulkMove(ctx: RequestContext, fileIds: string[], destination: FileLocation): Promise<Result<BulkOperationResult, AppError>>;

  // Folder operations (convention-based)
  async createFolder(ctx: RequestContext, bucketId: string, path: string): Promise<Result<void, AppError>>;
  async deleteFolder(ctx: RequestContext, bucketId: string, path: string): Promise<Result<BulkOperationResult, AppError>>;
  async moveFolder(ctx: RequestContext, bucketId: string, fromPath: string, toPath: string): Promise<Result<BulkOperationResult, AppError>>;

  // Signed URLs
  async createSignedUrl(ctx: RequestContext, fileId: string, opts: SignedUrlOptions): Promise<Result<SignedUrlRecord, AppError>>;
  async revokeSignedUrl(ctx: RequestContext, signedUrlId: string): Promise<Result<void, AppError>>;
  async resolveSignedUrl(token: string): Promise<Result<{ fileId: string; storageUrl: string }, AppError>>;

  // Tags and metadata
  async setTags(ctx: RequestContext, fileId: string, tags: string[]): Promise<Result<FileRecord, AppError>>;
  async setMetadata(ctx: RequestContext, fileId: string, metadata: Record<string, unknown>): Promise<Result<FileRecord, AppError>>;

  // ACLs
  async setFileAcl(ctx: RequestContext, fileId: string, acl: FileAcl): Promise<Result<void, AppError>>;
  async removeFileAcl(ctx: RequestContext, fileId: string): Promise<Result<void, AppError>>;

  // Quota
  async getQuota(ctx: RequestContext): Promise<Result<StorageQuota, AppError>>;
}
```

Each method follows the canonical service pattern from Objective 8. Input validation, authorization, execution, audit, return.

### 6.2 Database Schema

```typescript
// Logical schema (translated per database)

storage_buckets: {
  ...standardColumns,
  workspace_id: uuid,
  name: string(255),
  slug: string(100),
  description: text?,
  default_role_grants: json,    // { 'role_id': ['read', 'write'] }
  default_pii_flag: boolean,
  storage_class: enum,            // 'standard', 'infrequent', 'archive' (where supported)
  metadata: json,
}
unique: [workspace_id, slug]

file_records: {
  ...standardColumns,
  workspace_id: uuid,
  bucket_id: uuid,
  storage_key: string(2048),       // the actual key in object storage
  filename: string(500),
  folder_path: string(2048),         // logical folder path within the bucket
  size_bytes: bigint,
  content_type: string(255),
  etag: string(255),
  uploader_user_id: uuid?,
  tags: json,                       // string array
  custom_metadata: json,
  pii_flag: boolean,
  pii_categories: json,             // string array
  status: enum('uploading', 'available', 'archiving', 'deleted'),
  archived_at: timestamp?,
}
unique: [workspace_id, bucket_id, storage_key]
indexes: [workspace_id, bucket_id], [workspace_id, uploader_user_id], [workspace_id, folder_path]

file_acls: {
  ...standardColumns,
  file_id: uuid,
  acl: json,                        // { 'user_id|role_id': ['read', 'write'] }
}
unique: [file_id]

signed_urls: {
  ...standardColumns,
  workspace_id: uuid,
  file_id: uuid,
  token_hash: string(64),
  created_by_user_id: uuid,
  expires_at: timestamp,
  revoked_at: timestamp?,
  download_limit: int?,             // null = unlimited
  download_count: int,
  description: text?,
}
unique: [token_hash]
indexes: [workspace_id, file_id], [expires_at, revoked_at]

storage_quotas: {
  ...standardColumns,
  workspace_id: uuid,
  quota_bytes: bigint,
  used_bytes: bigint,
  warning_sent_80: boolean,
  warning_sent_95: boolean,
  last_reconciled_at: timestamp,
}
unique: [workspace_id]
```

### 6.3 Per-Workspace Storage Isolation

Like customer database tables (Objective 11), customer files are isolated per workspace:

- Each workspace has its own bucket(s) at the storage adapter
- The bucket name is `cust-<workspace-slug>-<random-suffix>` (suffix prevents enumeration)
- Storage adapter credentials grant access only to the relevant buckets
- The platform's primary storage credentials are NOT shared with customer-facing API code

For Backblaze B2: separate "application keys" per workspace, scoped to a single bucket. For Azure Blob: separate SAS tokens or container-level access keys. For MinIO: separate users with policies.

This means even a SQL-injection-style vulnerability in the API code can't access another workspace's files — the credentials it has don't grant that access.

### 6.4 Upload Endpoint

```typescript
// REST endpoint: POST /api/v1/data/<workspace>/storage/buckets/<bucket>/files

// For files < 5 MB: simple upload
//   Request: multipart/form-data with file body
//   Response: file_record JSON

// For files >= 5 MB: tus protocol
//   POST /api/v1/data/<workspace>/storage/uploads
//   Request: tus headers with file metadata
//   Response: 201 Created with Location header pointing at upload URL
//   Subsequent PATCH requests upload chunks
//   Final upload completes the tus session and writes to bucket
```

Implementation uses the `@tus/server` package or similar; the platform's tus handler validates uploads against the user's quota and permissions before accepting chunks.

### 6.5 The Storage Browser UI

Lives in `apps/web/src/data-management/storage-browser/`:

- `StorageBrowser.tsx` — main page, layout shell
- `views/TreeView.tsx` — left sidebar tree of buckets and folders
- `views/GridView.tsx` — grid of files with thumbnails
- `views/ListView.tsx` — list of files with metadata columns (size, modified, uploader)
- `views/PreviewPane.tsx` — preview of selected file (image, PDF, video, markdown, etc.)
- `dialogs/UploadDialog.tsx` — drag-and-drop upload zone with progress
- `dialogs/CreateFolderDialog.tsx`
- `dialogs/RenameDialog.tsx`
- `dialogs/MoveDialog.tsx`
- `dialogs/SharingDialog.tsx` — manage signed URLs and ACLs
- `dialogs/PropertiesDialog.tsx` — file metadata, tags, custom fields
- `panels/SearchPanel.tsx` — filename and metadata search
- `panels/QuotaPanel.tsx` — storage quota usage display
- `realtime/StorageEventListener.tsx` — subscribes to storage events; updates UI on changes

The UI consumes the storage REST API, with realtime subscription for live updates. It does NOT bypass the API to talk to the storage adapter directly — even the platform's own UI uses the public API surface, which means the API and the UI are tested by their use of each other.

### 6.6 Storage Audit Events

```
data_management.storage.bucket_created
data_management.storage.bucket_updated
data_management.storage.bucket_deleted
data_management.storage.file_uploaded
data_management.storage.file_uploaded_via_signed_url (when applicable)
data_management.storage.file_downloaded (sampled or always per workspace policy)
data_management.storage.file_renamed
data_management.storage.file_moved
data_management.storage.file_copied
data_management.storage.file_deleted
data_management.storage.bulk_delete (with count)
data_management.storage.bulk_move (with count)
data_management.storage.folder_created
data_management.storage.folder_deleted
data_management.storage.folder_moved
data_management.storage.signed_url_created (with TTL, scopes)
data_management.storage.signed_url_used (sampled)
data_management.storage.signed_url_revoked
data_management.storage.acl_set
data_management.storage.acl_removed
data_management.storage.tags_updated
data_management.storage.metadata_updated
data_management.storage.preview_generated (debug; not stored long-term)
data_management.storage.quota_warning_80
data_management.storage.quota_warning_95
data_management.storage.quota_exceeded
```

Per Objective 7's discipline, downloads are sampled at info level by default; high-security workspaces can enable full download auditing.

### 6.7 Storage Realtime Events

Storage operations emit events that flow through the realtime layer from Objective 14:

- Subscribers connect to a "storage" stream per workspace
- Filtered by bucket and/or folder path
- Receive events of type `file.created`, `file.updated`, `file.deleted`, `file.moved`, `bucket.changed`
- Standard event format with the file metadata embedded

The storage browser UI uses this for live updates; customer applications can use it for any "react when files change" workflows.

### 6.8 Quota Enforcement

The `quotas` table tracks current usage. Every upload/delete updates it within a transaction:

```typescript
async uploadFile(ctx, input) {
  return this.uow.transaction(async (tx) => {
    // ... validate, authorize ...

    const quota = await tx.repository('storage_quotas').findOne({ workspace_id: ctx.workspaceId });
    if (quota.used_bytes + input.size > quota.quota_bytes) {
      return err(new QuotaExceededError(/*...*/));
    }

    // Upload to storage...
    const storageResult = await this.storage.put(/*...*/);

    // Update quota
    await tx.repository('storage_quotas').update(quota.id, {
      used_bytes: quota.used_bytes + input.size,
    });

    // Insert file_record
    await tx.repository('file_records').create(/*...*/);

    // Audit + emit realtime event
    return ok(file);
  });
}
```

Periodic reconciliation: a daily job compares `used_bytes` against the actual storage adapter's reported usage. Any drift > 10 MB triggers a warning and recomputes the quota.

### 6.9 Operational Runbooks

New files in `docs/runbooks/`:

- `storage-orphan-files.md` — DB rows pointing at missing storage; storage objects without DB rows; reconciliation procedure
- `storage-quota-emergency.md` — workspace at 100%; how to emergency-extend quota; how to encourage cleanup
- `storage-adapter-credentials-rotation.md` — rotating B2 / Azure credentials per workspace
- `storage-bulk-recovery.md` — recovering from a partial bulk-delete failure
- `storage-signed-url-leak.md` — incident response when a signed URL is leaked publicly
- `storage-adapter-migration.md` — moving a workspace from one storage backend to another (e.g., MinIO to B2)
- `storage-thumbnail-regeneration.md` — when thumbnails are corrupt or out of sync

### 6.10 Observability

Storage-specific metrics:

- `platform_storage_files_total{workspace, bucket}` — gauge (file count)
- `platform_storage_bytes_used{workspace}` — gauge
- `platform_storage_uploads_total{workspace, status}` — counter
- `platform_storage_downloads_total{workspace, via}` — counter (via: api, signed_url)
- `platform_storage_upload_duration_seconds` — histogram
- `platform_storage_signed_urls_active{workspace}` — gauge
- `platform_storage_quota_warnings_total{workspace, level}` — counter
- `platform_storage_orphans_detected_total` — counter (from reconciliation job)

---

## 7. Implementation Order

1. **Database schema** for buckets, files, ACLs, signed URLs, quotas — migrated on all three database adapters.

2. **StorageService skeleton** following the canonical pattern.

3. **ObjectStoragePort adapters** finalized for B2, Azure Blob, MinIO/S3 (port from Objective 1.5; implementations finalized here).

4. **Per-workspace storage isolation** — credentials, bucket creation per workspace.

5. **Bucket CRUD** with conformance tests across adapters.

6. **File upload (small files)** — POST endpoint with multipart/form-data.

7. **File metadata, tags** — set, get, search.

8. **File listing** with pagination, filtering, sorting.

9. **File download** — direct + signed URL flows.

10. **File rename, move, copy, delete** — single-file operations.

11. **Resumable uploads via tus** — for files > 5 MB.

12. **Folder operations** — create, delete, move (non-atomic with explicit partial-failure handling).

13. **Bulk operations** — multi-select delete and move.

14. **Signed URLs** — create, revoke, proxy, cache.

15. **File ACLs** — overlay over bucket-level grants.

16. **Quota enforcement** — soft and hard limits, warning emails, reconciliation job.

17. **Storage realtime events** integrated with Objective 14's realtime layer.

18. **Storage browser UI** — all components from Section 6.5.

19. **Thumbnails for images** — generation on first view, caching.

20. **PDF, video, markdown, text previews.**

21. **Cross-adapter conformance tests** — every operation works on B2, Azure, MinIO.

22. **Per-workspace isolation tests** — leak detection.

23. **Performance tests** — concurrent uploads, large files, listing huge buckets.

24. **Audit events** integrated.

25. **Runbooks, ADRs, customer docs.**

26. **Verify Definition of Done.**

---

## 8. ADRs to Write

- **ADR-0119: Logical Folder Abstraction over Flat Storage** — non-atomicity acknowledged; UI surfaces partial failures
- **ADR-0120: tus.io for Resumable Uploads** — alternatives (S3 multipart direct, custom protocol); why tus
- **ADR-0121: Two-Layer Metadata (Adapter + Database)** — what goes where; queryable concerns drive DB
- **ADR-0122: Proxied Revocable Signed URLs by Default** — performance trade-off; direct mode as escape hatch
- **ADR-0123: Per-Workspace Storage Credentials** — isolation discipline; per-bucket keys
- **ADR-0124: Bucket-Level Permissions with File-Level Override** — simple default, fine-grained when needed
- **ADR-0125: Quota Enforcement with Reconciliation** — fail closed at 100%; reconcile drift nightly

---

## 9. Verification Steps

1. **Bucket lifecycle** works on all three storage adapters (B2, Azure, MinIO).

2. **File upload (< 5 MB)** works end-to-end; file_record created; storage object present; size matches.

3. **Resumable upload (5 GB file)** completes; if interrupted at 50%, can resume from offset.

4. **Listing** returns expected files with correct ordering; pagination works for buckets with 10,000+ files.

5. **Folder operations**: create, list contents, move, delete; non-atomic operations correctly report partial failures.

6. **Signed URL** generation, use, revocation; revoked URL stops working immediately.

7. **Direct-mode signed URL** points at storage backend; faster but not revocable.

8. **File ACL overlay**: a file with explicit ACL ignores the bucket default; removing the ACL restores the default.

9. **Cross-workspace isolation**: workspace A user with full bucket permissions cannot access workspace B's bucket; verified via API and adapter credentials.

10. **Quota enforcement**: 80% warning fires; 95% warning fires; 100% upload rejected.

11. **Quota reconciliation**: artificially drift the quota row; reconciliation job corrects.

12. **Realtime storage events**: upload triggers `file.created` event delivered to subscribers within 2 seconds.

13. **Audit events**: every operation produces the expected entry.

14. **Bulk delete** of 1000 files completes; partial failures (if any) reported.

15. **Adapter conformance**: same operations on B2, Azure, MinIO produce equivalent results modulo capability flags.

16. **Image thumbnails**: uploaded image generates thumbnails on first view; subsequent views serve cached.

17. **PDF preview**: rendered in browser for a sample PDF.

18. **Storage browser UI**: navigation, upload via drag-and-drop, preview, search all work.

19. **Performance**: 10 concurrent users uploading 100 MB files; no failures; quota updates correct.

20. **PII tagging**: file tagged as PII appears in data subject access exports.

21. **Move folder with 1000 files**: completes; all files have new prefix; original prefix is empty.

22. **Storage adapter rotation**: rotate workspace's B2 credentials; subsequent operations work without disruption.

23. **Realtime UI updates**: open storage browser in two tabs as same user; upload in tab 1; tab 2 shows the file appear within 2 seconds.

24. **Quota emergency runbook**: simulate workspace at 100%; runbook procedure restores write access.

25. **Orphan detection**: artificially create an orphan (DB row without storage object); reconciliation detects and reports.

If all 25 pass, the objective is met.

---

## 10. Definition of Done

**Service Layer**

- [ ] StorageService implemented with all methods from Section 6.1
- [ ] Conformance tests pass on B2, Azure Blob, MinIO

**Database Schema**

- [ ] All tables migrated on Postgres, MSSQL, Mongo
- [ ] Per-workspace bucket creation working

**Object Storage Adapters**

- [ ] storage-b2 adapter
- [ ] storage-azure-blob adapter
- [ ] storage-minio (S3-compatible) adapter
- [ ] All adapters declare capabilities consistently

**File Operations**

- [ ] Upload (simple + tus.io resumable)
- [ ] Download (direct + via signed URL)
- [ ] Rename, copy, move, delete
- [ ] Bulk delete and bulk move
- [ ] Folder create/delete/move (non-atomic with partial-failure reporting)

**Permissions**

- [ ] Bucket-level role grants
- [ ] File-level ACL overlay
- [ ] Cross-workspace isolation verified

**Signed URLs**

- [ ] Proxied revocable signed URLs (default)
- [ ] Direct-mode signed URLs (opt-in)
- [ ] Revocation working
- [ ] Caching for high-traffic public files

**Quota**

- [ ] Per-workspace quota tracking
- [ ] Soft warnings at 80%, 95%
- [ ] Hard limit at 100%
- [ ] Daily reconciliation job

**UI**

- [ ] Storage browser page (tree, grid, list views)
- [ ] Upload dialog with drag-and-drop and progress
- [ ] All other dialogs (folder, rename, move, sharing, properties)
- [ ] Search panel
- [ ] Quota panel
- [ ] Live updates via realtime subscription

**Previews**

- [ ] Image thumbnails (generated on first view)
- [ ] PDF native browser rendering
- [ ] Video native HTML5 rendering
- [ ] Markdown / text rendering with sanitization

**Realtime**

- [ ] Storage events emitted to the realtime layer
- [ ] Storage browser UI subscribes and updates live

**Audit & Observability**

- [ ] All audit events emitted
- [ ] All metrics emitted
- [ ] Grafana dashboards for storage operations and quotas
- [ ] Alerts for quota approaching, orphans detected

**Compliance**

- [ ] PII tagging on files
- [ ] Integration with personal data registry
- [ ] Files appear in data subject access exports

**Operational**

- [ ] All runbooks in Section 6.9 written
- [ ] Reconciliation job tested and scheduled
- [ ] Storage adapter rotation procedure tested

**Documentation**

- [ ] ADRs 0119–0125 written and Accepted
- [ ] Customer-facing storage guide
- [ ] Capability matrix updated with storage adapter features

**Verification**

- [ ] All 25 verification steps in Section 9 pass

---

## 11. Anti-Patterns to Refuse

- **Treating folders as first-class entities at the storage layer.** They're conventions over flat keys. Pretending otherwise leads to atomicity assumptions that can't be honored.
- **Sharing storage credentials across workspaces.** Per-workspace credentials are the isolation discipline; one credential leak shouldn't compromise everything.
- **Storing file content in the database.** Object storage is for objects; the database is for metadata. Don't blur the boundary.
- **Generating signed URLs without tracking them.** Revocation requires tracking; tracking enables audit.
- **Letting quota enforcement be best-effort.** Hard at 100% is the contract. Reconciliation catches drift.
- **Skipping the orphan reconciliation job.** Drift accumulates; uncorrected drift becomes a billing nightmare.
- **Returning storage adapter URLs directly when revocation matters.** Default is proxied; direct is opt-in for performance-critical public files.
- **Implementing custom upload protocols when tus.io exists.** Don't.
- **Loading entire bucket contents into memory.** Pagination from day one; even the UI uses the API's pagination, not "list all then filter."
- **Letting bulk operations have unbounded size.** Capped per request; large operations chunk through the API.
- **Skipping cross-adapter conformance tests.** B2-only behavior creeps in if not actively prevented.
- **Hard-coding "S3" in code.** Adapters are interchangeable; no service-layer code mentions a specific provider.

---

## 12. Open Questions for Confirmation Before Starting

1. **Default workspace quota** — proposing 100 GB. Some platforms default lower (10 GB), some higher (1 TB). Recommendation: 100 GB; admins can adjust per workspace.

2. **Multipart threshold** — proposing 5 MB. Acceptable, or higher (10 MB)? Lower means more files use resumable; higher means simpler uploads for small files. Recommendation: 5 MB (matches S3 multipart minimum).

3. **Image thumbnail sizes** — proposing small (128px), medium (512px), large (1024px). Sufficient set? Or include 256px and 768px too? Recommendation: start with three sizes; add more if customer demand justifies.

4. **Direct signed URL mode for which buckets** — proposing customers opt-in per bucket. Default is proxied (revocable). Acceptable?

5. **PDF server-side preview generation** — proposing native browser rendering only in v1. Some customers will want server-rendered preview images. Recommendation: defer; revisit when demand justifies.

6. **Storage adapter selection per workspace** — proposing the platform-wide default but customers can override per workspace. Acceptable?

7. **ZIP / archive operations** — confirmed deferred?

8. **Customer-managed buckets (BYOB — Bring Your Own Bucket)** — should customers be able to point the platform at their own existing bucket? Recommendation: defer to a follow-up; introduces credential complexity.

---

## 13. What Comes Next

With Objective 15 complete, the platform has a complete file management product feature. Customers can store, organize, share, and audit files alongside their data. The realtime layer keeps the UI live; the audit layer makes it compliant; the RBAC layer makes it secure.

**Objective 16: Auth & User Management UI** is next. The platform's auth (from Objective 5) becomes a customer-facing screen — sign-in, sign-up, MFA enrollment, account settings, admin-side user management. This is the screen that makes the auth feature feel like a product, not just a backend capability.

**Objective 17: Query Console** — SQL/Mongo console with safety rails for customer developers who want direct database access alongside the API.

**Objective 18: Data Browser & Editor** — the table viewer, row editor, CSV import/export. The most-used screen in a Supabase-style admin tool. Builds on schema (11), APIs (12), realtime (14), storage (15 — for file-typed columns).

**Objective 19: Public SDK** — wraps everything (REST, GraphQL, Realtime, Storage, Auth) into a TypeScript / Python / etc. SDK for customer developers.

After Objective 19, the Data Management Module is complete: a customer can install the platform, point it at their database, and have a working Supabase-equivalent on Postgres, MSSQL, or MongoDB.

---

_This document is the contract. Every checkbox in Section 10 must be true before moving on to Objective 16._
