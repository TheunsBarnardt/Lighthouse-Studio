# ADR-0072: Anonymization vs. Deletion for Data Subject Erasure

**Status:** Accepted
**Date:** 2026-05-02
**Deciders:** solo

## Context

GDPR Article 17 gives individuals the right to erasure ("right to be forgotten"). However, the right to erasure is not absolute — Article 17(3) lists exceptions, including compliance with legal obligations and establishment or defence of legal claims.

The platform's audit log presents the core tension:

- Audit events record that "user X (UUID abc-123) performed action Y." If we delete those events, the forensic record is destroyed.
- If we retain those events unchanged, we retain a link to the user's identity that they have asked us to remove.

The question: **when a user requests erasure, what do we do with the records that cannot be fully deleted?**

Beyond the audit log, the same tension exists for workspace membership records, which serve as access control history.

## Decision

For fields that cannot be deleted (documented in the personal data registry with `eraseable: false`), **retain the record but anonymize the user directory** so that the link between the UUID and the real identity is broken for readers without special access.

**Specific treatments:**

**`users.primary_email` and `users.display_name`:**
Replace with deterministic pseudonyms:

- Email: `deleted-user-{sha256(userId).substring(0, 12)}@platform.invalid`
- Display name: `Deleted User`

**`workspace_members.user_id`:**
The UUID is retained (audit records reference it); the `users` row is anonymized, severing the link to real identity.

**`audit_log.actor_id`, `audit_log.actor_email_snapshot`:**
Retained without modification. The `users` row anonymization means that a non-auditor querying the audit log sees a UUID that points to "Deleted User" in the user directory — not the original name or email.

An `installation_auditor` with direct database access could still see `actor_email_snapshot` (the email snapshotted at event time). This is the documented and accepted limitation: the forensic record is for forensics, and forensics sometimes means a privileged investigator can see historical identities.

**The balance:**

- For ordinary platform users and workspace members: the erasure request removes all recognizable identity information.
- For forensic investigators (installation_auditor role or direct database access): historical email snapshots in audit events are retained. This is documented as a known limitation in the threat model.
- The erasure completion event (`data.subject.erasure_completed`) records what was deleted, what was anonymized, and what was retained with justification — providing evidence of compliance.

**Grace period:** 30 days between soft-delete (immediate) and hard-delete/anonymization. This allows for retractions (user changed their mind; admin error).

## Consequences

### Positive

- Audit forensic integrity is preserved: the sequence of events and their hashes are unmodified.
- For non-privileged readers, the user's identity is gone after erasure.
- The approach is defensible under GDPR Article 17(3)(b) and (e): legal obligation and legal claims.
- The platform emits a complete erasure record for GDPR evidence purposes.

### Negative

- `actor_email_snapshot` in the audit log is retained. A privileged user can still see the historical email. This must be disclosed in the privacy notice and documented in the control matrices.
- Deterministic pseudonymization means that two deleted users do not collide (different hashes), but it also means that someone with the original UUID could, in theory, re-derive the pseudonym. Pseudonyms are for display, not for hiding the UUID.
- Installations in stricter jurisdictions (e.g., some interpretations of GDPR by certain national authorities) might require stronger anonymization of `actor_email_snapshot`. The platform provides a compliance configuration setting for more aggressive anonymization; it is not the default.

### Neutral

- The 30-day grace period matches GDPR's response window for data subject requests. Erasure requests received on day 1 and acted on day 30 still complete within GDPR's allowed window.
- Legal hold overrides the grace period. Erasure is paused until the hold is lifted, which is GDPR Article 17(3)(e) compliant.

## Alternatives Considered

### Option A: Delete all audit events referencing the user

Fully honors the erasure request. Rejected because it destroys the hash chain (breaking subsequent events' `prev_hash`) and eliminates forensic records that may be legally required under other obligations (SOX, HIPAA, CCPA fraud investigations). It is also a unilateral trade-off that we cannot make on behalf of customers — some customers are legally required to preserve audit records.

### Option B: Null out the user ID in audit events

Replace `actor_id` with NULL in all audit events. Would break the hash chain (same reason as Option A). Also less useful than anonymization: NULL says "we don't know who did this," which is worse for forensics than a consistent pseudonym.

### Option C: Retain everything with no anonymization

Document the retention as a privacy notice disclosure. Rejected as too weak a response to a formal erasure request; would not satisfy GDPR compliance officers or pass a DPIA in most circumstances.

## References

- [ADR-0071: Personal Data Registry as Code](./0071-personal-data-registry-as-code.md)
- [ADR-0068: Hash-Chained Audit Log](./0068-hash-chained-audit-log.md)
- `packages/core/src/services/data-subject.service.ts`
- `docs/compliance/personal-data-registry.md`
- `docs/runbooks/data-subject-erasure-request.md`
- GDPR Article 17(3) — exceptions to the right of erasure
