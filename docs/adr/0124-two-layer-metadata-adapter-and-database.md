# ADR-0124: Two-Layer Object Metadata (Adapter Native + Database-Backed)

**Status:** Accepted
**Date:** 2026-05-04
**Deciders:** solo

## Context

Every stored object has metadata: at minimum a content type, size, and ETag. Beyond these fundamentals, the platform needs to support richer metadata: tags for filtering, PII flags for compliance workflows, uploader identity, custom key-value fields defined per-workspace, and audit timestamps.

Storage adapters (B2, Azure Blob, MinIO) each support a native metadata mechanism — typically HTTP headers stored alongside the object (e.g., `x-amz-meta-*`, Azure blob metadata). However, these native mechanisms are limited:

- B2 custom metadata: up to 10 keys, 7,000 bytes total.
- Azure blob metadata: 8 KB limit per blob.
- MinIO: mirrors S3 metadata limits (2 KB recommended).

These limits rule out storing arbitrary or unbounded metadata natively. Additionally, native metadata is not queryable in a cross-adapter way: filtering objects by a custom field across thousands of objects would require listing all objects and filtering client-side.

The platform must choose where metadata lives and how the two concerns (native adapter metadata vs. rich queryable metadata) are reconciled.

## Decision

Object metadata is split across two layers:

**Layer 1 — Adapter Native Metadata (small, opaque, < 2 KB target)**

A fixed set of well-known fields is written to the adapter's native metadata on every object:

- `content-type` (MIME type)
- `etag` (content hash, usually set by adapter)
- `platform-upload-id` (tus upload ID or POST request ID for traceability)
- `platform-workspace-id` (workspace scoping, belt-and-suspenders)

These fields are kept small deliberately (< 2 KB total), well within every adapter's limit. They are written atomically with the object upload. They are the "ground truth" for content type and integrity.

**Layer 2 — DB-Backed Extended Metadata (queryable, unlimited)**

A `storage_object_metadata` table (one row per object) stores:

- `object_key`, `bucket_id`, `workspace_id` (identity)
- `size_bytes`, `content_type`, `etag` (mirrored from adapter for query convenience)
- `uploader_user_id`, `uploaded_at`
- `tags` (JSONB / document array — indexed for filtering)
- `pii_flag` (boolean, for compliance workflows)
- `custom_fields` (JSONB / document — workspace-defined schema, validated by the platform)
- `deleted_at` (soft-delete support)

Layer 2 is written in the same transaction as the upload completion event (or as close to atomically as the adapter allows). On discrepancy between layers, Layer 1 (adapter native) is authoritative for `content-type` and `etag`; Layer 2 is authoritative for everything else.

A **reconciliation job** (see ADR-0128 for quota reconciliation — the same job also reconciles metadata) detects objects present in the adapter but missing from the DB, and vice versa, and flags them for review.

## Consequences

### Positive

- Rich metadata (tags, PII flags, custom fields) is stored in the relational/document DB and is fully queryable with indexes, without hitting the storage adapter.
- Adapter native metadata remains minimal, well within all adapters' limits, and carries the fields needed for HTTP cache headers (`content-type`, `etag`).
- Content type and ETag are available directly from HTTP range-request responses without a DB round-trip.
- Custom fields per workspace allow extensibility without schema migrations for each new field type.

### Negative

- Two writes per upload (adapter + DB) create a consistency window: if the DB write fails after the adapter write succeeds, the object exists but has no extended metadata until reconciliation repairs it.
- The metadata DB table grows proportionally to the number of stored objects. Large workspaces with millions of objects require indexed queries and pagination to remain performant.
- Mirroring `content-type` and `etag` in Layer 2 creates a redundancy that must be kept in sync on object replacement (overwrites).

### Neutral

- The split is invisible to API consumers: the platform's storage API always returns a unified metadata view regardless of which layer each field came from.
- The `custom_fields` JSONB column allows future workspace-defined metadata schemas without altering the platform's core schema.

## Alternatives Considered

### Option A: Store All Metadata in Adapter Native Fields

Use only the adapter's native metadata mechanism for all metadata fields (tags, PII, custom fields, etc.).

**Why not chosen:** Adapter metadata limits (2–8 KB) are insufficient for arbitrary custom fields and arrays of tags. Cross-object filtering (e.g., "list all objects tagged `approved` in this bucket") would require listing every object and filtering client-side — an O(n) scan that is unacceptably slow for large buckets. No cross-adapter query standard exists.

### Option B: Store All Metadata in DB Without Adapter Sync

Keep no metadata in adapter native fields. Store everything in the DB. Derive ETag and content type from the DB row, not from the adapter.

**Why not chosen:** ETag and content type served in HTTP response headers for file downloads must match what the adapter stored. If the adapter recomputes or normalises the ETag (which B2 and Azure do), the DB value may drift. Serving a different ETag than the adapter would break HTTP cache validation. Content type returned in download headers is adapter-native; overriding it requires intercepting every download response, adding latency and complexity for no architectural benefit.

## References

- [Backblaze B2 metadata limits](https://www.backblaze.com/docs/cloud-storage-file-info)
- [Azure Blob metadata limits](https://learn.microsoft.com/en-us/azure/storage/blobs/storage-blob-properties-metadata)
- ADR-0122 (logical folder abstraction)
- ADR-0123 (tus resumable uploads)
- ADR-0125 (proxied revocable signed URLs)
- ADR-0128 (quota enforcement and reconciliation)
- Objective 11.5 (Workspace Assets)
