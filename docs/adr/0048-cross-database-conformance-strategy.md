---
adr: 0048
title: Cross-Database Conformance — Shared Test Suite, Per-Adapter CI Matrix
status: Accepted
date: 2026-05-02
deciders: Theuns Barnardt
---

## Context

Three persistence adapters must behave identically on all shared operations. The failure mode is: a bug is fixed in the Postgres adapter but the MSSQL adapter has the same bug, undetected for months.

## Decision

**Single conformance suite, three test runners**: The conformance tests in `packages/ports/persistence/src/conformance/` are database-agnostic. Each adapter package runs this suite against its own database in CI.

**CI matrix scheduling**:

- PRs touching `persistence-*` packages: run all three adapters
- PRs touching other packages: run Postgres + MSSQL only (Mongo on nightly)
- Nightly: full matrix including Mongo and change stream adapters

**Capability flags**: Each adapter declares what it supports via `supports(feature)`. Conformance tests skip capability-flagged features when the adapter doesn't support them. The skip is recorded in the conformance score denominator (honest accounting).

**Drift detection**: The capability matrix report is auto-generated on every merge to master and committed as a doc artifact. Reviewers can see exactly what changed between adapters.

## Consequences

- Bugs that exist in one adapter but not another become visible when the conformance suite is added for that adapter
- Adding a new port method requires updating all three adapter conformance tests
- The per-adapter CI matrix adds ~5-10 minutes to PR builds when persistence code changes
- Capability matrix is always current (generated, not hand-maintained)

## Alternatives considered

- **Separate test suites per adapter**: High duplication; divergence is harder to spot
- **A single shared test database (all adapters, same CI job)**: Simpler CI but serial execution; slower; masks adapter-specific issues
- **Property-based testing only**: `fast-check` generates adversarial inputs well; combined with the hand-written conformance suite for explicit behavioral contracts
