# ADR-0128: Quota Enforcement with Daily Reconciliation

**Status:** Accepted
**Date:** 2026-05-04
**Deciders:** solo

## Context

The platform provides storage for multiple workspaces. Without quota enforcement, a single workspace could consume unbounded storage, imposing costs on the operator and potentially denying storage capacity to other workspaces. Enforcing per-workspace quotas requires:

1. Knowing how much storage each workspace currently uses.
2. Blocking uploads that would exceed the quota.
3. Notifying workspace administrators as they approach the limit.
4. Keeping the usage figure accurate over time, accounting for uploads, deletes, and replacements.

Storage adapters (B2, Azure, MinIO) each have their own ways to report bucket usage, but these are not consistent, not always real-time, and not workable as the single source of truth across adapters. The platform's own DB is the natural place to track usage, but it must be validated against adapter-reported reality.

## Decision

**Per-workspace quota tracking in a `storage_quotas` table:**

```
storage_quotas (
  workspace_id       PK / FK
  quota_bytes        BIGINT    -- configured limit, default 107374182400 (100 GB)
  used_bytes         BIGINT    -- current tracked usage
  warn_80_sent_at    TIMESTAMPTZ
  warn_95_sent_at    TIMESTAMPTZ
  updated_at         TIMESTAMPTZ
)
```

**Usage tracking — transactional updates:**

Every upload completion increments `used_bytes` by the object's `size_bytes` in the same DB transaction that writes the `storage_object_metadata` row. Every delete decrements `used_bytes` in the same transaction as the metadata soft-delete. Object overwrites (same key, new content) compute the delta (`new_size - old_size`) and apply it.

**Hard limit enforcement:**

Before accepting an upload (at the point the tus `POST` is received or the simple-upload `POST` starts), the platform reads `used_bytes` and `quota_bytes`. If `used_bytes + incoming_size_bytes > quota_bytes`, the upload is rejected with HTTP `507 Insufficient Storage` and a structured error. Uploads already in progress (tus chunks) that would push over the limit mid-transfer are also rejected at the `PATCH` stage.

**Soft warnings:**

When `used_bytes / quota_bytes ≥ 0.80` and `warn_80_sent_at IS NULL`, the platform sends an email to the workspace owner and surfaces a persistent UI banner. Similarly at 95%. Warnings are sent once per threshold crossing (stored in `warn_80_sent_at` / `warn_95_sent_at`); they reset when `used_bytes` drops back below the threshold.

**Daily reconciliation job:**

A scheduled job (runs daily, configurable time) compares `storage_quotas.used_bytes` against the adapter's reported bucket usage for each workspace:

- If drift is ≤ 10 MB: no action (acceptable eventual consistency from concurrent operations).
- If drift is > 10 MB: the job triggers an alert (ops team notification via configured alerting channel) and recomputes `used_bytes` from a full scan of `storage_object_metadata.size_bytes` for that workspace. The reconciled value is written back to `used_bytes` and the discrepancy is logged to the audit trail.

**Default quota:** 100 GB per workspace. Operators configure per-workspace overrides in `workspace_storage_credentials` or via admin API.

## Consequences

### Positive

- Quota enforcement is synchronous and reliable: uploads are blocked before they exceed the limit, not after.
- The DB-tracked `used_bytes` is updated transactionally with metadata writes; no eventual consistency window in the normal path.
- Soft warnings give workspace administrators time to act before hitting the hard limit.
- Daily reconciliation catches drift caused by direct-API uploads, deletes that failed to update the DB, or bugs in delta calculation.

### Negative

- Every upload and delete touches the `storage_quotas` row for the workspace. This row is a hot spot for high-throughput workspaces; the platform may need optimistic-locking or batched updates at extreme write rates.
- The hard-limit check reads `used_bytes` before the upload begins; a race condition exists if two uploads start simultaneously and both read a value below the limit but together exceed it. This is mitigated by accepting minor overruns (< one file size) rather than serialising all uploads through a lock. Exact enforcement at the byte level is not guaranteed.
- Reconciliation by full `storage_object_metadata` scan is O(n) in the number of objects for the workspace. Very large workspaces (millions of objects) may require pagination and extended job runtime.
- Adapter-reported usage figures vary in freshness across B2, Azure, and MinIO; the reconciliation comparison is best-effort, not exact.

### Neutral

- The 10 MB drift threshold is configurable. Operators with stricter accounting requirements can lower it; operators with large object sizes and high churn can raise it.
- Quota changes (operator increases a workspace's limit) take effect immediately on the next upload; no cache invalidation required.

## Alternatives Considered

### Option A: Let the Adapter Enforce Quotas

Configure bucket-level size limits in B2, Azure, or MinIO and rely on the adapter to reject oversized uploads.

**Why not chosen:** Quota enforcement mechanisms differ across adapters (B2 has no native bucket size limit; Azure's quota is at the storage account level, not per container; MinIO's quota is available but requires MinIO-specific configuration). This approach would not be portable and could not provide a uniform experience (warnings, UI banner, consistent error format) across all adapters. The platform would lose visibility into usage until an upload was rejected by the adapter, preventing proactive warnings.

### Option B: No Quota Enforcement

Allow unlimited storage per workspace. Charge usage-based billing.

**Why not chosen:** Without enforcement, a single misbehaving or compromised workspace can consume the entire backing storage, denying capacity to other workspaces and generating unexpected costs for the operator. This is a billing and multi-tenancy correctness concern. Usage-based billing does not preclude quotas; the two are complementary.

## References

- ADR-0122 (logical folder abstraction — folder deletes are sequential; each object delete decrements `used_bytes`)
- ADR-0123 (tus resumable uploads — quota check occurs at upload initiation, not just completion)
- ADR-0124 (two-layer metadata — `storage_object_metadata.size_bytes` is the source for reconciliation scan)
- ADR-0126 (per-workspace credentials — each workspace has its own adapter scope for usage reporting)
- Objective 11.5 (Workspace Assets)
- `deploy/observability/grafana/provisioning/alerting/rules.yaml` (quota alert rules)
