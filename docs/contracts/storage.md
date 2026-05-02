# Contract: Storage Ports

**Package:** `@platform/ports-storage`

## Purpose

Provides object storage and associated metadata management as two complementary ports:

- `ObjectStoragePort` — binary object I/O against a backend (local filesystem, S3, Azure Blob, GCS).
  Treats keys as opaque strings; the adapter may transform them (e.g., prepend a bucket prefix).
- `StorageMetadataPort` — the platform's own database record for each stored object (owner, size,
  content type, workspace association, policy tags). Always backed by the installation's database,
  never by the object store's metadata headers alone.

The two ports are used together. Calling `ObjectStoragePort.put` does not automatically create a
`StorageMetadataPort` record; the service layer must do both inside a `UnitOfWork` (where the
database adapter supports transactions) or with compensating logic otherwise.

---

## Key Types

```typescript
type StorageFeature = 'signed_urls' | 'multipart' | 'versioning' | 'object_locks' | 'public_read';

type ObjectInfo = {
  key: string;
  size: number; // bytes
  etag: string; // adapter-defined; may be MD5, SHA256, or opaque
  lastModified: Date;
  contentType?: string;
  metadata?: Record<string, string>; // user-defined key/value stored with the object
};

type PutOptions = {
  contentType?: string;
  metadata?: Record<string, string>;
  ifNoneMatch?: '*'; // fail if key already exists
};

type ListOptions = {
  delimiter?: string; // e.g. '/' to simulate directory listing
  maxKeys?: number; // default 1000
  continuationToken?: string;
};

type ListResult = {
  objects: ObjectInfo[];
  prefixes: string[]; // common prefixes when delimiter is set
  continuationToken?: string; // present when results are truncated
  isTruncated: boolean;
};

type SignedUrlMethod = 'GET' | 'PUT' | 'DELETE';

type SignedUrlOptions = {
  expiresInSeconds: number; // max 604800 (7 days) for S3-compatible adapters
  contentType?: string; // for PUT; adapter may enforce this in the signature
  responseContentDisposition?: string; // for GET; forces download filename
};
```

---

## Methods

### ObjectStoragePort

#### `put(key: string, data: Readable | Buffer | Uint8Array, opts?: PutOptions, ctx: RequestContext): Promise<Result<ObjectInfo, StorageError>>`

Writes an object at `key`. If an object already exists at `key` and `opts.ifNoneMatch` is `'*'`,
returns `StorageError` with code `UNKNOWN` (treated as a precondition failure by the service layer).
Otherwise, overwrites.

**Pre-conditions:** `key` is non-empty and does not exceed the adapter's key length limit (check
`supports('object_locks')` is not required here, but key length limits vary — see divergences).
**Post-conditions:** `ObjectInfo.etag` is stable for the same object content on the same adapter.
Two adapters may return different etags for the same bytes; do not compare cross-adapter.
**Invariants:** The adapter must not split a streaming `data` argument across partial writes.
If the upload fails mid-stream, the adapter must either roll back the partial write or store a
zero-byte sentinel — it must not leave a partial object visible to `get`.

#### `get(key: string, ctx: RequestContext): Promise<Result<{ stream: Readable; info: ObjectInfo }, StorageError | ObjectNotFoundError>>`

Returns a readable stream and metadata. Callers must consume or destroy the stream; failing to do
so may leak connections on HTTP-based adapters.

**Pre-conditions:** Key exists.
**Post-conditions:** `info` reflects the object's current state at the time `get` was called.
**Invariants:** The returned stream must be readable to completion without buffering the entire
object in memory.

#### `head(key: string, ctx: RequestContext): Promise<Result<ObjectInfo, StorageError | ObjectNotFoundError>>`

Returns metadata only — no body. Use this to check existence or get size before a conditional
operation. Much cheaper than `get` on remote adapters.

#### `delete(key: string, ctx: RequestContext): Promise<Result<void, StorageError>>`

Deletes the object. Deleting a key that does not exist is idempotent — returns `ok(undefined)`.

**Invariants:** On versioned adapters (`supports('versioning') = true`), `delete` inserts a delete
marker; the object is not permanently removed. Use the adapter-specific version management API
(outside this port's scope) to purge versions.

#### `list(prefix: string, opts?: ListOptions, ctx: RequestContext): Promise<Result<ListResult, StorageError>>`

Lists objects whose keys begin with `prefix`. An empty `prefix` lists all objects the caller can
access.

**Pre-conditions:** If `opts.continuationToken` is set, it must be a value returned by a prior
`list` call against the same prefix and options.
**Post-conditions:** `objects` are ordered lexicographically by key. When `opts.delimiter` is set,
keys that contain the delimiter are collapsed into `prefixes` entries rather than individual
`objects` entries.
**Invariants:** Pagination via `continuationToken` is stable only for the lifetime of the token
(typically minutes on S3-compatible adapters). Do not persist tokens.

#### `signedUrl(key: string, method: SignedUrlMethod, opts: SignedUrlOptions, ctx: RequestContext): Promise<Result<string, StorageError | NotSupportedError>>`

Generates a time-limited pre-signed URL that grants the bearer permission to perform `method` on
`key` without platform credentials.

**Pre-conditions:** `supports('signed_urls')` is `true`. `opts.expiresInSeconds` is between 1 and 604800.
**Post-conditions:** The URL is valid for the specified duration. Callers must not cache signed
URLs beyond their expiry.
**Invariants:** The URL grants access to exactly one key. The platform must not issue signed URLs
that could be widened (e.g., wildcard keys) — the adapter must reject such attempts.

#### `supports(feature: StorageFeature): boolean`

Synchronous capability check. Must be consistent with actual adapter behaviour — see divergences
below.

---

### StorageMetadataPort

Manages the platform's canonical database record for stored objects. Decoupled from
`ObjectStoragePort` so the platform can track ownership, policy, and quota without making the
object store the system of record.

#### `create(input: CreateStorageMetadataInput, ctx: RequestContext): Promise<Result<StorageMetadata, PersistenceError>>`

`CreateStorageMetadataInput` includes: `key`, `workspaceId`, `ownerId`, `size`, `contentType`,
`storageBackend` (which adapter), `policyTags`, and `expiresAt` (optional).

**Pre-conditions:** `key` is unique within `workspaceId` and `storageBackend`. Duplicate keys
return `PersistenceError(CONSTRAINT_VIOLATION)`.
**Post-conditions:** Record exists in the platform database with `version: 1`.

#### `findById(id: string, ctx: RequestContext): Promise<Result<StorageMetadata | null, PersistenceError>>`

#### `findByKey(key: string, workspaceId: string, ctx: RequestContext): Promise<Result<StorageMetadata | null, PersistenceError>>`

Lookup by the object's key within a workspace. Returns `null` if no metadata record exists — this
can legitimately occur if an object was put directly to the backend outside the platform. The
service layer must decide how to handle this (deny access vs. create a metadata record).

#### `update(input: { id: string; expectedVersion: number; changes: Partial<StorageMetadata> }, ctx: RequestContext): Promise<Result<StorageMetadata, PersistenceError | ConflictError>>`

Optimistic locking — same semantics as `RepositoryPort.update`. Used to update `policyTags`,
`expiresAt`, or quota accounting fields.

#### `delete(id: string, ctx: RequestContext): Promise<Result<void, PersistenceError>>`

Hard-deletes the metadata record. Callers must call `ObjectStoragePort.delete` first (or in the
same unit of work); orphaned metadata is worse than orphaned objects because it blocks re-upload.

#### `listByOwner(ownerId: string, workspaceId: string, page: Page, ctx: RequestContext): Promise<Result<PaginatedResult<StorageMetadata>, PersistenceError>>`

Returns all metadata records owned by `ownerId` within `workspaceId`. Used for quota reporting
and the user-facing file manager.

---

## Capability Flags

| Feature        | Local filesystem             | S3 / S3-compatible           | Azure Blob          | GCS |
| -------------- | ---------------------------- | ---------------------------- | ------------------- | --- |
| `signed_urls`  | no (see divergences)         | yes                          | yes                 | yes |
| `multipart`    | no                           | yes                          | yes                 | yes |
| `versioning`   | no                           | yes (per-bucket)             | yes (per-container) | yes |
| `object_locks` | no                           | yes (requires bucket config) | yes                 | yes |
| `public_read`  | yes (via static file server) | yes                          | yes                 | yes |

---

## Performance Expectations

- `head`: < 20 ms on remote adapters with a warm connection; used freely before conditional writes.
- `put` (small objects < 5 MB): < 500 ms to first byte acknowledged on LAN-local storage; varies
  widely on remote adapters — do not enforce a hard timeout at the port level.
- `put` (large objects): adapters supporting `multipart` must use multipart upload for objects
  > 100 MB; single-part upload of very large objects is an error on S3 (5 GB limit).
- `list` with a narrow prefix: < 100 ms for up to 1000 keys.
- `signedUrl`: < 10 ms (purely computational on S3/GCS; involves an API call on some Azure
  configurations — cache accordingly).
- `StorageMetadataPort` operations: standard database performance, same expectations as
  `RepositoryPort` in the persistence contract.

---

## Known Adapter Divergences

**Local filesystem adapter**

- `supports('signed_urls')` returns `false`. Callers that need URL-based access should wrap the
  object behind a platform-side signed route (`/api/storage/download?token=...`). The token is
  issued by the service layer, not by this port.
- `supports('multipart')` returns `false`; large files are written in a single stream to a temp
  file, then atomically renamed.
- `supports('versioning')` and `supports('object_locks')` return `false`.
- `list` with `delimiter` is supported by walking the directory tree; performance degrades on
  directories with > 10,000 files.
- `etag` is computed as a SHA-256 of the file contents at write time and cached in a sidecar file.
  If the sidecar is missing, `head` recomputes it (slow).

**S3 / S3-compatible adapters (including MinIO)**

- Full support for all features, subject to bucket configuration (versioning and object locks must
  be enabled on the bucket before use; the adapter checks at boot and sets capability flags
  accordingly).
- `signedUrl` for `PUT` enforces `contentType` in the signature if provided — the upload will fail
  if the client sends a different `Content-Type` header.
- Key length limit: 1024 bytes. Adapter returns `StorageError(KEY_TOO_LONG)` before making a
  network call.
- MinIO does not support `object_locks` in all configurations; the adapter queries the bucket
  config at boot.

**Azure Blob Storage adapter**

- `signedUrl` is implemented via SAS tokens. SAS generation for `DELETE` requires the `Delete`
  permission on the SAS policy, which must be explicitly granted in the Azure storage account.
  If the permission is absent, returns `StorageError(ACCESS_DENIED)`.
- `versioning` maps to Azure Blob versioning (preview feature in some regions). The adapter checks
  for availability and sets the flag accordingly.
- Key length limit: 1024 characters (not bytes — Unicode-aware). Adapter normalises to UTF-8
  before checking.
- `list` with `delimiter` uses Azure's virtual directory model; deeply nested hierarchies with
  many levels perform an API call per level.

**GCS adapter**

- `signedUrl` requires a service account with the `storage.objects.create` IAM permission for PUT
  and `storage.objects.get` for GET. Signing uses HMAC or RSA depending on the credential type.
- `object_locks` are implemented as retention policies; the adapter surfaces them uniformly via
  `supports('object_locks')`.

---

## Usage Examples

```typescript
// Upload with metadata record in a single logical operation
const uploadResult = await objectStorage.put(`workspaces/${ctx.workspaceId}/uploads/${fileId}`, fileStream, { contentType: 'application/pdf', metadata: { originalName: fileName } }, ctx);
if (uploadResult.isErr()) return err(mapStorageError(uploadResult.error));

const info = uploadResult.value;
const metaResult = await storageMetadata.create(
  {
    key: info.key,
    workspaceId: ctx.workspaceId,
    ownerId: ctx.userId,
    size: info.size,
    contentType: info.contentType,
    storageBackend: 'primary',
    policyTags: [],
  },
  ctx,
);

// Conditional download via signed URL (remote adapters only)
if (objectStorage.supports('signed_urls')) {
  const url = await objectStorage.signedUrl(`workspaces/${ctx.workspaceId}/uploads/${fileId}`, 'GET', { expiresInSeconds: 300, responseContentDisposition: `attachment; filename="${fileName}"` }, ctx);
  return ok({ downloadUrl: url.value });
} else {
  // Fall back to proxied download route for local filesystem adapter
  return ok({ downloadUrl: `/api/storage/proxy/${fileId}` });
}

// Paginated listing with prefix
let token: string | undefined;
do {
  const page = await objectStorage.list(`workspaces/${workspaceId}/`, { maxKeys: 100, continuationToken: token }, ctx);
  if (page.isErr()) break;
  processObjects(page.value.objects);
  token = page.value.continuationToken;
} while (token);

// Quota check before accepting upload
const meta = await storageMetadata.listByOwner(userId, workspaceId, { limit: 1, offset: 0 }, ctx);
const totalUsed = meta.value.items.reduce((sum, m) => sum + m.size, 0);
if (totalUsed + incomingSize > workspaceQuotaBytes) {
  return err(new StorageError('QUOTA_EXCEEDED'));
}
```

---

## Common Misuse

- **Calling `put` without creating a `StorageMetadataPort` record.** Orphaned objects cannot be
  accounted for in quota calculations and are invisible to the file manager. Always create both,
  preferably in a `UnitOfWork` transaction.
- **Deleting the metadata record before the object.** If the object delete fails after the metadata
  record is gone, the object becomes an untracked orphan. Delete the object first, then the
  metadata record.
- **Caching signed URLs beyond their expiry.** Signed URLs are short-lived by design. Storing them
  in a database or returning them in a long-lived API response is an access-control risk.
- **Comparing etags across adapters.** Etag format is adapter-defined. An etag from the S3 adapter
  is not comparable to one from the local filesystem adapter for the same logical file.
- **Assuming `delete` is permanent on versioned backends.** On S3 with versioning enabled,
  `delete` inserts a delete marker. `head` on the key will return `ObjectNotFoundError`, but the
  object's bytes still exist in the version history. Purging requires explicit version deletion.
- **Using `list` without a prefix in production.** Listing the entire bucket/container without a
  scoped prefix is almost always a performance bug and may return millions of objects. Always
  scope by `workspaces/${workspaceId}/`.
- **Not handling `NotSupportedError` from `signedUrl`.** The local filesystem adapter always
  returns `NotSupportedError`. Code that calls `signedUrl` without checking `supports('signed_urls')`
  first will surface unhandled errors in development and CI.
