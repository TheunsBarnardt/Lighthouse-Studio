# ADR-0126: Per-Workspace Storage Credentials

**Status:** Accepted
**Date:** 2026-05-04
**Deciders:** solo

## Context

The platform must access storage backends (Backblaze B2, Azure Blob Storage, MinIO) on behalf of multiple workspaces. Each adapter requires credentials to perform operations (upload, download, delete, list). The platform holds these credentials; the question is the granularity at which they are scoped.

Two failure modes are in tension:

1. **Credential blast radius**: if one workspace's credential is compromised (e.g., leaked in a log), it should not give access to any other workspace's data.
2. **Operational complexity**: provisioning and rotating per-workspace credentials at scale must be automatable and not require human intervention per workspace.

Additionally, the platform's own root/admin credentials must never be exposed through the customer-facing API — even indirectly. A path-prefix-isolation scheme using a single credential can fail if any injection vulnerability in object key construction allows traversal to another prefix.

## Decision

Each workspace receives its **own storage adapter credentials**, scoped to only that workspace's bucket(s):

- **Backblaze B2**: a B2 Application Key scoped to a single bucket (`capabilities` set to `[listFiles, readFiles, writeFiles, deleteFiles]` on the workspace's bucket only). The platform creates this key via the B2 API at workspace provisioning time.
- **Azure Blob Storage**: a Shared Access Signature (SAS) scoped to a single container, with `racwdl` permissions (read, add, create, write, delete, list). SAS tokens have expiry; the platform stores the storage account key separately (never exposed) and generates new SAS tokens on rotation.
- **MinIO**: a per-workspace IAM user with a policy granting access only to the workspace's bucket (`arn:aws:s3:::ws-{id}/*`). Credentials are an access key + secret key pair generated at provisioning.

The platform's **root credentials** (master B2 key, Azure storage account key, MinIO root credentials) are stored in the secrets manager and used only to provision or rotate workspace credentials. They are never written to the database, never logged, and never returned via any API endpoint.

**Credential storage**: workspace credentials are stored encrypted in the `workspace_storage_credentials` table using the platform's envelope encryption (KMS-wrapped data key per row).

**Credential rotation**: rotating one workspace's credential does not affect any other workspace. The platform supports on-demand rotation (`POST /workspaces/{id}/storage/rotate-credentials`) and scheduled automatic rotation (configurable interval, default 90 days).

## Consequences

### Positive

- A compromised workspace credential gives access only to that workspace's bucket; other workspaces are unaffected.
- Root credentials are never in the code path of any customer-facing operation; their exposure surface is minimal.
- Rotation is per-workspace: rotating credentials for a compromised workspace does not disrupt any other workspace.
- Each workspace's credential can have the minimum necessary permissions (least privilege).

### Negative

- Provisioning a workspace requires an API call to the storage backend to create the credential. Workspace creation is slower and has an external dependency.
- The platform must handle credential expiry (Azure SAS tokens expire; B2 application keys can be set to expire). A background job must detect and rotate expiring credentials before they lapse.
- At large scale (thousands of workspaces), the number of credentials managed increases linearly. B2 and MinIO have per-account limits on application keys and IAM users respectively; very large deployments may need multiple storage accounts.
- Provisioning failures mid-workspace-creation require cleanup logic; partial states (workspace row exists but no storage credential) must be handled gracefully.

### Neutral

- The `workspace_storage_credentials` table row count mirrors the workspace count; it is not a high-growth table in terms of rows but each row is security-sensitive.
- Operators can opt out of automatic credential rotation if their compliance posture requires manual rotation.

## Alternatives Considered

### Option A: Shared Credentials with Path-Prefix Isolation

Use a single set of platform credentials for all workspaces. Scope access by enforcing that all object keys are prefixed with `ws-{workspace-id}/`. Validate the prefix in the platform's storage service.

**Why not chosen:** Any vulnerability in the object key construction logic (e.g., path traversal via `../../`, injection in user-supplied filenames, or a bug in prefix enforcement) would give one workspace access to another's data. Prefix isolation is a software enforcement, not a cryptographic or access-control boundary. The blast radius of a root credential compromise is also the entire storage backend. This is insufficiently robust for a multi-tenant platform where data isolation is a core guarantee.

### Option B: Single Service Account for All Workspaces

Use one long-lived service account/API key with full access to all buckets. Rely on the platform's application-level RBAC to enforce isolation.

**Why not chosen:** The service account has too broad a permission scope. If the account's credentials are exposed (in a log, in an environment variable leak, in a breach of the secrets manager), all workspaces' data is at risk. Rotation requires updating a single credential but also immediately disrupts all workspace operations. This violates the principle of least privilege and creates an unacceptable blast radius.

## References

- [Backblaze B2 Application Keys documentation](https://www.backblaze.com/docs/cloud-storage-application-keys)
- [Azure SAS token scoping](https://learn.microsoft.com/en-us/azure/storage/common/storage-sas-overview#types-of-shared-access-signatures)
- [MinIO IAM policies](https://min.io/docs/minio/linux/administration/identity-access-management/policy-based-access-control.html)
- ADR-0125 (proxied signed URLs — never exposes storage credentials to browsers)
- ADR-0127 (bucket-level permissions)
- ADR-0128 (quota enforcement)
- Objective 6 (RBAC and workspace isolation)
- Objective 11.5 (Workspace Assets)
