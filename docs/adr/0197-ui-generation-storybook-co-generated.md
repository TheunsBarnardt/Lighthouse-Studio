# ADR-0197: Storybook Stories Co-Generated with Components

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 26 — UI Generation

## Context

Each generated component needs documentation, visual reference, and a test harness. These can be written after generation (manual step) or co-generated alongside the component.

## Decision

A Storybook story file (`<Component>.stories.tsx`) is co-generated for every component using the `storybook-story` prompt immediately after the component passes TypeScript and accessibility validation. Stories use CSF3 format with mock SDK responses (no real backend required).

The story is included in the exported project and appears in the project tree alongside its component.

## Consequences

- Customers get visual documentation and a test harness for free
- Stories serve as regression tests in the customer's CI (via Storybook test runner)
- Co-generation adds ~$0.003 per component (haiku prompt)
- Mock SDK in stories must be updated by the customer if the schema changes

## Alternatives considered

- **Manual story authoring** — saves generation cost but customers rarely write stories; documentation gap
- **Chromatic integration** — deferred to Objective 31; out of scope here
