# ADR-0123: tus Protocol for Resumable Uploads

**Status:** Accepted
**Date:** 2026-05-04
**Deciders:** solo

## Context

The platform's file storage feature (Workspace Assets, pipeline artifact storage) must handle file uploads from browser clients. File sizes range from small configuration snippets (a few KB) to large binary assets (documents, images, videos, datasets) that can exceed hundreds of megabytes.

For small files, a simple HTTP POST is sufficient: the browser sends the file in a single request, and the platform streams it to the storage backend. For large files, single-request uploads are unreliable: a dropped connection partway through means the user must restart from the beginning. This is a poor experience for files uploaded over slower or less stable connections.

The platform must choose an upload protocol for large files that:

- Allows resuming interrupted uploads without re-uploading already-transferred bytes.
- Works across all storage adapters (B2, Azure, MinIO).
- Does not require the browser to hold long-lived credentials to the storage backend.
- Is maintainable and well-specified, not custom-built.

The threshold between "small" and "large" must be explicit and consistent.

## Decision

- Files **≤ 5 MB**: simple HTTP POST to the platform's upload endpoint. The platform buffers and streams to the adapter in a single request. No resumability; the simplicity is worth the limitation at this size.
- Files **> 5 MB**: use the **[tus.io](https://tus.io) open protocol** for resumable uploads. The platform runs a tus server endpoint; the browser uses the tus client library (`tus-js-client`). The platform's tus server handles chunk receipt and forwards to the storage adapter.

The tus protocol provides:

- A standardised `Upload-Offset` header for resuming at any byte offset.
- A `POST` to create an upload, `PATCH` to append chunks, `HEAD` to query current offset.
- Checksums per chunk (optional extension, enabled by default in this implementation).

The 5 MB threshold is configuration-driven (`STORAGE_TUS_THRESHOLD_BYTES`, default `5242880`) so operators can adjust it without code changes.

The platform's tus server state (upload ID → offset, expiry, target key) is stored in the primary database, not in-memory, so uploads survive platform restarts. Incomplete uploads are garbage-collected after a configurable TTL (default 48 hours).

## Consequences

### Positive

- Resumable uploads are handled by a well-tested open protocol with first-class browser and server library support.
- The browser never holds raw storage-backend credentials; all upload traffic is proxied through the platform.
- Chunk-level checksums catch in-transit corruption before bytes reach the storage backend.
- The protocol is storage-agnostic; the same tus server frontend works with B2, Azure, and MinIO adapters.
- The 5 MB boundary is explicit and operator-tunable.

### Negative

- All large file bytes pass through the platform server, adding CPU and network overhead. For very high-throughput upload scenarios this may become a bottleneck.
- The platform must maintain tus state in the database; incomplete upload rows accumulate until GC runs.
- tus is an additional dependency (`@tus/server`, `tus-js-client`).
- The platform's tus server must be horizontally scalable carefully: upload state in DB allows any node to handle chunks, but the implementation must not assume node-local buffering.

### Neutral

- The 5 MB threshold means small uploads have zero protocol overhead; only large uploads pay the tus coordination cost.
- tus is an open protocol (not tied to a single vendor), so alternative server or client implementations are possible if library support changes.

## Alternatives Considered

### Option A: S3-Style Multipart Upload Direct from Browser

Expose presigned URLs for each part to the browser; the browser uploads parts directly to the storage backend. This is how S3's native multipart upload works.

**Why not chosen:** Presigned part URLs are scoped to specific storage-backend credentials. Giving these URLs to the browser leaks the credential scope (even if short-lived, they can be replayed during their TTL, and the credential origin is the platform's service account or workspace key). This violates the platform's principle that storage-backend credentials are never exposed to the browser (see ADR-0126). Additionally, Azure and B2 have different multipart APIs, requiring adapter-specific client-side code in the browser — untenable for a cross-adapter platform.

### Option B: Custom Chunked Upload Protocol

Build a bespoke chunked upload protocol (e.g., `X-Upload-Chunk-Index` header, sequential chunk POST, a "finalise" call).

**Why not chosen:** This is reinventing tus with worse specification coverage. tus already solves the edge cases (concurrent chunk submissions, checksum mismatch, server restart mid-upload, timeout/expiry). A custom protocol would need to replicate all of that logic and would not benefit from existing client libraries. Maintenance burden is high with no advantage over the open standard.

## References

- [tus.io protocol specification](https://tus.io/protocols/resumable-upload)
- [`@tus/server` npm package](https://www.npmjs.com/package/@tus/server)
- [`tus-js-client` npm package](https://www.npmjs.com/package/tus-js-client)
- ADR-0122 (logical folder abstraction)
- ADR-0124 (two-layer metadata)
- ADR-0125 (proxied revocable signed URLs)
- ADR-0126 (per-workspace storage credentials)
- Objective 11.5 (Workspace Assets storage)
