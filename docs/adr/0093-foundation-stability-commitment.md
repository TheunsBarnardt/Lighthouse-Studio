# ADR-0093: Foundation Stability Commitment

**Status:** Accepted
**Date:** 2026-05-03
**Deciders:** solo

## Context

The platform's foundation — the nine objectives completed before Objective 10 — establishes properties that feature work depends on:

- Authentication and authorization behavior
- Audit log chain integrity
- Workspace-scoped data isolation
- Performance SLO targets (p95 < 500ms, p99 < 2s, 99.5% availability)
- Cross-database behavioral equivalence (as declared by the capability matrix)
- Cross-platform runtime equivalence (Linux and Windows)
- Compliance posture claims (SOC 2, GDPR, HIPAA control matrices)

Feature work begins after Objective 10, building on top of these properties. If those properties regress silently, features built on top of them break in ways that are hard to attribute and expensive to fix. A security regression in RBAC doesn't just affect the RBAC layer — it affects every feature that relies on RBAC.

## Decision

The maintainer commits, formally, to the following **foundation stability properties**:

### 1. No silent regressions

Any change that could regress a verified foundation property requires running the relevant gate before merging. The relevant gates are:

| Change type                       | Gate to run                                   |
| --------------------------------- | --------------------------------------------- |
| Auth / authz / session code       | Penetration test (automated scanning minimum) |
| Audit log code                    | Chain integrity check                         |
| Persistence adapter               | Cross-database conformance suite              |
| Performance-critical path         | Load test smoke + baseline comparison         |
| UI changes to foundation pages    | Accessibility CI check                        |
| Infrastructure / deployment       | Cross-platform runtime test                   |
| Compliance document or data model | Personal data registry review                 |

### 2. CI enforces the critical properties

The following checks run on every PR and must pass for merge:

- Unit and integration tests (already enforced)
- `dependency-cruiser` boundaries (already enforced)
- axe-core accessibility on foundation pages (added in Objective 10)
- Load test smoke variant (a 60-second k6 run; not the full gate but enough to catch regressions) (added in Objective 10)
- Audit chain integrity check on test data (added in Objective 10)

### 3. Capability matrix is versioned

The capability matrix (`docs/quality/capability-matrix-<date>.md`) is updated whenever a capability changes. Removing or downgrading a declared capability is a breaking change: it requires a major version bump on the relevant adapter package and a documented rationale.

### 4. Quarterly drills continue indefinitely

Per ADR-0092, the chaos drill, chain integrity drill, and restore drill run quarterly. These are not discretionary. If a quarter passes without a drill, that is a process failure to be noted and remediated.

### 5. The Foundation Review Report is a living document

The Foundation Review Report at `docs/quality/foundation-review.md` is updated annually (or after any major infrastructure change) with refreshed gate evidence. The original is archived; it is not overwritten.

### 6. Deferred items are tracked and time-bounded

Any item accepted with a deferral at Objective 10 close (e.g., external pentest scheduled but not yet complete) has a GitHub issue with a target date. Target dates are not soft. If a target date slips, the slip is documented with a new target — not quietly extended.

## Consequences

### Positive

- Feature teams (future collaborators, the maintainer in future-objective headspace) can build on the foundation without re-verifying it each time.
- Customers get consistent behavior; the capability matrix tells them exactly what to expect.
- Security and compliance posture doesn't drift: CI catches most regressions; drills catch the rest.
- The discipline creates a credible audit trail for enterprise sales motions and compliance reviews.

### Negative

- The stability commitment means the foundation cannot be casually refactored without running the relevant gates. This adds friction to changes that touch foundation code.
- Capability matrix versioning adds overhead when adapters evolve.
- For a solo operator, quarterly drills are a discipline cost. They compete with feature work.

## What This Does NOT Commit To

- **Backwards compatibility of internal APIs.** The ports and adapters can be refactored; the stability commitment is about behavioral properties, not code-level API compatibility.
- **Freezing the capability matrix forever.** Capabilities can improve; they can never silently regress.
- **Preventing all bugs.** The commitment is to catch regressions before they compound, not to guarantee a bug-free foundation.

## Alternatives Considered

**No formal commitment; rely on "we'll be careful."** Rejected: informal commitments erode under delivery pressure. A written commitment with specific CI gates makes the promise executable, not aspirational.

**More restrictive stability guarantee (never change foundation code).** Rejected: the foundation will need to evolve. The goal is confidence in behavioral properties, not code freezing.
