# ADR-0226: Workspace Assets Storage Layout

**Status:** Accepted
**Date:** 2026-05-04
**Deciders:** solo

## Context

The AI Pipeline (Objectives 22, 23, 26, 27) needs workspace-level brand assets and reference documents as persistent context that travels with every project in the workspace. Without a dedicated layer, each pipeline run would require manual re-upload of logos, color palettes, brand voice guidelines, and compliance documents.

The platform already has two storage abstractions:

- `ObjectStoragePort` — blob I/O (put/get/delete/list objects by key)
- `StorageMetadataPort` — database-backed metadata for objects (key, workspaceId, contentType, size)

These are sufficient for raw object I/O but lack asset-domain concepts: category, role (e.g. logo variant), format validation status, and per-workspace quota tracking.

Three design options were evaluated for where to house the asset-specific metadata and business rules.

## Decision

Introduce a dedicated `WorkspaceAssetPort` that:

1. **Uses `ObjectStoragePort` for blob storage** — assets are stored as objects under the path `/workspaces/{workspaceId}/assets/{category}/{assetId}/{filename}`. No new blob storage mechanism is created.

2. **Adds a `workspace_assets` persistence table** for asset metadata beyond what `StorageMetadataPort` tracks: `category`, `role`, `validationStatus`, `mimeType`, `parsedTextKey` (for documents), and `assetVersion`.

3. **Tracks quota in a `workspace_storage_usage` aggregate** — a lightweight column (`assetsBytesUsed`) on the `workspaces` table, incremented/decremented atomically on upload/delete. Default allowance is 1 GB per workspace, configurable via workspace settings.

4. **Separates asset storage from project-level file storage** — assets live in a dedicated path prefix. Project files (Obj 15) remain under `/workspaces/{workspaceId}/projects/`. No sharing of metadata records between the two domains.

### Path convention

```
/workspaces/{workspaceId}/assets/
  brand/
    logos/
    colors/
    fonts/
    images/
    icons/
  documents/
    voice/
    strategy/
    reference/
    compliance/
    specs/
```

Color assets are stored as JSON files (OKLCH canonical + hex/RGB) rather than binary blobs. Font assets store the woff2/woff binary; variable fonts preferred.

### RBAC

- `workspace.assets.upload` — workspace admin only
- `workspace.assets.delete` — workspace admin only
- `workspace.assets.read` — all active workspace members

## Consequences

### Positive

- No new blob storage mechanism; reuses the proven `ObjectStoragePort` abstraction
- Asset metadata is queryable (by category, role, validation status) without scanning blob storage
- Quota enforcement is O(1) — one column read, not a full storage scan
- Clean separation from project-level file storage prevents accidental cross-domain queries

### Negative

- Two writes per upload (blob store + DB metadata); must be idempotent — if the blob succeeds but the DB write fails, cleanup is needed
- `assetsBytesUsed` counter can drift if manual object deletions bypass the service; acceptable trade-off given the platform controls all write paths

### Neutral

- Color assets stored as JSON is unconventional but avoids inventing a binary format for structured color data

## Alternatives Considered

### Option A: Extend `StorageMetadataPort` with asset fields

Adding category, role, and validation status directly to `StorageMetadata` would avoid a new port but would couple generic file storage to AI Pipeline concepts. Rejected: violates separation of concerns; the storage port is used by the project file browser which should not carry asset-domain fields.

### Option B: Store all asset metadata in the blob object's metadata headers

S3-compatible object metadata supports custom key-value pairs. Storing category, role, and validation status as object headers avoids a new table. Rejected: metadata headers are size-limited (~2 KB), not easily queryable, and not portable across all `ObjectStoragePort` backends (filesystem adapter has no headers).

## References

- Obj 15 — Storage Browser & File Management (project-level storage)
- Obj 15.5 — Workspace Assets and Documents (this feature)
- ADR-0094 — Customer schemas in separate database namespaces
- `packages/ports/storage/` — existing ObjectStoragePort and StorageMetadataPort
