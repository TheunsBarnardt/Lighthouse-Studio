# ADR-0192: Per-Component Generation (Not Whole-App in One Shot)

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 26 — UI Generation

## Context

The pipeline must generate a full React application (~12 components). Two generation strategies were evaluated: one prompt that produces all files, or one prompt per component.

## Decision

Generate one component at a time. Each component prompt receives the IA, schema, design tokens, and the already-generated shared utilities. Components are generated in parallel where dependencies allow (leaf pages first, app shell last).

## Consequences

- Individual components can be regenerated without touching others
- Context window per prompt is smaller and more focused
- Generation can resume from a checkpoint if interrupted
- Total generation time is similar due to parallelism

## Alternatives considered

- **Whole-app in one shot** — exceeds context window for large schemas; no granular retry; any single failure regenerates everything
- **File-by-file with no parallelism** — correct but 3–4× slower
