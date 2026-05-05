# ADR-0122: Logical Folder Abstraction Over Flat Object Storage

**Status:** Accepted
**Date:** 2026-05-04
**Deciders:** solo

## Context

Object storage backends (Backblaze B2, Azure Blob Storage, MinIO, S3-compatible) are fundamentally flat: objects live in a bucket and are addressed by a key string. There is no native directory or folder concept. However, users and the platform UI need a hierarchical folder metaphor to organise files — particularly in the Workspace Assets feature and the file-management surfaces introduced alongside Objective 11.5.

The platform must decide how to represent this folder hierarchy: whether to model folders as first-class entities in the database, to synthesise them from object key prefixes, or some hybrid.

Constraints:

- All three storage adapters (B2, Azure, MinIO) are supported; any folder concept must work consistently across all of them.
- The platform never controls the underlying storage binary format in a way that assumes native directory support.
- Folder operations (move, rename, delete) must be available even though no atomic multi-object operation exists in object storage.
- The UI must remain useful even when partially-failed multi-object operations leave the key namespace in an intermediate state.

## Decision

Folders are a **logical convention** expressed entirely through object key prefixes. A folder named `images/avatars/` is not a stored entity; it is implied by the existence of objects whose keys begin with `images/avatars/`.

Key rules:

1. **Slash-delimited prefixes** are the sole folder mechanism. A file at key `images/avatars/user-123.png` is logically inside `images/avatars/` inside `images/`.
2. **No folder objects are persisted.** Empty folders do not exist at the storage layer; the UI may synthesise a "virtual empty folder" experience by writing a zero-byte placeholder object (e.g., `.keep`) when the user explicitly creates a folder, but this is a UI convenience, not a platform invariant.
3. **Folder move/rename** is implemented as a sequential copy-then-delete loop over all matching objects. The operation is **not atomic**.
4. **Folder delete** is likewise a sequential delete loop over all matching objects. Partial failure mid-loop leaves orphaned objects; the platform does not attempt automatic rollback.
5. **The UI surfaces partial failures** explicitly: a failure report lists which objects succeeded and which failed, allowing the user to retry or clean up manually.
6. **The DB-backed metadata layer** (see ADR-0124) uses the same key-prefix semantics; a folder-level metadata query is a prefix scan.

## Consequences

### Positive

- Zero adapter complexity: no synchronisation between a "folders" table and the storage backend.
- Consistent across all three storage adapters without any adapter-specific folder API.
- Folder listings are just prefix-filtered list operations, which every adapter supports natively.
- No foreign-key relationships to maintain; deleting a bucket never leaves orphaned folder rows.

### Negative

- Folder move/rename is O(n) in the number of objects and non-atomic. Large folders take time; failures mid-operation leave partial state.
- Empty folders cannot exist without a placeholder object (`.keep`), which is a mild conceptual leak.
- Concurrent renames of the same prefix by two actors can produce a corrupted key namespace; the platform relies on optimistic locking at the operation level (not at individual key level) to reduce likelihood.
- The UI must explicitly handle and communicate partial failures rather than relying on a database transaction to guarantee atomicity.

### Neutral

- Folder depth is unlimited; the platform imposes no maximum nesting level, though the UI may warn beyond a configurable depth.
- The abstraction is conventional in the industry (AWS S3, GCS, Azure all use the same prefix convention), so users familiar with object storage will recognise the model.

## Alternatives Considered

### Option A: Real Folder Objects with Foreign Key

Store a `storage_folders` table with `(workspace_id, bucket_id, parent_folder_id, name)`. Files have a `folder_id` FK. Move/rename is a single UPDATE.

**Why not chosen:** Requires maintaining a two-way sync between the folder table and the actual object key namespace. If objects are created or renamed outside the platform (via direct API, CLI, or another tool), the folder table diverges. Object storage is intentionally accessible through many clients; assuming exclusive platform control is fragile. The sync complexity and drift-repair logic exceed the cost of non-atomic prefix operations.

### Option B: Separate "Folders" Table Without FK on Files

Store folder metadata only; files do not reference folders. A folder's "contents" are derived at query time by prefix scan.

**Why not chosen:** This is essentially the same as the chosen approach but adds a table that must be kept in sync with which prefixes actually contain objects. When a folder becomes empty (all objects deleted), the row must be cleaned up. When objects are created with a new prefix from outside the platform, no row exists. The table provides no meaningful guarantee and adds maintenance burden.

## References

- [AWS S3 documentation: Working with folders](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-folders.html)
- [Azure Blob Storage: Virtual directories](https://learn.microsoft.com/en-us/azure/storage/blobs/storage-blobs-introduction#blob-storage-resources)
- ADR-0123 (tus resumable uploads)
- ADR-0124 (two-layer metadata)
- ADR-0126 (per-workspace storage credentials)
- Objective 11.5 (Schema Designer UI / Workspace Assets)
