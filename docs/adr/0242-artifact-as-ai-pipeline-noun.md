# ADR-0242: Artifact as the AI Pipeline Noun

**Status:** Accepted
**Date:** 2026-05-06
**Objective:** 20 (AI Pipeline Foundation)

---

## Context

The AI Build Pipeline produces structured documents at each stage: intent briefs, PRDs, BRDs, design tokens, prototypes, server functions, test suites. These documents need: versioning, approval workflows, parent-child lineage (brief → PRD → code), quality signals, audit history, and cross-stage queries. A different database table per stage type would replicate this plumbing 10+ times.

---

## Decision

All AI pipeline documents are stored as `Artifact<TContent>` records in the `ai_artifacts` table. An artifact has:

- `stage` — which pipeline stage produced it (`intent_capture`, `prd`, `design`, etc.)
- `type` — fine-grained type within the stage (`intent_brief`, `intent_conversation`, etc.)
- `status` — lifecycle state (`draft | in_review | approved | rejected | superseded`)
- `content: JSONB` — stage-specific structured content
- `parent_artifact_ids / child_artifact_ids` — lineage graph
- `quality_signals: JSONB` — accumulated signals (edit count, confidence at generation, etc.)
- `generated_by: JSONB` — which prompt + model + provider produced it
- `_version` — optimistic lock for concurrent edits
- `approval_id` — link to the approval workflow record

The `ArtifactRepositoryPort` in `packages/ports/ai-artifacts/` provides typed CRUD. The TypeScript generic `Artifact<TContent>` enforces content schema at the service layer.

---

## Consequences

**What becomes easier:**

- New stages add rows, not tables; the approval, audit, and lineage infrastructure is inherited.
- Cross-stage queries ("show all artifacts for workspace X awaiting approval") are single-table queries.
- The lineage graph (brief → PRD → code) is queryable without joins across multiple schema tables.

**What becomes harder:**

- JSONB content means no SQL-level column constraints on stage-specific fields; validation happens in the service layer via Zod.
- Schema changes to content shapes require careful Zod migration — there's no ALTER TABLE to enforce it.

---

## Alternatives Considered

- **One table per stage:** Rejected — 10+ tables with identical versioning/approval plumbing, each needing its own migration and repo adapter.
- **Generic "document" concept in existing schema tables:** Rejected — conflates AI pipeline documents with user-managed schema objects; different lifecycle and permissions.
- **Event sourcing (store only deltas):** Rejected — overkill for v1; current version + audit log provides sufficient history.
