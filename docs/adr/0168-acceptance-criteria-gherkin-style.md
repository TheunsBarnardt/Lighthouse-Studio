# ADR-0168: Acceptance Criteria in Gherkin-Influenced Format

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 22 (Stage 2: PRD Generation)

---

## Context

Every functional requirement must have acceptance criteria. We must decide the format: free-form bullet points vs. structured Gherkin-style Given/When/Then.

## Decision

Acceptance criteria use a **Gherkin-influenced format**: `{ given, when, then }` as structured fields. Each functional requirement carries at least one criterion; non-functional requirements use a metric-based format `{ metric, threshold, measurement }`.

## Consequences

**Positive:**
- Criteria are machine-readable — Stage 8 (Test Generation) consumes them as test seeds without text parsing
- Criteria are unambiguous — "Given a logged-out user, When they access /dashboard, Then they are redirected to /login" is testable
- QA testers can verify criteria manually without reading generated tests

**Negative:**
- Gherkin is more verbose than bullet points; prompts must produce more structured output
- Non-functional criteria don't map cleanly to Given/When/Then; they use a separate metric format

**Neutral:**
- The format is embedded in the FunctionalRequirement TypeScript type; generation and editing both enforce it
