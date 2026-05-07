# ADR-0187: Three Tolerance Modes for Migration Errors

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 25 — Stage 5: Data Migration

## Context

During migration, some rows may fail transformation or insertion (bad data, type mismatches, FK violations). Different teams have different risk tolerances: some want to stop immediately on any error; some want to continue and fix bad rows later.

## Decision

Three tolerance modes, user-selectable per migration:

- **fail_on_first_error**: stops at the first failed row; partial batch rolled back.
- **fail_on_batch_error**: continues if individual rows fail but stops if a batch has > X% failures (default 5%). The threshold is configurable.
- **continue_with_error_log**: continues regardless; all failed rows logged to a downloadable report.

Default is `fail_on_batch_error` with 5% threshold — protects against systematic problems while tolerating occasional bad rows.

## Consequences

- Teams can choose the mode that matches their data quality expectations.
- `fail_on_first_error` is safest but stops at the first bad row — impractical for large migrations with known data quality issues.
- `continue_with_error_log` is most permissive and produces a downloadable report for post-migration cleanup.
- The execution worker implements all three; choosing a mode is a plan-level configuration.

## Alternatives Considered

- **Single mode**: too rigid; some migrations have deliberately messy source data.
- **Custom threshold without modes**: harder to understand; named modes communicate intent clearly.
