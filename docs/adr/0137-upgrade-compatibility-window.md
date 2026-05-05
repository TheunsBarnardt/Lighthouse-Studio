# ADR-0137: Upgrade Compatibility Window

**Status:** Accepted
**Date:** 2026-05-05
**Objective:** 9.5 — Platform Upgrade & Versioning

---

## Context

Self-hosted customers upgrade on their own schedule. Some may skip several versions before upgrading. Without a defined compatibility window, the platform must either:
a) Test every possible upgrade path (unbounded and impractical), or
b) Define a bounded set of paths it will guarantee.

## Decision

**Minor versions:** Customers may skip up to N-2 minor versions in a single upgrade. Upgrading from v1.0.0 to v1.2.0 is supported; from v1.0.0 to v1.3.0 is not.

**Major versions:** Customers must upgrade through each major in sequence. v1.x → v3.x requires a stop at v2.0.

The upgrade orchestrator enforces this by reading the latest `platform_versions` row and comparing it against the target version using the rules above. If a skip is too large, the orchestrator surfaces the next eligible intermediate version.

## Consequences

**Easier:**

- The migration test matrix is bounded: for each release, only test from N-1 and N-2, not all prior versions.
- CI can enforce this mechanically.

**Harder:**

- Customers on very old versions must perform multi-hop upgrades. Documentation must clearly describe the hop sequence.
- The orchestrator must suggest the next eligible version, not just error out.

**Alternatives rejected:**

- **Unbounded compatibility** (allow skipping any number of versions): The migration set is not designed or tested as a single squashed apply across many versions. Data reshaping across many migrations can accumulate in ways that aren't individually breaking but collectively unpredictable.
- **One-step-only** (always upgrade to the next version): Too burdensome for customers on a slow upgrade cadence.

---

_Decision made by: Theuns Barnardt, 2026-05-05_
