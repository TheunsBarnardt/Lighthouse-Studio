# ADR-0196: Components Remain Editable After Approval

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 26 — UI Generation

## Context

Once a customer approves a component, they may still want to tweak it. Two options: approval is a terminal state requiring regeneration to change, or approval is a soft flag that can be rescinded.

## Decision

Approval is a soft flag. Customers can rescind approval and regenerate or manually edit any component at any time before export. After export, the project is an independent codebase; no platform tracking applies.

The `UiProjectArtifact.status` field reflects the most recent approval decision. Re-generating a previously approved component resets it to `draft`.

## Consequences

- Customers are not locked in; mistakes are recoverable
- "Approve All" is a convenience shortcut, not an irreversible action
- The approved count shown in the UI updates dynamically

## Alternatives considered

- **Terminal approval** — creates pressure to review thoroughly before approving; acceptable for regulated environments but adds friction for exploratory use
