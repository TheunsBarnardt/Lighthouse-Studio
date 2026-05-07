# ADR-0199: Function Inventory First, Then Per-Function Generation

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 27 — Code Generation

## Context

AI code generation can produce sprawl — 50 functions when 5 suffice. A discipline is needed.

## Decision

Stage 7 has two steps: (1) inventory extraction (what functions are needed), (2) per-function generation. The inventory is a customer-reviewable artifact. Customers can add, remove, or merge functions before committing to generation. Functions infer from three sources: UI calls to non-auto-generated endpoints, PRD "the system should..." language, integration declarations.

## Consequences

- Generation budget is predictable before any code is written
- Customers prevent sprawl by pruning the inventory
- The inventory step costs ~$0.15 (haiku); full generation is ~$0.50/function (opus)

## Alternatives considered

- **Generate all at once without inventory** — no customer control; AI over-generates; hard to regenerate subsets
