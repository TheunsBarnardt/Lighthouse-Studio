# ADR-0169: Traceability as a Structural Field

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 22 (Stage 2: PRD Generation)

---

## Context

Every PRD requirement should trace back to the intent brief that motivated it. We could enforce this via convention (prose references) or as a structured field.

## Decision

Traceability is a **structural field** (`tracesTo: TraceabilityRef[]`) on every Functional Requirement, Non-Functional Requirement, Locked Decision, and Hard Part. Each `TraceabilityRef` contains `{ type, artifactId, fieldPath }` pointing to the specific intent brief field that motivated the item.

A dedicated traceability-check prompt verifies coverage after generation and flags intent goals without any corresponding PRD element.

## Consequences

**Positive:**
- Traceability is queryable: "which intent goals have no requirements?" is a runtime check
- Downstream stages can follow the chain: generated code → requirement → intent goal
- Intent changes that invalidate specific sections can be detected mechanically (staleness detection)

**Negative:**
- Prompts must populate tracesTo fields, adding complexity to generation
- The traceability check requires an extra LLM call after section generation

**Neutral:**
- The check is advisory: gaps produce warnings, not generation failures
