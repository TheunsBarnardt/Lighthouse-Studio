# ADR-0256: Platform Self-Scan as a CI Gate

**Status:** Proposed
**Date:** 2026-05-07
**Deciders:** solo

## Context

ADR-0254 establishes a pre-deploy CVE scan gate for **customer apps**. The platform's own supply chain — its `pnpm-lock.yaml`, its own container images, its vendored binaries — currently has no equivalent gate.

A platform that ships a security tool to customers but doesn't run it on itself is making a credibility claim it can't support. If Grype is good enough to gate customer deploys, it is good enough to gate the platform's CI.

## Decision

The platform's CI runs the same `VulnerabilityScannerPort` (Grype reference adapter) on every PR:

1. Scans `pnpm-lock.yaml` (SBOM derived from the lockfile).
2. Scans the built worker container image.

Severity policy in CI:

- `critical` findings against the platform's own dependencies **fail the run**.
- `high` findings post a PR comment listing the affected packages and the upgrade path.
- `medium`/`low` findings are summarized but do not gate the PR.

A quarterly job exports the platform's CycloneDX SBOM to `docs/security/sbom/<YYYY>-<QQ>.json` and commits it. This produces a public, auditable trail of the platform's supply chain over time.

Self-scan results are audited via a `platform.scan.*` event vocabulary distinct from the `deploy.scan.*` events used for customer apps.

## Consequences

### Positive

- The platform eats its own dog food. Customers see the same gate the platform itself respects.
- Public quarterly SBOMs give security-conscious customers concrete evidence rather than marketing claims.
- Incident response benefits from the historical SBOM record.

### Negative

- Critical findings can block PRs even when unrelated to the change. Mitigated by a documented "advisory exception" workflow: an exception is a separate, dated PR with explicit justification, expiring in 90 days.

### Neutral

- The CI scan reuses the customer-facing scanner adapter; no separate code path.

## Alternatives Considered

### Option A: GitHub Dependabot only

Pros: zero implementation work.
Cons: produces issues, not gates. Critical CVEs can land unnoticed if Dependabot issues are not triaged. And it is GitHub-specific — air-gapped contributors cannot rely on it.

### Option B: Run Snyk in CI

Pros: high-quality findings.
Cons: SaaS dependency in CI; license cost; inconsistent with the customer-facing scanner.

### Option C: No platform-side gate

Pros: zero work.
Cons: see Context. The platform's security claims become rhetorical.

## References

- ADR-0254 (customer-app CVE gate; same scanner)
- ADR-0253 (advisory ingestion source)
- Objective 7 (Audit & Compliance) — DoD includes platform self-scan and SBOM publication
