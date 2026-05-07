# ADR-0193: Information Architecture as a Separate Artifact

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 26 — UI Generation

## Context

Before generating components, the pipeline must decide what pages exist, how navigation is structured, and which components each page contains. This could be embedded in the first component prompt or extracted as its own artifact.

## Decision

The Information Architecture (IA) is generated as a dedicated artifact before any component generation begins. The IA artifact contains: page list, page types (list/detail/form/dashboard/auth), navigation structure, component decomposition, and auth requirements.

The IA is persisted separately and can be revised by the customer before committing to full generation.

## Consequences

- Customers can review and adjust structure before spending generation budget
- Component prompts receive a stable, validated IA as input
- IA can be regenerated independently of components
- Clear audit trail: IA version is recorded alongside each component

## Alternatives considered

- **Inline IA** — faster but no customer review step; structure errors propagate to all components
