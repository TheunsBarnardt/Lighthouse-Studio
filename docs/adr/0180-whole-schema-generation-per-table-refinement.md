# ADR-0180: Whole-Schema Generation, Per-Table Refinement

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 24 (Stage 4: Schema Synthesis)

## Context

Schema synthesis can be structured in multiple ways:
1. **Whole-schema in one prompt** — one large prompt produces all tables at once
2. **Per-table sequential prompts** — one prompt per entity, run in sequence
3. **Hybrid** — entity extraction first, then per-table generation with shared context

## Decision

Use a **hybrid approach**: entity extraction produces a structured entity list, then per-table generation runs for each entity with the full entity list and relationship context as input.

The orchestrator runs entity extraction once (to get the list), then runs table generation for each entity (to get columns, types, indexes), then relationship modeling once (to get FKs and junctions).

## Consequences

**Better:**
- Tables have natural cohesion; columns within a table are related and benefit from being generated together
- Each table generation receives relationship context so FK columns are naturally included
- The entity extraction step can be cached or reused for regenerations
- Individual table regeneration with feedback is a first-class operation

**Worse:**
- N+1 prompt calls (one extraction + one per entity + relationship modeling) adds latency for large schemas
- Tables generated independently might have inconsistencies (e.g., different conventions for status fields); the orchestrator prompt provides shared direction to mitigate this

**Neutral:**
- The relationship modeling prompt runs after all tables are generated, so it has the full set of table IDs and column names to reference

## Alternatives Considered

- **Single monolithic prompt** — rejected; context window limits restrict the number of tables; quality degrades with too many entities in one prompt
- **Column-level prompts** — rejected; columns within a table are interrelated; generating them independently produces incoherent column sets
