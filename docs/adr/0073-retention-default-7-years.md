# ADR-0073: Retention Default of 7 Years for Audit Events

**Status:** Accepted
**Date:** 2026-05-02
**Deciders:** solo

## Context

Audit events accumulate indefinitely. Without a retention policy, the audit log grows without bound, eventually degrading query performance and creating an operational problem.

We need to decide:

1. What is the default retention period?
2. What is the minimum (floor) that an installation can configure?
3. What is the override mechanism for legal holds?

The platform targets enterprise customers across industries with different retention requirements:

- **Healthcare (HIPAA):** Requires medical records for 6 years from creation or last use; some states require longer.
- **Financial services (SOX, SEC Rule 17a-4):** 6-7 years for electronic records; some require non-erasable storage.
- **GDPR/general business:** No mandated audit retention minimum, but "storage limitation" principle requires documented justification for long retention.
- **Small business / startup:** Would prefer shorter retention to keep storage costs down.

## Decision

**Default retention: 7 years** for production installations.

**Minimum retention floor: 90 days** (configurable via installation-level setting; cannot be set lower).

**Dev/test installations:** Default 90 days, reflecting that dev environments don't need long retention.

**Per-workspace override:** Workspace owners can set a shorter retention than the installation default, but not shorter than the installation floor. (They cannot extend beyond the installation default without installation admin override.)

**Legal hold:** When a workspace has an active legal hold, retention enforcement is suspended for that workspace regardless of the configured period. Enforcement resumes when the hold is lifted.

**What retention governs:** The `audit_log` rows. Other data (user profiles, workspace data) has separate retention governed by the respective service's soft-delete → hard-delete logic.

**Rationale for 7 years:**

- Covers SOX (U.S. Sarbanes-Oxley) 7-year requirement for financial records
- Covers the general "6-7 year" expectation across most enterprise compliance regimes
- Slightly longer than strictly required by most mandates, providing a safety margin
- Comfortable for most enterprise security teams without being excessively long

## Consequences

### Positive

- A single default covers the most common enterprise compliance requirements without customer configuration.
- 7 years is conservative enough that most compliance officers accept it out of the box.
- Configurable: customers who need less (startup) or more (healthcare) can adjust.
- The 90-day floor prevents accidental misconfiguration to an indefensibly short period.

### Negative

- 7 years of audit events is a lot of data. A high-activity workspace with 1000 events/day accumulates ~2.5M events over 7 years. The database must be sized accordingly; documentation must set expectations.
- Time-based partitioning (PostgreSQL monthly partitions) mitigates query performance at the expense of some schema complexity.
- "7 years" as a human-readable string must be translated to an exact cutoff at enforcement time. The implementation uses "today minus 2555 days (7 × 365)" as the conservative floor.

### Neutral

- Cold archive (ADR-0074) allows customers to push older events to immutable object storage before they would be deleted by retention enforcement. This effectively extends the evidence window beyond 7 years for those who enable it.
- The 90-day minimum reflects our assessment that anything shorter creates compliance risk for customers who misconfigure retention without understanding the consequences. It is not a statutory requirement; it is a guardrail.

## Alternatives Considered

### Option A: Default to 90 days

Lower storage costs; matches common log retention defaults. Rejected because most enterprise compliance regimes require longer, and customers would immediately need to reconfigure. Starting from a conservative default is safer than starting from a short one.

### Option B: No default; require explicit configuration

Forces each customer to make an explicit choice. Rejected because most customers don't want to research retention requirements during installation; a reasonable default they can override is better UX and better compliance posture.

### Option C: 10 years

Would cover financial services' longest requirements. Rejected as unnecessarily long for the majority of customers, with significant storage implications. 7 years covers the main use cases; customers with longer requirements configure accordingly.

## References

- [ADR-0074: Cold Archive as Optional](./0074-cold-archive-as-optional.md)
- `packages/core/src/services/audit-retention.service.ts`
- `docs/runbooks/legal-hold.md`
- SOX Section 802 — 7-year electronic record retention
- SEC Rule 17a-4 — 6-year broker-dealer electronic records
- HIPAA 45 CFR § 164.316(b)(2)(i) — 6-year documentation retention
