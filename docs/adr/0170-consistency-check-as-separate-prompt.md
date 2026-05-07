# ADR-0170: Consistency Check as a Separate Prompt

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 22 (Stage 2: PRD Generation)

---

## Context

Per-section generation can produce contradictions across sections (e.g., a feature in Scope but refused in Anti-Patterns). We must decide when and how to detect these.

## Decision

Run a **dedicated consistency-check prompt** after all 13 sections are drafted. It receives the full PRD as input and outputs a list of issues with severity (`error` or `warning`) and suggested resolutions. Issues are surfaced as warnings in the UI; they do not block approval.

## Consequences

**Positive:**
- Contradictions are caught before the user starts approving sections
- A single prompt with full context is better at spotting cross-section contradictions than trying to detect them during generation
- Non-blocking warnings keep the workflow moving; the user resolves or dismisses

**Negative:**
- One additional LLM call per PRD after generation completes
- The check cannot prevent contradictions from being introduced when sections are edited post-generation; it must be re-run manually

**Neutral:**
- The check is advisory — users can proceed with known warnings if they judge the contradiction acceptable
