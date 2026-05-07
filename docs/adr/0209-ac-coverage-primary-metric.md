# ADR-0209: AC Coverage Is the Primary Test Quality Metric

**Status:** Accepted  
**Date:** 2026-05-07  
**Objective:** 28 (Test Generation)

## Context

Two natural metrics exist for test suite quality: code coverage (line/branch %) and AC coverage (% of acceptance criteria with at least one test). We must decide which to present as primary.

## Decision

**AC coverage is the primary metric.** Code coverage is secondary.

- The platform's goal is to verify business requirements; AC coverage measures that directly
- Code coverage is displayed and thresholds enforced (80% lines, 70% branches) but reported as a warning, not a blocker
- The primary KPI shown in dashboards and quality signals is `acsWithTests / totalAcs`

## Consequences

- Must-have ACs with no test are flagged as high-priority gaps in the review UI
- A 100% code coverage with 50% AC coverage is not a passing suite
- Regeneration suggestions prioritise uncovered must-ACs over code coverage gaps

## Alternatives Considered

- **Code coverage as primary**: familiar to developers but doesn't speak to business requirements; rejected
- **Equal weight**: confusing; forces users to reconcile two different signals; rejected
