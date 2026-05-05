# ADR-0132: Avatar Storage via Storage Service

**Status:** Accepted
**Date:** 2026-05-05
**Deciders:** solo

## Context

User avatars are binary assets (JPEG, PNG, WebP, GIF) associated with a user account. They need to be stored, retrieved, and deleted. Options:

1. Store avatars as base64 blobs in the user database record.
2. Store avatars in a dedicated file system path on the server.
3. Store avatars in the platform's Storage service (the same abstraction used for workspace files and branding logos).

## Decision

**Avatars are stored via `AvatarService` using the Storage service port**, in a dedicated `avatars` bucket. Each avatar is stored at the key `{userId}/avatar.{ext}`. Uploading a new avatar replaces the previous one (same key, overwrite semantics).

**Validation before storage:**

- MIME type must be one of: `image/jpeg`, `image/png`, `image/webp`, `image/gif`
- File size must be ≤ 5 MB
- Both checks happen in `AvatarService.uploadAvatar()` before the Storage call

**Access control:**

- Avatars are public-read (no signed URL required). The Storage adapter exposes a stable public URL for objects in the `avatars` bucket.
- Deletion: `AvatarService.deleteAvatar()` removes the object and nulls the `avatarUrl` field on the user record.

**The `avatarUrl` field** on the user record stores the public URL returned by the Storage service after upload. This denormalises the URL but avoids a Storage lookup on every profile read.

## Consequences

### Positive

- Reuses existing Storage infrastructure (ports, adapters, quota tracking) without new storage primitives.
- The `avatars` bucket is independent of workspace buckets; avatar data is installation-scoped, not workspace-scoped.
- Overwrite semantics mean there is only ever one avatar file per user; no orphan cleanup needed.
- Validation in the service layer (not the route handler) ensures the same rules apply regardless of the upload entry point.

### Negative

- The `avatars` bucket must be provisioned at installation startup (or at first avatar upload). If provisioning fails, avatar upload fails silently until the bucket exists.
- The denormalised `avatarUrl` becomes stale if the Storage adapter's base URL changes (e.g., CDN migration). A migration to recompute URLs from object keys would be required.
- Avatar storage does not currently apply per-user quotas. A user could repeatedly upload 5 MB avatars, accumulating objects if old keys are not overwritten correctly. The overwrite-by-key design prevents this in the happy path.

### Neutral

- The `avatars` bucket is excluded from workspace storage quotas (it is installation-scoped).
- Future work: image resizing / thumbnail generation would be added to `AvatarService.uploadAvatar()` without changing the storage approach.

## Alternatives Considered

### Base64 in Database

Store the avatar as a base64-encoded blob in the user record.

**Why not chosen:** Bloats the user record. Avatars would be returned in every user profile query. Difficult to serve with correct cache headers. No CDN path for binary assets stored in the DB.

### Dedicated File System Path

Store avatars in a directory on the server (e.g., `/var/lighthouse/avatars/{userId}`).

**Why not chosen:** Does not work in containerised or horizontally-scaled deployments where multiple nodes don't share a file system. Inconsistent with the platform's storage abstraction, which already handles multi-adapter deployments.

## References

- Objective 15/15.5 (Storage Browser & File Management — Storage service abstraction)
- Objective 16 (Auth & User Management UI)
- `packages/core/src/services/avatar.service.ts`
- `apps/web/src/app/api/v1/me/avatar/route.ts`
