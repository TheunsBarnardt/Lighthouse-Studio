# ADR-0184: One-Shot Migration, Not Continuous Sync

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 25 — Stage 5: Data Migration

## Context

Customers rebuilding legacy systems or migrating from competing platforms need to move existing data to their new schema. The question is whether Stage 5 should support one-shot migrations only, or also support ongoing CDC-style replication.

## Decision

Stage 5 implements one-shot data migration only. Continuous sync and CDC are out of scope for this stage.

## Consequences

- **Simpler execution model**: no long-lived source connections, no binlog tailing, no conflict resolution for ongoing changes.
- **Clear completion boundary**: migration has a definite end state; validation is meaningful at that point.
- **Rollback is practical**: a 24-hour snapshot window is feasible for one-shot migrations; it's not for continuous sync.
- **Source credentials are short-lived**: read-only credentials are used for the duration of the migration, then discarded.
- Customers needing ongoing replication must use a dedicated ETL/CDC product for now.

## Alternatives Considered

- **CDC pipeline**: rejected because it requires binlog access (not always available), conflict resolution logic, and a long-lived source connection — all complexity better handled by a dedicated product.
- **Periodic batch sync**: rejected because it blurs the line between migration and integration, complicating the data ownership model.
