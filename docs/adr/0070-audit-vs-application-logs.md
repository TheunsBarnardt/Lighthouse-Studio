# ADR-0070: Audit Events vs. Application Logs — Separation of Concerns

**Status:** Accepted
**Date:** 2026-05-02
**Deciders:** solo

## Context

The platform has two distinct logging systems:

1. **Audit events** — written via `AuditPort`; stored in the `audit_log` table; hash-chained; append-only; retained for 7 years by default.
2. **Application logs** — written via `LoggerPort`; emitted as structured JSON to stdout/stderr; collected by the observability stack (Loki/OpenTelemetry); retained for 30-90 days.

In practice, these systems are often confused. Developers ask: "should I log this or audit this?" The decision has real consequences:

- Putting state-change events in application logs makes them transient and hard to query by compliance auditors.
- Putting debug information in audit events inflates audit storage, degrades query performance, and potentially exposes operational details to workspace auditors who should only see business events.

The platform needs a clear, enforced boundary between the two.

## Decision

**The test for audit vs. log:**

> If this event were missing from the database tomorrow, would compliance, legal, or a security investigation care? If yes: audit event. If only developers and SREs care: application log.

**Audit events capture state changes:**

- "User X signed in from IP Y"
- "Workspace member Z was given role R"
- "Configuration field F was changed from V1 to V2"
- "Authorization was denied for action A"

**Application logs capture execution:**

- "Processing request X, decision was Y because of Z"
- "Cache miss for key K"
- "Database query took 450ms"
- "External identity provider returned claims: {...}"

**Rules:**

1. Audit events use `AuditPort.write()` or `writeBatch()`. They are never written to the application log.
2. Application logs use `LoggerPort`. They are never written to the audit log.
3. Correlation IDs link application logs to audit events for the same request. The same `correlationId` appears in both.
4. Audit events are not written for successful read-only operations (except in elevated audit mode for HIPAA or similar).
5. Authorization denials are always audited. Authorization grants are logged at debug level, not audited.

**What triggers an audit event:**

- Any operation with `outcome: 'denied'`
- Any state-changing operation with `outcome: 'success'` or `outcome: 'failure'`
- System configuration changes
- Retention enforcement runs
- Data subject access and erasure requests
- Security-relevant events: sign-in, sign-out, password change, MFA enrollment/disable, session revocation

**What is not audited (only logged):**

- Successful read operations in default audit mode
- Internal cache operations
- Routine health checks and heartbeats
- Database query performance details

## Consequences

### Positive

- Compliance auditors get a clean, queryable audit log focused on business-level state changes.
- Application logs remain developer-focused without compliance noise.
- Audit storage stays bounded and performant; not polluted with debug chatter.
- The `correlationId` field links the two systems when cross-referencing is needed.

### Negative

- Developers must make an active decision for each logged item: is this audit or log? This requires judgment, not just code.
- Some events are ambiguous: "user viewed a resource" is a read in normal use, but in HIPAA context it's auditable. The elevated audit mode handles this, but developers must understand that the mode can elevate reads to audit events.

### Neutral

- The distinction is enforced by code review, not by technical barriers. A developer could call `LoggerPort` for an audit event and the CI would not catch it. Education and code review are the enforcement mechanism.
- The audit event catalog (`docs/compliance/audit-event-catalog.md`) enumerates every audit event type. A CI check verifies that all emitted event types are in the catalog — this catches audit events written with unregistered event types, but does not catch audit-worthy events written to the application log instead.

## Alternatives Considered

### Option A: Single unified log for both audit and application events

Simpler for developers; one place to write everything. Rejected because it conflates two fundamentally different systems: a 7-year forensic record and a 30-day debugging aid. The retention, access control, query semantics, and storage requirements are incompatible.

### Option B: Derive audit events from application logs automatically

Instrument the service layer to auto-generate audit events from log output. Rejected because the mapping from log messages to audit semantics is fragile, error-prone, and produces poor audit quality. Audit events should be intentionally authored; they're too important to derive heuristically.

## References

- [ADR-0068: Hash-Chained Audit Log](./0068-hash-chained-audit-log.md)
- [ADR-0019: OpenTelemetry as Standard](./0019-opentelemetry-as-standard.md)
- [ADR-0021: Log Retention and PII](./0021-log-retention-and-pii.md)
- `packages/ports/audit/src/audit.port.ts`
- `packages/core/src/compliance/audit-events.ts` — event catalog constants
- `docs/compliance/audit-event-catalog.md`
