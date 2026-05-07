# ADR-0194: Accessibility Validation During Generation (axe-core, One Retry)

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 26 — UI Generation

## Context

Generated components must meet WCAG 2.1 AA. Accessibility could be validated post-export (customer responsibility) or as part of the generation loop.

## Decision

Accessibility is validated as part of the generation pipeline using axe-core in a headless Playwright browser. If violations are found, the pipeline issues one automatic retry using a focused fix prompt (the `accessibility-fix` prompt, claude-haiku). If violations persist after the retry, the component is marked with a warning and generation continues.

## Consequences

- Most common violations (missing alt text, unlabelled inputs) are fixed automatically
- Generation does not fail hard on a11y issues; customers are informed
- Cost: ~$0.002 per retry (haiku, small prompt)
- In development mode, heuristic source analysis replaces the Playwright run

## Alternatives considered

- **Post-export validation only** — shifts burden to customer; violations often discovered too late
- **Hard failure on any violation** — too brittle; some violations require visual context to resolve
- **Multiple retries** — diminishing returns after one; increases cost and latency
