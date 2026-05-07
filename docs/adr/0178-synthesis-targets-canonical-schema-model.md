# ADR-0178: Synthesis Targets the Canonical Schema Model

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 24 (Stage 4: Schema Synthesis)

## Context

The schema synthesis stage produces a database schema from an approved PRD. The output needs to be reviewable and editable by the user. There are two approaches:

1. **Generate SQL DDL directly** — output raw CREATE TABLE statements; user edits in a SQL editor
2. **Generate to the platform's canonical schema model** — output a `SynthesizedSchema` that maps to Objective 11's `CustomerSchema`; user reviews in the Schema Designer

## Decision

Schema synthesis outputs to the **platform's canonical `SynthesizedSchema` model**, which maps to Objective 11's `CustomerSchema`. The user reviews and edits through the Schema Designer (Objective 11's UI).

The AI-generated schema is loaded as a draft into the Schema Designer. From the user's perspective, they navigate to the Schema Designer as usual; the schema just already exists as a draft. AI-specific panels (reasoning, PII confirmation, coverage warnings) appear as additions to the existing Schema Designer UI.

## Consequences

**Better:**
- The user works with familiar, high-quality tooling; no parallel AI-specific review UI to build
- The Schema Designer's validation, type-checking, and migration flow applies to AI-generated schemas without extra work
- AI-generated schemas get the same deployment path as hand-authored schemas — no special "auto-deploy" privilege

**Worse:**
- The synthesis must produce output that conforms to the existing schema model; the schema model becomes a constraint on AI output
- The integration between synthesis and Schema Designer requires schema import plumbing

**Neutral:**
- The synthesis artifact (`SynthesizedSchema`) holds additional metadata (reasoning, PII detections, coverage report) that the base schema model doesn't; these live in the synthesis artifact as overlays, not in the schema itself

## Alternatives Considered

- **SQL DDL output** — rejected; DDL is database-specific and opaque for non-developers; Schema Designer provides a vastly better review experience
- **Custom AI schema review UI** — rejected; duplicates the Schema Designer; creates divergence in the review flow for AI vs. hand-authored schemas
