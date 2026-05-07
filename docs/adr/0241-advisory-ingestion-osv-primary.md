# ADR-0241: Advisory Ingestion Uses OSV as Primary Source

**Status:** Proposed
**Date:** 2026-05-07
**Deciders:** solo

## Context

Objective 30 specifies that the platform consumes a `DependencyAdvisory` stream and can auto-draft change requests for critical CVEs. It does not specify where advisories come from. Without a defined source, the maintenance loop has no input.

Constraints:

- The platform must run self-hosted, including in air-gapped environments.
- No third-party SaaS dependency at runtime (consistent with the platform's no-vendor-lock posture).
- Coverage must extend to the package ecosystems the platform supports for generated apps (npm primarily; Python and container images for completeness).
- Deltas must arrive frequently enough that critical CVEs surface within hours.

## Decision

**[OSV.dev](https://osv.dev) is the primary advisory feed.** OSV is open data, vendor-neutral, covers npm/PyPI/Go/RubyGems/crates/Maven/NuGet/OSS-Fuzz/Linux distros/container images, and exposes a documented HTTP API (`https://api.osv.dev/v1/query`) plus a downloadable database snapshot for offline use.

**GitHub Security Advisories** is ingested as a secondary feed for advisories that are GHSA-only and not yet propagated into OSV.

A new `AdvisoryIngestionPort` (Objective 30) abstracts the feed. A reference adapter `adapter-advisory-osv` polls OSV on a cron (default hourly). A second adapter `adapter-advisory-github` polls the GHSA REST endpoint.

A workspace setting `advisoryFeeds[]` lists active feeds; air-gapped installs replace the default OSV URL with an internal mirror (which they sync via the OSV bulk download).

## Consequences

### Positive

- Deterministic, replayable advisory source. OSV records are stable and content-addressed.
- Air-gapped installs are first-class — sync the OSV snapshot internally; point `advisoryFeeds[]` at the mirror.
- No SaaS lock-in. OSV is a Google-maintained but open dataset; replacing it with a different feed is a matter of writing another adapter.
- Coverage of multiple ecosystems with one adapter.

### Negative

- OSV occasionally lags behind GHSA for advisories that originate at GitHub. The secondary GHSA feed mitigates this.
- Polling cadence introduces latency (default 1 hour). Configurable, but no push channel exists.

### Neutral

- The ingestion adapters produce normalized `DependencyAdvisory` records; the rest of the maintenance pipeline (Objective 30) is unchanged.

## Alternatives Considered

### Option A: Snyk / Sonatype / similar SaaS

Pros: high-quality curated data, push notifications.
Cons: SaaS dependency; per-customer licensing; air-gapped story is poor.

### Option B: GHSA only

Pros: simple; one feed.
Cons: GitHub-only; misses ecosystems where GHSA coverage is thin (Python, containers).

### Option C: NVD direct

Pros: authoritative.
Cons: NVD records are not packaged per ecosystem; mapping CVE → affected npm package is exactly what OSV does on top of NVD. Reimplementing is wasted work.

## References

- Objective 30 (Maintenance & Evolution) — DoD additions for advisory ingestion
- ADR-0224 (advisories don't auto-apply) — this ADR specifies the source; ADR-0224 governs what happens to them
- https://osv.dev — feed and schema
