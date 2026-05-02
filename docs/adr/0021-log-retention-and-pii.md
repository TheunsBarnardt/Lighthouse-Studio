# ADR-0021: Log Retention and PII Handling

**Status:** Accepted
**Date:** 2026-05-02
**Deciders:** solo

## Context

Application logs contain operational signals (errors, latencies, throughput) but may incidentally contain user-identifiable information (email addresses, names, IP addresses, tokens). Retaining logs indefinitely creates a data liability; deleting them too quickly removes forensic capability.

Compliance requirements vary by deployment: EU deployments need GDPR-compliant handling; regulated industries need retention for years. The platform must support a range of deployments with a sensible default.

Two separate systems capture "what happened": application logs (this ADR) and the audit log (Objective 7, ADR TBD). They serve different purposes: application logs are for debugging; the audit log is for compliance and accountability. This ADR concerns only application logs.

## Decision

**Retention:**

- Hot storage (Loki): 14 days. Indexed and instantly queryable.
- Cold archive: 90 days. Compressed Parquet files in S3-compatible storage (Backblaze B2). Loki's compactor handles the transition. Cold logs are queryable but with higher latency.
- Production compliance override: configurable `LOKI_RETENTION_PERIOD` for deployments needing longer retention.

**PII redaction at write time:**

The Pino adapter redacts the following keys from all log context before writing to stdout:
`password`, `token`, `secret`, `authorization`, `cookie`, `apiKey`, `api_key`,
`req.headers.authorization`, `req.headers.cookie`

Redaction is done by Pino's built-in `redact` option with the value `[REDACTED]`. This is a hard code-level control, not configuration, so it cannot be accidentally disabled.

**Additional PII controls:**

- User email addresses are never logged by application code (only user IDs).
- If an email must appear in a log for debugging, the logger's `info` call must be approved in code review.
- The Sentry `beforeSend` hook strips PII from error reports before they reach GlitchTip.

**Audit log is separate:**
The audit log (Objective 7) captures who-did-what for compliance. It has different retention rules (typically years, encrypted, hash-chained). Application logs and audit logs are never confused.

## Consequences

### Positive

- 14-day hot storage covers the majority of incident forensics scenarios (most incidents are discovered within days).
- Redaction at write time means PII never enters Loki or any downstream system.
- Configurable retention covers regulated-industry requirements without baking a long retention period into all deployments.

### Negative

- 90-day cold archive requires an S3-compatible endpoint and adds operational complexity (the platform's backup infrastructure can serve this role, but it must be configured).
- If a key that should be redacted is missed, it enters Loki and must be manually purged (Loki supports deletion by label but it's operationally painful).

### Neutral

- Pino's redaction uses path-based matching, not content scanning. Accidental PII in non-standard keys is not redacted; log discipline is required from developers.

## Alternatives Considered

### Option A: No Structured Retention — Delete on Disk Full

Simple, but not compliant and unreliable for forensics.

### Option B: Redact in the OTel Collector (Not at Write Time)

Possible via OTel processor transformations. But it means PII travels through the network before being redacted. Rejected; redact at the closest point to the source.

## References

- Objective 3 (Observability Foundation)
- Objective 7 (Audit and Compliance) — audit log is separate
- GDPR Article 5 (data minimisation principle)
