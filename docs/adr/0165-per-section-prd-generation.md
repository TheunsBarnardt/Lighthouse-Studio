# ADR-0165: Per-Section Generation, Not Whole-Document

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 22 (Stage 2: PRD Generation)

---

## Context

A PRD is a long, structured document. We must decide whether to generate it in a single LLM call or split it into per-section calls.

## Decision

Generate each PRD section with its **own dedicated prompt**. The orchestrator runs sections in topological dependency order; sections with no dependencies run first; downstream sections receive prior outputs as inputs.

## Consequences

**Positive:**
- Focused prompts produce better output than a single sprawling prompt
- Each section is independently testable and refinable without regenerating others
- Section-level approval routing matches real review workflows
- Failures in one section do not invalidate the others

**Negative:**
- More prompts to maintain (one per section)
- Total wall-clock time is bounded by the longest dependency path through the graph

**Neutral:**
- The orchestrator prompt determines generation order; sections without dependencies run in parallel when resources allow
