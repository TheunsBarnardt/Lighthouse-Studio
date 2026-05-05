# ADR-0127: Bucket-Level Permissions with File-Level ACL Override

**Status:** Accepted
**Date:** 2026-05-04
**Deciders:** solo

## Context

The platform's storage feature requires an access-control model that governs who can read, write, and delete objects in a bucket. The model must integrate with the platform's existing RBAC system (Objective 6) and satisfy two common use cases:

1. **Simple buckets**: a bucket is fully public (anyone can read), or fully private (only workspace members with a specific role can read), or only writable by a service account. Most buckets fit a single uniform policy.
2. **Mixed-access buckets**: a bucket contains mostly public assets, but a subset of files (e.g., signed contracts, PII exports) must be private regardless of the bucket's default.

The model must also satisfy these constraints:

- Permission resolution must be deterministic and auditable.
- The model must be comprehensible to workspace administrators, not just platform engineers.
- The UI must be able to express the model without excessive complexity.
- v1 must ship; over-engineering must be avoided.

## Decision

**Bucket-level role grant table is the default.** Each bucket has a grant table with rows `(role, [read, write, delete])`. When a user attempts an operation on any file in the bucket, the platform evaluates the user's workspace roles against the bucket's grant table. If any of the user's roles grants the required permission, access is allowed.

**File-level ACL is an optional override.** Individual files may carry an ACL row in `storage_file_acls` `(object_key, bucket_id, workspace_id, overrides)` where `overrides` is a JSONB object expressing explicit `allow` or `deny` per operation per role (or per user identity for service-level access). If a file-level ACL row exists for the target object, it **wins entirely** over the bucket default for that file. There is no merging; the file ACL is the complete permission set for that file.

**Effective permission algorithm:**

```
1. Look up file ACL row for (object_key, bucket_id).
2. If ACL row exists → evaluate against it; return result.
3. Else → evaluate against bucket grant table; return result.
```

This is intentionally simple: no inheritance chain, no merging, no "deny overrides allow" complexity.

**No per-folder ACLs in v1.** Folder-level ACLs are explicitly deferred. The UX complexity (which files are covered by which folder ACL? what happens when a file is moved?) outweighs the benefit for v1. Workspace administrators can use file-level ACLs for exceptional files.

**Public buckets**: a special `public` flag on the bucket bypasses the grant table for read operations entirely. Write and delete still require role grants. Public buckets with file-level ACLs on specific files use the ACL for those files (allowing private files within a public bucket).

## Consequences

### Positive

- Most buckets need only the grant table; file-level ACLs are an escape hatch, not the normal path.
- Permission resolution is O(1) for the common case (bucket grant table lookup) and O(1) for the override case (single file ACL lookup by primary key).
- The "file ACL wins" rule is easy to explain, reason about, and audit.
- No folder-level ACLs keeps the UX tractable in v1.

### Negative

- A file moved to a different key loses its file-level ACL (the ACL is keyed on `object_key`). The platform must warn operators when moving ACL'd files, or migrate the ACL row as part of the move operation.
- "File ACL wins entirely" means a misconfigured file ACL cannot be partially corrected by adjusting the bucket grant. The file ACL must be updated explicitly.
- No folder ACLs means large collections of exceptional files each need individual ACL rows. This is manageable for tens of files; it becomes operational overhead for hundreds.

### Neutral

- Service accounts (pipeline workers, integrations) can be granted file-level ACLs for specific objects without being added to workspace roles.
- The model is additive: folder ACLs can be introduced in a future version without breaking existing bucket grants or file ACLs.

## Alternatives Considered

### Option A: Full RBAC on Every File (No Bucket Default)

Every file has its own permission entry. No bucket defaults.

**Why not chosen:** Provisioning a bucket with 10,000 files would require 10,000 permission rows. Changing a bucket's overall access policy would require updating 10,000 rows. UI for browsing files and understanding "who can access this bucket" would require aggregating all rows. This is operationally expensive and confusing. The bucket-level default exists precisely to avoid per-file configuration for the common case.

### Option B: Filesystem-Style Umask Inheritance

Permissions inherit through folder hierarchy. A folder's permission is the intersection of the bucket's permissions and the folder's own mask. Files inherit from their parent folder.

**Why not chosen:** The platform's folder model is a logical prefix abstraction (ADR-0122), not a real hierarchy with stored folder entities. There are no folder objects to attach ACLs to. Simulating umask semantics over prefix strings would require scanning all ACL rows whose key is a prefix of the target file's key — an O(depth) lookup per access check. This is not portable across adapters and does not survive file moves without complex prefix rewriting. The UX of explaining umask semantics to workspace administrators is non-trivial. Deferred to v2 if genuinely needed.

## References

- ADR-0122 (logical folder abstraction — explains why no real folder entities exist)
- ADR-0125 (proxied signed URLs — enforces these permissions at download time)
- ADR-0126 (per-workspace credentials — storage access is gated by platform, not adapter)
- Objective 6 (RBAC — role model that bucket grants reference)
- Objective 11.5 (Workspace Assets)
