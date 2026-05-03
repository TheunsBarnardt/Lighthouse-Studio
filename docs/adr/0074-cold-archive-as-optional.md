# ADR-0074: Cold Archive as Optional Feature

**Status:** Accepted
**Date:** 2026-05-02
**Deciders:** solo

## Context

The hash-chained audit log (ADR-0068) is tamper-evident but not tamper-proof. A database administrator with full credentials can rewrite events and recompute hashes. The threat model documents this honestly.

For customers in high-assurance contexts (financial services, government, healthcare), "tamper-evident" may be insufficient. They need the ability to prove to an external auditor that the audit log has not been modified — not just detect if it has been.

One approach: archive audit events to write-once storage (immutable object storage with object lock) where even a compromised database admin cannot modify the historical record. Each archived chunk is cryptographically signed; verification requires only the platform's public key, not database access.

The question: should cold archival be:

- **Always on** (required)
- **Opt-in** (default off, customer enables)
- **Opt-out** (default on, customer disables)

## Decision

Cold archival is **opt-in** (default off).

When enabled (`PLATFORM_COLD_ARCHIVE_ENABLED=true`):

- Daily job archives the previous day's audit events per workspace to object storage
- Each day's chunk is compressed (gzip), signed with the installation's private key, and uploaded with object lock
- A manifest records file hash, event count, workspace ID, and first/last sequence numbers
- The live database retains the events until normal retention enforcement; the archive is an additional copy, not a replacement
- Verification: any party with the platform's public key can verify a chunk's signature and hash

Storage providers: Backblaze B2 (with object lock) or Azure Blob Storage (with immutability policies).

**Rationale for opt-in:**

Cold archival adds:

- Operational complexity: key management for the signing key; object storage bucket with object lock configuration; monitoring the archive job
- Storage cost: an additional copy of all audit events in object storage
- Conceptual overhead: operators must understand the archive's role and how to use it for verification

Most self-hosted customers do not need tamper-proof guarantees. They benefit from the hash chain's tamper-evidence, and their threat model does not include a compromised database admin modifying the audit log.

For customers who do need stronger guarantees (financial services audit trails, certain government contexts, healthcare organizations with specific regulatory requirements), cold archival provides the additional layer. Making them explicitly opt in ensures they understand they are enabling it and why.

## Consequences

### Positive

- Customers who need tamper-proof guarantees can get them without complicating the default installation.
- Opt-in means operators who enable it do so intentionally; they are more likely to understand the feature and verify it works.
- The signing key is managed separately from the database credentials; a compromised database admin cannot forge archive signatures without also compromising the signing key.
- Object lock prevents modification even by the storage account owner (within the lock period).

### Negative

- Most customers don't enable cold archival, so the platform's tamper guarantees remain "tamper-evident" for the majority. Marketing materials must not imply tamper-proof without noting the opt-in requirement.
- The signing key is a new credential to manage (generate, rotate, store securely). Rotation requires restarting the signing chain; old chunks remain verifiable with the old key.
- If the archive job fails silently, customers may believe they have cold archival when they don't. Monitoring (alerts on archive job failure) is required and documented.

### Neutral

- The archive is a parallel copy of events also in the live database. During normal operation, the live database is the primary. The archive is accessed only for verification and incident response.
- Chunk granularity is one day per workspace. Finer granularity would increase the frequency of object storage operations; coarser would delay tamper-proofing of recent events.

## Alternatives Considered

### Option A: Always-on cold archival

Every installation archives to object storage. Rejected because it requires object storage credentials at installation time, adds cost for every customer, and adds operational complexity that many self-hosted customers neither need nor want. The self-hosted value proposition includes simplicity; a required external dependency undermines it.

### Option B: Opt-out (default on, customer disables)

Default to archival; customers who don't need it disable it. Rejected because it means the first thing customers do is figure out how to disable a feature they don't want. Default-on requires the storage configuration to be present at installation, which raises the barrier to getting started.

### Option C: Separate audit service with write-once guarantees

Use a purpose-built audit log service (AWS CloudTrail, Google Cloud Audit Logs, Sumo Logic) rather than building archival ourselves. Rejected because the platform is self-hosted; mandatory external service dependencies contradict the core value proposition. Customers can integrate such services via the SIEM export feature independently.

## References

- [ADR-0068: Hash-Chained Audit Log](./0068-hash-chained-audit-log.md)
- [ADR-0069: Append-Only Database Permissions](./0069-append-only-database-permissions.md)
- `docs/compliance/threat-model.md` — "Known Limitations / Accepted Risks" §1
- `docs/runbooks/cold-archive-verification.md`
