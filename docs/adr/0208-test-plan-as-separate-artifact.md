# ADR-0208: Test Plan Is a Separate Artifact from Test Suite

**Status:** Accepted  
**Date:** 2026-05-07  
**Objective:** 28 (Test Generation)

## Context

Test generation involves two distinct steps: (1) mapping acceptance criteria to test cases and (2) generating actual test code. We must decide whether these are combined in one step or separated.

## Decision

The **test plan** (AC → test case mapping) is a distinct, persistable artifact separate from the test suite (actual test code files).

- `TestPlan` stores `testCases` (AC-to-test mapping) and `uncoveredAcs` (ACs that cannot be automated)
- `TestSuite` stores generated `TestFile` records referencing the plan
- Users review and edit the plan before generation begins

## Consequences

- Users can approve or modify the AC-to-test mapping before committing to code generation
- The plan is a human-readable record of test intent; test files may change but the plan persists
- Two-step UI: plan review tab → suite generation
- Plan can be regenerated without regenerating test code

## Alternatives Considered

- **Single step (plan + generate simultaneously)**: faster but removes the human review gate; rejected because AC mismatches are expensive to fix after code is generated
