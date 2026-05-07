# ADR-0186: Mandatory Pre-Migration Snapshot

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 25 — Stage 5: Data Migration

## Context

Data migrations are high-risk operations. If validation fails or the user regrets the migration, they need a rollback path. The question is whether to make snapshots mandatory or optional.

## Decision

A pre-migration snapshot of all affected target tables is mandatory before execution begins. No migration can start without a successful snapshot. The snapshot is retained for 24 hours (configurable up to 7 days). Rollback restores all affected tables from the snapshot.

## Consequences

- Users always have a rollback path within the retention window.
- Snapshot storage cost is bounded by the 24-hour default; workspaces can configure longer retention at higher cost.
- After the retention window, manual recovery requires a documented runbook.
- Greenfield migrations (empty target tables) still take a snapshot, but it's trivial (empty).

## Alternatives Considered

- **Optional snapshot**: rejected because users who skip it have no rollback. The cost of a mandatory snapshot is low relative to the risk of skipping it.
- **Indefinite retention**: rejected because storage costs accumulate; 24 hours covers the post-migration review window for most teams.
