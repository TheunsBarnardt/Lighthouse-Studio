# ADR-0090: Quality Gates Before Stage One

**Status:** Accepted
**Date:** 2026-05-03
**Deciders:** solo

## Context

The platform's foundation spans nine objectives: infrastructure, persistence across three databases, identity/auth, RBAC, audit, compliance posture, service discipline, and cross-platform runtime. Each objective declared its own Definition of Done. Before feature work begins — the Data Management Module and the AI Build Pipeline — we need collective confidence that the foundation as a whole is solid under production conditions.

"Individually done" is not the same as "collectively ready." Hidden coupling, performance characteristics that only emerge under load, failure modes that only appear under chaos, and documentation gaps that only surface when someone tries to follow them — these cannot be found by reading objective checklists. They require execution against the real system.

## Decision

Before any Stage 1 or Data Management Module work begins, the foundation must pass **ten discrete quality gates**, each producing documented evidence:

1. **Load Test Gate** — k6 scripts; realistic load (100 sustained / 500 burst concurrent users); SLO targets verified on all three database adapters.
2. **Penetration Test Gate** — internal OWASP ASVS Level 2 (~150 controls) plus automated scanning. External pentest deferred to before first paying customer (see ADR-0091).
3. **Chaos Engineering Gate** — 13 scripted failure scenarios; every scenario ends in graceful recovery or safe failure with operator-actionable alerts.
4. **Accessibility Gate** — WCAG 2.2 AA on all foundation pages; axe-core in CI; manual screen-reader walkthrough.
5. **Backup & DR Drill** — five restore scenarios including full server loss; recovery within documented RTO/RPO.
6. **Cross-Database Conformance Final** — the conformance suite run as a snapshot; capability matrix locked as versioned artifact.
7. **Cross-Platform Runtime Final** — foundation test battery on Linux and Windows staging; no platform-specific failures.
8. **Documentation Completeness Review** — a reviewer who is not the maintainer walks every documentation checklist item.
9. **Compliance Posture Review** — a compliance-experienced reviewer verifies each control matrix claim has backing evidence.
10. **Foundation Review Report** — a signed document consolidating all gate evidence; the formal gate artifact.

All ten gates must pass. No waivers. Incomplete gates block feature work — not delay it, not run in parallel with it.

## Consequences

### Positive

- Feature work begins on a verified foundation, not an assumed one.
- Performance baselines established here become CI regressions going forward — regressions are caught before they compound.
- Security and compliance posture documented before customers appear — not scrambled together when the first enterprise customer asks for it.
- The Foundation Review Report is an artifact: useful for new team members, customer security reviews, auditors, and future-you.

### Negative

- This objective produces no user-visible features. It is pure investment.
- Gate runs take calendar time — especially the chaos drill (requires staging environment and human observation) and the DR drill.
- The external reviewer requirement (sign-off by a non-maintainer) introduces human coordination overhead.

## Alternatives Considered

**Ship feature work concurrently, run gates in the background.** Rejected: feature code accumulating on a flawed foundation costs 10x to fix later. The gates are cheap now; they are expensive after features are built.

**Reduce gate scope to save time.** Rejected: each gate exists because the failure mode it catches is real. Removing gates optimizes for speed while accepting unknown risk.

**Self-sign the Foundation Review Report.** Rejected: the maintainer is too close to the work to catch everything. The two-person rule for the foundation gate is the minimum viable independent check.
