# Objective 7: Audit and Compliance

**Status:** Ready for development
**Prerequisites:** Objectives 1, 1.5, 2, 3, 4 family, 5, 6 complete
**Blocks:** Sale to any compliance-conscious customer (most enterprises); production launch

---

## 1. Purpose

Consolidate the audit infrastructure that has been accumulating across earlier objectives into a coherent, complete, queryable audit system. Add retention policies, export formats, tamper-evident properties, and the documentation that compliance auditors and customer security teams actually want to see.

The audit log is the platform's record of what happened, who did it, when, and why. It is what enables forensics, incident response, regulatory compliance, customer trust, and (occasionally) legal defense. Done well, it's invisible during normal operation and indispensable during investigations. Done poorly, it's noise that no one reads until a problem makes it valuable, at which point its gaps cost real money.

This objective produces no user-visible features. It produces the audit and compliance posture that turns the platform from "self-hostable software" into "self-hostable software an enterprise security team will actually approve."

---

## 2. Scope

### In Scope

- The `AuditPort` finalized (it's been used informally since Objective 7 was referenced; here it's locked down)
- Audit event taxonomy: a complete, documented enumeration of event types
- Audit storage: immutable, append-only, with database-enforced no-update / no-delete
- Tamper-evidence: hash chaining of audit events so any modification is detectable
- Retention policies: configurable per workspace, enforced by scheduled job
- Audit log query API: filtered search, time range, actor, resource, action
- Export formats: JSON Lines, CSV, optionally SIEM-formatted (CEF, LEEF) for enterprise integration
- Compliance posture documentation: SOC 2, GDPR, HIPAA mapping (what the platform helps with, what it doesn't)
- Personal data registry: documenting what PII the platform stores, where, and for how long
- Data subject access (GDPR Article 15) and erasure (Article 17) request handling
- Operational runbooks: incident response, evidence preservation, audit log corruption recovery
- Compliance configuration: the customer's installation has settings that map to their compliance regime
- ADRs

### Out of Scope (Belongs to Later Objectives or Customer Work)

- The customer's broader compliance program (we provide what they need from us; their overall SOC 2 audit is theirs)
- Continuous compliance monitoring tools (Vanta, Drata) — integration is a customer concern; the platform exposes the right APIs
- HIPAA Business Associate Agreement signing (a legal matter between Anthropic / the customer / their counsel; the platform is BA-ready in capabilities)
- Penetration test reports (Objective 10 produces these as part of the foundation quality gate)
- Specific certifications (the platform doesn't claim certifications; customers running it claim certifications for their use)
- Real-time SIEM streaming protocols beyond export — deferred until a customer requires it
- Detection rules / alerting on audit patterns (UBA-style) — separate concern; the audit data is available, alerting on it is feature-territory

---

## 3. Locked Decisions

| Decision                     | Choice                                                                                                                                                                                             | Rationale                                                                                      |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Audit storage location       | Same database as primary data, separate `audit_log` table/collection                                                                                                                               | Simpler ops; same backup story; enforced no-update via permissions                             |
| Append-only enforcement      | Database permissions: app user has INSERT only; no UPDATE, DELETE                                                                                                                                  | Defense in depth; even SQL injection cannot tamper                                             |
| Tamper evidence              | Hash chain: each event includes hash of previous event's content + hash                                                                                                                            | Modifications detectable by re-verifying the chain                                             |
| Hash algorithm               | SHA-256                                                                                                                                                                                            | Standard; not deprecated; widely supported in compliance contexts                              |
| Hash chain seed              | Per workspace, established at workspace creation, stored in workspace settings                                                                                                                     | Per-workspace chains independent (so removing one workspace's audit doesn't invalidate others) |
| Retention default            | 7 years for production installations; 90 days for dev                                                                                                                                              | 7 years matches financial-services / SOX retention; longer than most regulatory minimums       |
| Retention configuration      | Per workspace; minimum bounded by installation policy; cannot be set below regulatory minimum                                                                                                      | Compliance flexibility without footguns                                                        |
| Hard delete trigger          | Only by scheduled retention enforcement job; never by user action                                                                                                                                  | Prevents accidental or malicious early deletion                                                |
| Audit event format           | Flat JSON document with stable top-level keys; details in `metadata` field                                                                                                                         | Stable shape over time; extensible for new fields                                              |
| Required fields per event    | event_id, event_type, occurred_at, actor (kind+id+identity_provider), workspace_id (if applicable), resource_type, resource_id, action, outcome (success/failure), correlation_id, prev_hash, hash | Matches what auditors want                                                                     |
| Export formats               | JSON Lines (default), CSV, CEF, LEEF                                                                                                                                                               | JSONL for programmatic; CSV for spreadsheet analysis; CEF/LEEF for SIEM                        |
| Export delivery              | Streaming download for the workspace owner (or installation admin); audit-logged itself                                                                                                            | Exports are also auditable events                                                              |
| Personal data marking        | Each field in audit metadata can be tagged as `pii: true` for redaction on export and for GDPR access requests                                                                                     | Granular; the GDPR machinery uses this tagging                                                 |
| Audit access                 | Workspace owner / admin can read their workspace's audit; installation auditor reads cross-workspace; nobody else                                                                                  | Audit is sensitive; access itself is audited                                                   |
| Audit log immutability claim | Documented as "tamper-evident" not "tamper-proof" — chain detects modification but a determined database admin with full credentials can rewrite history                                           | Honest characterization; matches reality of self-hosted systems                                |

---

## 4. Architectural Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                         SERVICE LAYER                                  │
│                                                                        │
│  Every state-changing operation:                                       │
│  - Begins, possibly with authorize(), validate(), execute(), audit()   │
│  - audit() goes through AuditPort                                      │
│                                                                        │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
                               ▼
                ┌────────────────────────────┐
                │       AuditPort             │
                │                              │
                │  - write(entry)              │
                │  - query(filter, page)       │
                │  - exportStream(filter)      │
                │  - verifyChain(workspaceId)  │
                └─────────────┬───────────────┘
                              │ implemented by
                              ▼
                ┌────────────────────────────┐
                │  audit-builtin adapter      │
                │                              │
                │  - Computes hash chain        │
                │  - Inserts (never updates)   │
                │  - Per-request batching       │
                │  - Backpressure handling     │
                └─────────────┬───────────────┘
                              │
                              ▼
              ┌──────────────────────────────────┐
              │ Persistence (per database)        │
              │                                    │
              │ audit_log table/collection with:  │
              │  - Append-only DB permissions     │
              │  - Indexes for common queries     │
              │  - Hash chain integrity column    │
              └──────────────┬─────────────────┘
                             │
                             ▼
                ┌─────────────────────────────┐
                │ Scheduled jobs                │
                │  - retention enforcement      │
                │  - chain integrity verify     │
                │  - export request processing  │
                └─────────────────────────────┘
```

The audit table is the only place in the schema where the application user has INSERT-only privileges. UPDATE and DELETE are denied at the database level. The retention enforcement job runs as the migration user (which has DELETE), and only deletes events past their retention window.

---

## 5. The Hard Parts

**5.1 Hash chaining without locks**

A naive hash chain requires every event to know the hash of the previous event. If two events arrive concurrently, they need to be ordered, and that's a serialization point.

The platform's solution: per-workspace chains. Audit events for workspace A don't depend on workspace B's events. Concurrent inserts to different workspaces don't contend. Within a single workspace, audit events are sequenced by a database-level sequence/identity, and the hash of event N includes the hash of event N-1 within that workspace.

Per-installation events (workspace-spanning) use a separate "installation chain."

This bounds contention to "many simultaneous events in the same workspace," which is rare in practice — workspace activity is bursty but not highly concurrent at the audit-write granularity.

**5.2 Hash chain across the three databases**

- **Postgres**: a sequence per workspace (`audit_seq_<workspace_id>`) plus a deterministic compute. Inserts use `INSERT ... RETURNING` to grab the new sequence value and previous-hash atomically.
- **MSSQL**: similar, using IDENTITY columns scoped per workspace via a separate sequence object per workspace.
- **Mongo**: per-workspace `audit_chains` document with `last_hash` and `last_sequence`; updates are atomic via `findOneAndUpdate` with optimistic concurrency. Each new audit event reads the chain doc, computes the new hash, writes the event, and updates the chain doc — all in a transaction.

The `verifyChain` operation re-reads all events in order and recomputes hashes; any mismatch indicates tampering or storage corruption. Verification is expensive (linear in chain length) but rarely needed; a quarterly verification drill catches issues before they become incidents.

**5.3 What goes in an audit event vs. what goes in an application log**

Audit events are about **state changes**: someone did a thing that changed the system. They have actor, resource, action, outcome. They are the system of record for "who did what when."

Application logs are about **execution**: code ran, decisions were made, errors occurred. They have correlation IDs, request IDs, structured context. They are the system of record for "why does the code think it did the right thing."

Both are needed; both go to different stores; both serve different audiences. Confusion between them is a common failure mode.

A simple test: if it's gone from the database tomorrow, would compliance care? If yes, it's an audit event. If only debuggers care, it's a log.

**5.4 The "noisy events" problem**

Some events fire constantly: every read, every authorization grant. Recording every authorization grant produces a torrent of audit events that drowns the signal.

The platform's policy:

- **Always audit**: state changes, denials, anything an attacker would want to obscure
- **Audit at debug level (suppressed by default)**: granted authorizations, successful reads
- **Configurable elevation**: high-security installations can elevate "successful read of certain resource types" to always-audit

Granted authorizations not appearing in the default audit log is a deliberate trade-off: their existence is implied by the actions that succeed. If a deletion appears in the audit log, the corresponding authorization grant must have happened. The read doesn't appear, but if it produced no state change, there's nothing to audit anyway.

When an installation enables elevated audit (e.g., for HIPAA where read access to PHI is auditable), the volume goes up significantly. The infrastructure is sized for it; documentation explains the trade-off.

**5.5 Data subject access requests (GDPR Article 15)**

When a data subject (user) requests "everything you have on me," the platform must produce a comprehensive export. This includes:

- Their User Directory record
- Their identities and their metadata
- Their workspace memberships
- All audit events where they are the actor or the target
- All artifacts they created (within retention)
- All approvals they granted or rejected
- Linked external identities (with provider-specific identifiers, where the provider permits)
- Personal preferences

This is a serious operation: it pulls from every part of the platform's data model. The implementation is a service that walks the personal data registry (Section 6.4) and assembles the export.

The user (or their representative; admin acting on behalf) submits a request; the request is itself audited; processing is asynchronous (a job); the result is a downloadable archive with manifest. Time-to-fulfill SLA: the platform can produce the export within 24 hours of request; GDPR allows 30 days, so this is comfortable.

**5.6 Right to erasure (GDPR Article 17)**

When a user requests deletion of their data, the platform processes a soft-delete (already implemented via `archive` from earlier objectives) followed by a hard-delete after the retention window for legal hold or pending obligations.

What gets deleted:

- User Directory record (or anonymized: replaced with `deleted-user-{hash}`)
- Personal preferences
- Identities

What is **retained** (legally required, with documented justification):

- Audit events (referencing the user's now-anonymized id; the events themselves are tamper-evident records of platform operations and cannot be erased without compromising the audit log)
- Financial records (none in this product, but the schema accommodates them)
- Records subject to legal hold (a flag the workspace owner sets)

Anonymization replaces the user's email and display name with deterministic hashes; queries by id still work; queries by email return no results. Audit events keep referring to the same id, so forensics still works, but they don't expose the original identity.

This balance is documented and configurable: an installation in a jurisdiction with stricter erasure requirements can be configured for more aggressive deletion. The default is the global-jurisdiction-friendly balance.

**5.7 The Personal Data Registry**

A machine-readable registry at `packages/core/src/compliance/personal-data-registry.ts` enumerates every place the platform stores PII:

```typescript
export const personalDataRegistry: PersonalDataRecord[] = [
  {
    location: 'users.primary_email',
    category: 'contact',
    purpose: 'authentication, communication',
    legal_basis: 'contract',
    retention: 'until account deletion + 30 days',
    eraseable: true,
  },
  {
    location: 'audit_log.metadata.email',
    category: 'contact',
    purpose: 'forensic record',
    legal_basis: 'legitimate interest',
    retention: '7 years (configurable)',
    eraseable: false, // anonymized, not deleted
  },
  // ... every other PII location
];
```

This registry drives:

- Data subject access export (walks the registry, queries each location)
- Erasure handling (knows what to delete vs. anonymize)
- The compliance posture document (auto-generated from the registry)
- The platform's privacy notice (template populated from the registry)

When a feature objective adds a new place where PII is stored, it must update the registry. This is a code review checklist item.

**5.8 Tamper-evident, not tamper-proof**

A common compliance question: "is your audit log tamper-proof?" The honest answer is no. A determined database administrator with full credentials and direct database access can rewrite audit events. The hash chain detects this — re-verifying the chain after the fact will reveal which events were modified — but the chain itself can be rewritten by recomputing hashes.

What the platform offers:

- Append-only DB permissions for the application user (most attacks come through the application, not direct DB access)
- Hash chain that detects modifications during a verification pass
- Quarterly chain verification drills documented in runbooks
- Optional: external archival of audit chunks (signed by the platform, sent to immutable storage like Backblaze B2 with object lock) — for true tamper-proofing, customers can enable this

The platform documents this clearly. Marketing claims of "tamper-proof" without external archival are dishonest; the platform doesn't make them. With external archival enabled (a customer choice), the strongest claim is "tamper-evident at the database level, tamper-proof for archived chunks."

**5.9 Audit query performance**

Audit logs grow without bound (until retention kicks in). A workspace running for 5 years produces a lot of events. Queries must remain fast.

Indexes on the audit table:

- `(workspace_id, occurred_at DESC)` — primary query pattern
- `(workspace_id, actor_id, occurred_at DESC)` — "what did this user do"
- `(workspace_id, resource_type, resource_id, occurred_at DESC)` — "what happened to this thing"
- `(workspace_id, action, occurred_at DESC)` — "all sign-ins this month"

Time-based partitioning (Postgres): the audit table is partitioned by month. Queries with time bounds prune partitions automatically. Old partitions can be detached for archival.

For Mongo: a TTL index handles retention; sharded by workspace_id+occurred_at would scale to large installations (deferred until needed).

For MSSQL: partitioned views or partitioned tables; columnstore indexes for analytical queries.

**5.10 Compliance documentation as living artifacts**

The platform produces compliance-relevant documents auto-generated from code and configuration:

- `docs/compliance/personal-data-registry.md` — generated from the registry
- `docs/compliance/audit-event-catalog.md` — generated from the event taxonomy
- `docs/compliance/control-matrix-soc2.md` — manually authored, references generated artifacts
- `docs/compliance/control-matrix-gdpr.md` — same
- `docs/compliance/control-matrix-hipaa.md` — same (only relevant for healthcare-context customers)

These documents are reviewed by customer security teams. They're not certifications, but they're the "show me how you handle X" answers customers need.

---

## 6. Component Specifications

### 6.1 AuditPort (final form)

```typescript
// packages/ports/audit/src/audit.port.ts

export interface AuditPort {
  /**
   * Write a single audit event.
   * Computes hash chain entry; persists.
   */
  write(entry: AuditEntryInput): Promise<Result<AuditEntry, AuditError>>;

  /**
   * Write a batch of events for the same workspace.
   * More efficient under high event rates.
   */
  writeBatch(entries: AuditEntryInput[]): Promise<Result<AuditEntry[], AuditError>>;

  /**
   * Query audit events. Workspace-scoped by default; installation-scoped requires installation_auditor role.
   */
  query(ctx: RequestContext, filter: AuditFilter, page: Page): Promise<Result<PaginatedResult<AuditEntry>, AuditError>>;

  /**
   * Stream audit events for export. Returns AsyncIterable for memory-efficient large exports.
   */
  exportStream(ctx: RequestContext, filter: AuditFilter, format: ExportFormat): AsyncIterable<Buffer>;

  /**
   * Verify the hash chain integrity for a workspace (or installation).
   * Returns the count of events verified and any tampering detected.
   */
  verifyChain(ctx: RequestContext, workspaceId: string): Promise<Result<ChainVerification, AuditError>>;

  /**
   * Begin a data subject access request — assemble all data for a user.
   */
  startDataSubjectExport(ctx: RequestContext, userId: string): Promise<Result<DataSubjectExportJob, AuditError>>;

  /**
   * Begin an erasure request.
   */
  startErasureRequest(ctx: RequestContext, userId: string, opts: ErasureOptions): Promise<Result<ErasureJob, AuditError>>;
}

export interface AuditEntryInput {
  eventType: string; // e.g., 'auth.signin.succeeded', 'workspace.member.removed'
  workspaceId?: string; // null for installation-scoped events
  actor: {
    kind: 'user' | 'service_account' | 'system';
    id: string | null; // null for fully system events
    identityProvider?: string;
    email?: string; // captured at event time, may not match current
  };
  resource: {
    type: string;
    id: string;
  };
  action: string;
  outcome: 'success' | 'failure' | 'denied';
  reason?: string; // for failures and denials
  metadata?: Record<string, MetadataValue>;
  ipAddress?: string;
  userAgent?: string;
  correlationId: string;
}

export interface AuditEntry extends AuditEntryInput {
  id: string;
  sequence: number; // per-workspace monotonic
  occurredAt: Date;
  prevHash: string; // hash of the previous event in this workspace's chain
  hash: string; // hash of THIS event's content
}

export interface AuditFilter {
  workspaceId?: string; // installation auditor can omit
  eventType?: string | string[];
  actorId?: string;
  resourceType?: string;
  resourceId?: string;
  action?: string;
  outcome?: 'success' | 'failure' | 'denied';
  occurredAfter?: Date;
  occurredBefore?: Date;
  correlationId?: string;
}

export type ExportFormat = 'jsonl' | 'csv' | 'cef' | 'leef';

export interface ChainVerification {
  workspaceId: string;
  verifiedAt: Date;
  eventsVerified: number;
  status: 'intact' | 'tampered';
  tamperedAt?: { sequence: number; expectedHash: string; actualHash: string };
}
```

### 6.2 Audit Event Taxonomy

A complete catalog of every audit event the platform emits. Each event has:

- `event_type`: dotted name (`<area>.<entity>.<action>`)
- `description`: what triggered it
- `actor_kind`: who can trigger it
- `metadata_schema`: what extra fields the metadata carries
- `pii_fields`: which metadata fields contain PII (for redaction on export and erasure handling)

Examples (the full catalog is in `docs/compliance/audit-event-catalog.md`):

```
auth.signin.succeeded
auth.signin.failed
auth.signin.locked_out
auth.signout.completed
auth.session.created
auth.session.refreshed
auth.session.revoked
auth.password.set
auth.password.reset_requested
auth.email.verified
auth.email.changed
auth.mfa.enrolled
auth.mfa.disabled
auth.mfa.failed
auth.identity.linked
auth.identity.unlinked
auth.user.created
auth.user.archived
auth.user.restored
auth.user.hard_deleted

workspace.created
workspace.updated
workspace.archived
workspace.restored
workspace.deleted
workspace.transferred
workspace.member.invited
workspace.member.accepted
workspace.member.removed
workspace.member.role_assigned
workspace.member.role_removed
workspace.role.created
workspace.role.updated
workspace.role.deleted
workspace.approval_route.updated

artifact.created
artifact.updated
artifact.archived
artifact.restored
artifact.approved
artifact.rejected
artifact.changes_requested

deploy.initiated
deploy.completed
deploy.failed
deploy.rolled_back

data.subject.access_requested
data.subject.access_completed
data.subject.erasure_requested
data.subject.erasure_completed

audit.export.created
audit.chain.verified
audit.retention.enforced

system.config.changed
system.migration.applied
system.backup.completed
```

The catalog is the contract. Adding a new event type requires updating the catalog in the same PR — caught by a CI check that compares emitted event types in the codebase against the catalog.

### 6.3 Audit Storage Schema

```typescript
// Logical schema (translated per database)

audit_log: {
  id: uuid,                           // event id
  sequence: bigint,                    // per-workspace monotonic
  workspace_id: uuid?,                 // null for installation-scoped
  event_type: string(255),
  occurred_at: timestamptz,
  actor_kind: enum,
  actor_id: uuid?,
  actor_identity_provider: string(100)?,
  actor_email_snapshot: string(255)?,
  resource_type: string(100),
  resource_id: string(255),
  action: string(100),
  outcome: enum('success', 'failure', 'denied'),
  reason: text?,
  metadata: json,
  ip_address: string(45)?,             // ipv6-friendly
  user_agent: string(500)?,
  correlation_id: string(255),
  prev_hash: char(64),                  // hex sha-256
  hash: char(64),                       // hex sha-256
  // No version, no archived_at, no updated_at — audit is immutable
  // _created_at is the same as occurred_at (or close enough)
}

primary key: (workspace_id, sequence)  // null workspace_id is allowed; one chain for installation events
indexes:
  - (workspace_id, occurred_at DESC)
  - (workspace_id, actor_id, occurred_at DESC)
  - (workspace_id, resource_type, resource_id, occurred_at DESC)
  - (workspace_id, event_type, occurred_at DESC)
  - (correlation_id)

audit_chain_state: {
  workspace_id: uuid PK,                // null entry exists for installation chain
  last_sequence: bigint,
  last_hash: char(64),
  initialized_at: timestamptz,
  initialization_seed: char(64),        // random per-workspace, never disclosed
}
```

For Mongo: equivalent collections with the same structure, validators, and indexes. Mongo's transactions are used for the (event insert + chain state update) pair.

**Database permissions:**

The platform's `app_user` (the application database user) has:

- `audit_log`: SELECT, INSERT only
- `audit_chain_state`: SELECT, UPDATE only (the application updates the last_hash on every insert)

`migrate_user` has full DDL on both. `audit_user` (used by the retention enforcement job) has DELETE on `audit_log` for old rows only (Postgres: a row-level security policy; MSSQL: a stored procedure with embedded WHERE clause; Mongo: the application-layer retention job uses a service account with delete privileges).

### 6.4 Personal Data Registry

```typescript
// packages/core/src/compliance/personal-data-registry.ts

export interface PersonalDataRecord {
  location: string; // 'users.primary_email' etc.
  category: PersonalDataCategory;
  purpose: string;
  legal_basis: 'contract' | 'consent' | 'legitimate_interest' | 'legal_obligation' | 'vital_interest' | 'public_task';
  retention: string; // human-readable; mapped to retention engine for enforcement
  eraseable: boolean;
  erasure_method?: 'delete' | 'anonymize';
  notes?: string;
}

export type PersonalDataCategory = 'identity' | 'contact' | 'authentication' | 'preference' | 'forensic' | 'usage' | 'communication';

export const personalDataRegistry: PersonalDataRecord[] = [
  // Populated incrementally; every feature objective updates this
];
```

CI check: every PR that adds a column or field referenced as PII (detected via heuristics on column names like `email`, `phone`, `name`, etc., plus an explicit `@pii` annotation in schema definitions) must also touch the registry. The check is a soft warning, not a hard fail (heuristics are imperfect), but it surfaces the question for review.

### 6.5 Retention Enforcement

A scheduled job runs daily:

1. For each workspace, compute the cutoff date based on workspace settings (or installation default)
2. Query audit events older than cutoff
3. Before deletion, archive them to cold storage (Backblaze B2) if cold archival is enabled
4. Delete in batches with explicit transactions
5. Emit an audit event for the retention enforcement (yes, deletion is itself audited, in the chain — the deletion record stays even after the deleted events are gone)

For workspaces with legal hold flag: retention is paused, with audit events explaining why.

The retention job is the only path that deletes audit events. Any other deletion is a database-level integrity violation and is caught by chain verification.

### 6.6 Cold Archival (Optional)

For installations needing tamper-proof (not just tamper-evident) audit:

- Daily job collates yesterday's audit events per workspace
- Computes a manifest hash of the day's chunk
- Signs the manifest with the platform's installation private key
- Uploads chunk + manifest to Backblaze B2 with object lock (write-once)
- Stores the chunk's manifest hash in the audit_chain_state for that workspace

Verification: anyone with the platform's public key can verify a chunk's signature. The chain's hash continuity proves no events are missing from the chunk.

This is opt-in because it adds operational complexity and storage cost. Customers who don't need it skip it; customers who do enable it via a single config flag.

### 6.7 Data Subject Access Export

Service layer: `DataSubjectAccessService.startRequest(ctx, userId)`.

Workflow:

1. Validate that the requester has rights (the user themselves, or an installation admin acting on their behalf)
2. Insert a job record (`audit.data_subject.access_requested`)
3. Schedule a background job (via `JobQueuePort`)
4. Background job:
   - Walks `personalDataRegistry` for every PII location
   - Queries each location for data matching the userId
   - Assembles into a structured archive (JSON files per category, plus a manifest)
   - Encrypts the archive with a one-time key (delivered to the user separately)
   - Uploads to a time-limited storage URL
   - Emits `audit.data_subject.access_completed`
   - Notifies the user
5. The download URL expires in 7 days; an unfetched export is purged

The export is itself an audit event with the request id. Multiple requests by the same user are deduped within a 7-day window.

### 6.8 Erasure Handling

Service layer: `DataSubjectAccessService.startErasureRequest(ctx, userId, opts)`.

Workflow:

1. Validate the requester has rights
2. Insert audit event `audit.data_subject.erasure_requested`
3. The user record is immediately archived (soft-delete; cannot sign in)
4. After a configured grace period (default 30 days), a job:
   - For each PII location with `eraseable: true, erasure_method: 'delete'`: deletes the data
   - For each location with `eraseable: true, erasure_method: 'anonymize'`: replaces with deterministic anonymized values
   - For each location with `eraseable: false`: skipped (with audit note)
   - Emits `audit.data_subject.erasure_completed` with summary
5. The audit log itself retains references to the user's id (which now points to no user record), preserving forensic continuity

Legal hold flag overrides the grace period; erasure is paused with audit explanation.

### 6.9 Compliance Documents

Auto-generated from code on every merge to main:

**`docs/compliance/personal-data-registry.md`** — table of all personal data locations, generated from the registry.

**`docs/compliance/audit-event-catalog.md`** — table of all audit event types, generated from the taxonomy file.

**`docs/compliance/data-flow-diagram.md`** — high-level diagram showing where PII flows; semi-automated.

Manually authored, reviewed annually:

**`docs/compliance/control-matrix-soc2.md`** — maps SOC 2 Trust Services Criteria (Security, Availability, Confidentiality, Processing Integrity, Privacy) to platform features. Each control has: the criterion, how the platform addresses it, evidence references (audit events, configurations, code paths).

**`docs/compliance/control-matrix-gdpr.md`** — maps GDPR articles to platform features.

**`docs/compliance/control-matrix-hipaa.md`** — maps HIPAA Security Rule and Privacy Rule requirements to platform features. Note: the platform is HIPAA-ready (provides the controls a covered entity needs); customers operating in healthcare contexts must have their own BA agreements, risk analyses, and operational practices.

**`docs/compliance/threat-model.md`** — threat model maintained alongside the codebase; updated whenever architectural changes affect threat surfaces.

### 6.10 Operational Runbooks

New files in `docs/runbooks/`:

- `audit-chain-integrity-drill.md` — quarterly verification procedure
- `audit-export-request.md` — handling customer requests for audit log exports
- `data-subject-access-request.md` — fulfilling Article 15 requests
- `data-subject-erasure-request.md` — fulfilling Article 17 requests
- `audit-storage-corruption.md` — what to do if chain verification fails (root cause: storage bitrot, malicious tampering, software bug)
- `legal-hold.md` — placing and removing legal holds; effects on retention
- `incident-evidence-preservation.md` — when an incident is discovered, what to capture and preserve
- `audit-log-restore.md` — restoring audit logs from backup; chain verification after restore
- `cold-archive-verification.md` — procedure for periodic verification of archived chunks

---

## 7. Implementation Order

1. **Audit table migrations** for all three database adapters with the schema in 6.3.

2. **Database permissions configured**: app_user has INSERT only on `audit_log`; UPDATE on `audit_chain_state` only.

3. **Hash chain implementation** in `audit-builtin` adapter. Per-workspace chains with sequence + hash chain. Conformance tests for chain integrity, including stress tests with concurrent writes.

4. **AuditPort `write` and `writeBatch`** working end-to-end.

5. **AuditPort `query`** with all filter combinations, indexed for performance, scoped by workspace.

6. **AuditPort `verifyChain`** — full integrity verification. Performance: linear in chain length, target 1M events verified in < 30 seconds.

7. **Audit event taxonomy** documented in `audit-event-catalog.md`. CI check verifies all emitted event types are in the catalog.

8. **Personal data registry** populated based on existing schema (everything from Objectives 4 family, 5, 6).

9. **CI check** that flags PRs adding PII without registry updates.

10. **Retention enforcement job** with workspace-scoped cutoffs and legal hold support.

11. **Export functionality**: JSON Lines, CSV, CEF, LEEF formats; streaming for large exports; auditing of export operations.

12. **Cold archive (optional)** with B2 object lock integration.

13. **Data subject access service** — walks the registry, assembles export, delivers via time-limited URL.

14. **Erasure service** — soft-delete then hard-delete with anonymization for non-eraseable references.

15. **Auto-generated compliance documents** committed on merge to main.

16. **Manual compliance docs**: SOC 2, GDPR, HIPAA control matrices; threat model.

17. **Operational runbooks** in `docs/runbooks/`.

18. **ADRs.**

19. **Quarterly chain integrity drill** scheduled and executed at least once.

20. **Verify Definition of Done.**

---

## 8. ADRs to Write

- **ADR-0068: Hash-Chained Audit Log** — why per-workspace chains, why SHA-256, why tamper-evident not tamper-proof
- **ADR-0069: Append-Only Database Permissions** — defense in depth; what we give up; what we gain
- **ADR-0070: Audit vs. Application Logs** — clear separation; the test for which is which
- **ADR-0071: Personal Data Registry as Code** — why machine-readable; how it drives erasure and access
- **ADR-0072: Anonymization vs. Deletion** — which fields, why, the audit-continuity argument
- **ADR-0073: Retention Default of 7 Years** — rationale; configurability; legal-hold override
- **ADR-0074: Cold Archive as Optional** — why opt-in; complexity vs. tamper-proof property
- **ADR-0075: Compliance Documents as Living Artifacts** — auto-generated where possible; reviewed annually
- **ADR-0256: Platform Self-Scan as a CI Gate** — the platform's own supply chain is scanned with the same `VulnerabilityScannerPort` it ships to customers; criticals fail CI; quarterly SBOM published

---

## 9. Verification Steps

1. **Hash chain integrity** — write 1000 events to a test workspace; run verification; chain intact.

2. **Tamper detection** — manually modify an event in the database (using a privileged user); run verification; tampering detected at the modified sequence.

3. **Append-only enforcement** — connect as `app_user`; attempt UPDATE on audit_log; rejected by database permissions. Attempt DELETE; rejected.

4. **Concurrent writes don't corrupt** — write 1000 events concurrently to the same workspace; verify chain; intact and correctly sequenced.

5. **Cross-workspace independence** — write events to workspace A; verify A's chain; intact. Write to B; verify B's chain; intact. Verifications don't interfere.

6. **Query performance** — 1M events in a workspace; queries by time range, actor, resource all return in < 100ms p95.

7. **Audit event catalog completeness** — CI check runs against the codebase; all emitted event types are catalogued.

8. **Personal data registry completeness** — all PII columns in the database are listed; registry walk for a test user returns expected results.

9. **Data subject access export** — initiate for a test user; export contains all expected categories; PII redacted appropriately for fields marked as redactable.

10. **Erasure** — initiate erasure; user can no longer sign in; after grace period, PII fields are anonymized or deleted per registry; audit log still references the user id (now orphaned).

11. **Retention enforcement** — set a 1-day retention on a test workspace; let a day pass; old events are removed; the retention enforcement event appears.

12. **Legal hold** — set legal hold on a workspace; retention enforcement skips with audit note.

13. **Export formats** — produce exports in JSONL, CSV, CEF, LEEF; verify each is parseable by appropriate tools.

14. **Streaming export for large datasets** — export 1M events; memory usage stays bounded; stream completes.

15. **Workspace-scoped audit query** — a workspace member can query their workspace's audit; cannot query another workspace's; installation_auditor can query both.

16. **Audit access is itself audited** — querying audit logs produces an `audit.export.created` (or similar) event.

17. **Cold archive (when enabled)** — daily job uploads chunks; manifests are signed; verification of archived chunks against signature succeeds.

18. **Quarterly drill** — chain verification on production data executed; results documented; took less than expected time.

19. **Compliance documents auto-generated correctly** — personal-data-registry.md and audit-event-catalog.md are current.

20. **Manual compliance documents reviewed** — SOC 2 / GDPR / HIPAA control matrices reviewed within the last 12 months; threat model current.

21. **Platform self-scan in CI** — every PR runs Grype against `pnpm-lock.yaml` and the worker image; an injected critical CVE fails the run.

22. **Quarterly SBOM publication** — current SBOM (CycloneDX JSON) present in `docs/security/sbom/` and dated within the last 90 days.

If all 22 pass, the objective is met.

---

## 10. Definition of Done

**Audit Storage**

- [ ] `audit_log` table/collection migrations on all three adapters
- [ ] `audit_chain_state` migrations
- [ ] Database permissions enforce append-only on app_user
- [ ] Indexes for common query patterns
- [ ] Time-based partitioning configured (Postgres) with equivalent strategies on MSSQL/Mongo

**Hash Chain**

- [ ] Per-workspace chain implementation
- [ ] Concurrent-write safety tested
- [ ] `verifyChain` operation working
- [ ] Performance: 1M events verified in < 30s

**AuditPort**

- [ ] `write`, `writeBatch`, `query`, `exportStream`, `verifyChain` implemented
- [ ] `startDataSubjectExport`, `startErasureRequest` implemented
- [ ] Conformance tests pass on all three adapters

**Event Taxonomy**

- [ ] Catalog documented in `docs/compliance/audit-event-catalog.md`
- [ ] CI check enforces catalog completeness
- [ ] All existing events from earlier objectives migrated to the canonical event types

**Personal Data Registry**

- [ ] Registry populated for all existing PII locations
- [ ] CI check flags PRs adding PII without registry updates
- [ ] Registry drives access export and erasure

**Retention**

- [ ] Daily retention enforcement job
- [ ] Per-workspace configuration
- [ ] Legal hold override
- [ ] Retention enforcement is itself audited

**Cold Archive (optional)**

- [ ] Implementation exists (gated by config)
- [ ] Backblaze B2 with object lock
- [ ] Manifest signing and verification

**Data Subject Rights**

- [ ] Access request workflow end-to-end
- [ ] Erasure request workflow end-to-end with grace period
- [ ] Time-limited download URLs
- [ ] Audit events for both

**Export Formats**

- [ ] JSON Lines (default)
- [ ] CSV
- [ ] CEF
- [ ] LEEF
- [ ] Streaming for large datasets

**Compliance Documents**

- [ ] `personal-data-registry.md` auto-generated
- [ ] `audit-event-catalog.md` auto-generated
- [ ] `control-matrix-soc2.md` authored
- [ ] `control-matrix-gdpr.md` authored
- [ ] `control-matrix-hipaa.md` authored (or marked N/A with rationale)
- [ ] `threat-model.md` current

**Operational**

- [ ] All runbooks in Section 6.10 written
- [ ] Quarterly chain integrity drill executed at least once
- [ ] Restore drill includes audit log integrity verification

**Platform Self-Scan**

- [ ] CI workflow runs `VulnerabilityScannerPort` (Grype adapter) against `pnpm-lock.yaml` on every PR
- [ ] CI workflow scans the built worker container image
- [ ] Critical findings fail CI; high findings post a PR comment
- [ ] Quarterly job exports CycloneDX SBOM to `docs/security/sbom/` and commits it
- [ ] Self-scan results audited via `platform.scan.*` events

**Documentation**

- [ ] ADRs 0068–0075 written and Accepted
- [ ] ADR-0256 (platform self-scan) written and Accepted
- [ ] Configuration guide for retention and cold archive
- [ ] Customer-facing privacy notice template

**Verification**

- [ ] All 22 verification steps in Section 9 pass

---

## 11. Anti-Patterns to Refuse

- **Logging passwords, tokens, MFA codes in audit metadata.** Even hashed. The audit log is broadly readable; PII boundary applies.
- **Treating audit and application logs as interchangeable.** They go to different stores, have different retention, serve different audiences.
- **Allowing UPDATE on audit_log for any user.** Including the migration user, except via explicit retention enforcement which is itself audited.
- **Skipping the chain on "fast path" events.** Either an event is auditable (chain it) or it's not (don't audit it). No half-measures.
- **Forgetting to update the personal data registry when adding a column.** CI flags this; reviewers enforce it.
- **Auto-erasing audit events when a user requests erasure.** Audit is forensic record; references are anonymized, the events themselves stay.
- **Implementing "the user can edit their own audit log."** No.
- **Using floating-point timestamps in audit hashes.** Round-trip precision differences across databases would break verification. Timestamps are integers (epoch milliseconds).
- **Skipping the quarterly drill "because nothing has changed."** The drill verifies the verification still works. Verifying once and assuming it's still working is exactly how silent corruption survives.
- **Allowing audit configuration changes without auditing the change.** Meta-audit: changes to retention, cold archive, hash seeds are themselves audited.
- **Documenting "tamper-proof" without external archival.** Honest description: tamper-evident at the database, tamper-proof for archived chunks (when archival is enabled). Marketing copy should match.

---

## 12. Open Questions for Confirmation Before Starting

1. **Retention default of 7 years** — appropriate for the platform's primary audiences (small business, enterprise)? Some industries (healthcare, finance) require longer; some (e-commerce) shorter. Recommendation: 7 years default, 90 days minimum for installations that opt below the default.

2. **Cold archive opt-in vs. opt-out** — currently proposing opt-in. Some compliance regimes (financial services, certain healthcare) effectively require it. Recommendation: opt-in for AGPL self-hosted; tools to make it easy to enable.

3. **Data subject erasure grace period** — proposing 30 days. GDPR allows 30 days for response; the grace period delays actual deletion to allow for retraction. Acceptable?

4. **Legal hold mechanics** — proposing a workspace-level flag set by installation_admin. Some regimes require fine-grained "hold this user's data" or "hold this resource type's data." Defer that complexity until a customer needs it?

5. **Auto-generated compliance docs** — committed to the repo on merge to main. Acceptable that these get updated frequently in git history?

6. **Hash algorithm** — SHA-256 is the proposal. Some compliance regimes prefer SHA-3 or BLAKE3. Recommendation: SHA-256 default, configurable to SHA-3 if a customer demands; chain restarts on algorithm change.

---

## 13. What Comes Next

With Objective 7 complete, the platform has a complete, queryable, tamper-evident audit log; data subject rights are implemented; compliance documents exist; retention is enforced; and the personal data registry drives consistent handling everywhere.

**Objective 8: Service Layer Architecture** is next. It formalizes the patterns that have been emerging: RequestContext propagation, repository binding, audit emission, error handling. Codifies the conventions so every later feature objective follows the same patterns and the codebase doesn't fragment.

**Objective 9: Cross-Platform Runtime** follows — making the platform genuinely run on Windows Server (not just designed-for-Windows). Required for Microsoft house customers.

**Objective 10: Quality Gates Before Stage One** consolidates the foundation into a reviewable bundle: load tests, penetration tests, chaos drills, accessibility baselines, the full security checklist.

After Objective 10, the foundation is genuinely complete. The data management module begins, and Stage 1 of the AI build pipeline begins — both building on a foundation that an enterprise security review wouldn't reject.

---

_This document is the contract. Every checkbox in Section 10 must be true before moving on._
