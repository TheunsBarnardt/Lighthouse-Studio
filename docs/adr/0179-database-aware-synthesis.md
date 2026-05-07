# ADR-0179: Database-Aware Synthesis

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 24 (Stage 4: Schema Synthesis)

## Context

The platform supports Postgres, MSSQL, and MongoDB. The same PRD describes the same business domain but needs meaningfully different schemas depending on the database. Postgres can use array columns and JSONB; MSSQL cannot use array columns and needs junction tables instead; MongoDB uses embedded documents where Postgres would use a foreign key.

The question is whether to use a single database-agnostic prompt (and post-process for database differences) or database-specific prompts.

## Decision

Schema synthesis is **database-aware from the start**: the workspace's database driver constrains generation via the capability context. The table generation prompt receives the database driver and capability flags and produces appropriate schema structures.

The capability context includes: `arrayColumns`, `jsonColumns`, `foreignKeysEnforced`, `fullTextSearch`, `geospatial`, and the driver's reserved words and identifier length limits.

## Consequences

**Better:**
- Generated schemas are immediately usable without post-processing fixups
- The AI understands the tradeoffs (e.g., why MSSQL needs a junction table where Postgres could use an array) and includes this in reasoning
- Capability flags enable the same logic to handle future database additions

**Worse:**
- The table generation prompt must understand capability flags — it's a more complex prompt than one that produces "generic" SQL
- Testing requires validating synthesis quality across all three databases

**Neutral:**
- The capability context is drawn from Objective 4c's capability matrix (the same source used by the Schema Designer's validation)

## Alternatives Considered

- **Database-agnostic generation + post-processing** — rejected; post-processing is fragile for complex cases like many-to-many in MSSQL (needs junction table with its own columns); the AI handles these cases better with full context
- **Only support Postgres for synthesis** — rejected; multi-database is a platform differentiator; all three databases are first-class
