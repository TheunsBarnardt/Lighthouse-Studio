# ADR-0212: Test Execution Is Async Fire-and-Forget

**Status:** Accepted  
**Date:** 2026-05-07  
**Objective:** 28 (Test Generation)

## Context

Running a full test suite (unit + integration + e2e) can take minutes. The API call to start a run must not block until completion.

## Decision

`runTests()` creates a `TestRun` record with `status: 'running'` and immediately returns `ok(run)`. The actual execution runs in a detached async block (`this._executeTestRun(...).catch(...)`). Clients poll `getTestRun(runId)` for status updates.

## Consequences

- `runTests()` always returns quickly with the initial run record
- UI polls for status every 5 seconds
- If the server process crashes during a run, the run remains stuck in `running`; a background cleanup job (cron) ages these out to `failed` after 30 minutes
- Failures during execution are written to the run record and audit log

## Alternatives Considered

- **Synchronous execution (blocking)**: would time out for large suites; rejected
- **Separate worker queue**: correct long-term but over-engineered for v1; deferred
