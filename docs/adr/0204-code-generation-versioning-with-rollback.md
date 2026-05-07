# ADR-0204: Every Function Version Preserved; Rollback is a Single Action

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 27 — Code Generation

## Context

Generated code will have bugs. Customers need to recover quickly without engineering effort.

## Decision

Every generation or regeneration creates a new version. Old versions are preserved indefinitely. The deployed version is always tracked. Rollback creates a new version with the content of the selected prior version — it doesn't delete the current version.

Rollbacks are audit-tracked with: who rolled back, from which version, to which version, at what time.

## Consequences

- Recovery from bad deployments is a single click
- Customers can compare versions via the version history panel
- Storage overhead is minimal (source code is small)

## Alternatives considered

- **Overwrite in place** — no rollback capability; unacceptable given generated code quality variance
- **Git-based versioning** — too heavyweight for v1; internal versioning with potential Git export later
