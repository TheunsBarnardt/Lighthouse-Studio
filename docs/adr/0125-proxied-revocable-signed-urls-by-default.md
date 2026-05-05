# ADR-0125: Proxied Revocable Signed URLs by Default

**Status:** Accepted
**Date:** 2026-05-04
**Deciders:** solo

## Context

The platform's storage feature must provide a mechanism for clients (browser, API consumer, pipeline worker) to download objects. Two broad approaches exist: the platform proxies every byte, or the platform issues a URL that the client uses to fetch bytes directly from the storage backend.

Proxying every byte adds latency and load to the platform server. Direct URLs are faster but raise a critical question: once a URL is issued, how does the platform revoke it? For compliance (GDPR deletion requests, access revocation when a user is removed from a workspace), the ability to revoke access quickly is non-negotiable.

Native storage-backend signed URLs (B2 download authorisations, Azure SAS tokens, MinIO presigned URLs) are time-limited but not revocable before their expiry. Revoking access means either waiting for the TTL to expire or rotating the signing credential (which invalidates _all_ URLs signed with that credential, not just the one being revoked).

The platform needs a download URL mechanism that:

- Is revocable per-URL, not just per-credential.
- Does not require rotating workspace credentials to revoke a single URL.
- Works across all three storage adapters without adapter-specific URL formats exposed to clients.
- Does not add per-byte proxying overhead for large, public/cacheable files.

## Decision

**By default**, all platform-issued download URLs are **proxied through the platform and backed by a DB-tracked token**:

1. When a client requests a download URL for an object, the platform generates a random opaque token (`ulid` or `uuid`), stores it in `storage_signed_urls` with `(token, object_key, bucket_id, workspace_id, expires_at, revoked_at)`, and returns a URL of the form `https://platform.example.com/storage/dl/{token}`.

2. When a client GETs that URL, the platform looks up the token, checks `revoked_at IS NULL` and `expires_at > now()`, then proxies the response from the storage adapter (streaming, not buffering).

3. **Revocation** sets `revoked_at = now()` on the row. Subsequent requests with that token receive `410 Gone`. No credential rotation required.

4. **Default TTL**: 1 hour. **Maximum TTL**: 7 days. Both are configurable per-request (up to the cap). Expired tokens are garbage-collected after a configurable retention window (default 30 days, to preserve audit records).

5. **HTTP cache-control** for public objects: the platform sets `Cache-Control: public, max-age=3600` (or the TTL) on proxied responses, so CDN and browser caches serve repeat requests without hitting the platform. This mitigates the per-byte proxying overhead for commonly-accessed public files.

6. **Direct mode** is available as a **per-bucket opt-in** (`direct_urls_enabled: true` in bucket config). In direct mode, the platform issues native adapter signed URLs (B2 auth token, Azure SAS, MinIO presigned). Direct mode loses revocability; it is intended for buckets where files are large, public, and never need per-URL revocation (e.g., a public asset CDN).

## Consequences

### Positive

- Per-URL revocation without credential rotation: a compromised or shared link can be killed in a single DB write.
- Clients receive a uniform URL format regardless of which storage adapter backs the bucket.
- The platform has full visibility into download access patterns (each proxied request is observable).
- Revoking a workspace user's access can include revoking all their issued tokens in one `UPDATE` query.

### Negative

- Every download hits the platform server (token lookup + proxy stream). For high-traffic workloads this adds latency and egress cost compared to direct storage URLs.
- The `storage_signed_urls` table grows with every issued URL. GC is required.
- Very large file downloads (GB-range) tie up platform server connections for the duration of the stream; connection limits must be sized accordingly.
- Caching only helps for public, cacheable files. Private files (per-user tokens) are always proxied on each access.

### Neutral

- Direct mode is available for buckets that genuinely need it; operators make a conscious opt-in trade-off.
- The proxied URL format is opaque to clients; if the platform changes backends, clients do not need to update.

## Alternatives Considered

### Option A: Native Storage Signed URLs (No Proxy)

Issue B2 / Azure SAS / MinIO presigned URLs directly to clients. No platform proxy.

**Why not chosen:** No per-URL revocability. Revoking a single compromised URL requires rotating the signing credential, which invalidates all other active URLs for that bucket — a severe blast radius. Compliance requirements (GDPR right to erasure, access revocation on user removal) cannot be satisfied without revocability.

### Option B: JWT-Signed Download Tokens (No DB)

Issue short-lived JWTs signed with a platform secret. No DB lookup on each download.

**Why not chosen:** JWTs cannot be revoked before expiry without a revocation list — which is a database lookup, bringing the DB dependency back. Without revocation, same problem as Option A. With revocation, the JWT approach provides no benefit over a simple opaque token, and adds JWT parsing overhead plus key-rotation complexity. The "hard to revoke" property of JWTs is precisely the wrong trade-off for a compliance-sensitive feature.

## References

- [Backblaze B2 download authorisations](https://www.backblaze.com/docs/cloud-storage-download-authorization)
- [Azure Blob SAS tokens](https://learn.microsoft.com/en-us/azure/storage/common/storage-sas-overview)
- ADR-0124 (two-layer metadata — `storage_signed_urls` table lives alongside `storage_object_metadata`)
- ADR-0126 (per-workspace credentials — the signing layer that direct mode would expose)
- ADR-0127 (bucket-level permissions — governs who can request a signed URL)
- Objective 11.5 (Workspace Assets)
