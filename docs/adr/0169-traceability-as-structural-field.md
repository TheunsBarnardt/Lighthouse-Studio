# ADR-0169: Traceability as Structural Field

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 22 (Stage 2: PRD Generation)

## Context

Every requirement in a PRD should be traceable back to the intent brief that motivated it. Traceability serves two audiences: human reviewers who want to understand why a requirement exists, and downstream pipeline stages that need to understand the dependency chain from intent through requirements to schema, UI, and tests.

Traceability can be implemented in two ways. Implicit traceability is narrative: the requirement description mentions the goal it serves, and a human or NLP system can infer the connection. Explicit structural traceability is a typed reference field: `tracesTo: [{ type: 'intent_brief', artifactId: '...', fieldPath: 'goals.goal-3' }]`. The structural approach requires the generating AI to populate the field; the implicit approach requires no AI discipline but supports no automation.

The question is whether the additional structure is worth the cost: the AI must populate `tracesTo` fields accurately, the schema must define the reference format, and validation must check that references point to real artifacts. If the AI halluccinates `fieldPath` values that don't exist in the intent brief, the traceability data is misleading.

## Decision

Every requirement (FunctionalRequirement, NonFunctionalRequirement, GoalEntry, UserStory, PersonaEntry) carries a `tracesTo: TraceabilityRef[]` structural field. The `TraceabilityRef` type identifies the source artifact by ID and the specific field within it by dot-path.

```typescript
interface TraceabilityRef {
  type: 'intent_brief' | 'prd_section' | 'requirement';
  artifactId: string; // ID of the source artifact
  fieldPath: string; // e.g., "goals.goal-3", "target_users.persona-1"
}
```

The traceability-check prompt runs after all sections are generated. It verifies two things: (1) every intent goal has at least one requirement that traces to it, and (2) every `tracesTo` reference points to a real field in the referenced artifact. Gaps are reported in the `TraceabilityReport` and surfaced to the user.

## Rationale

1. **Audit trail.** A reviewer can inspect a requirement and immediately see which intent goals it addresses. This is more reliable than searching the narrative text for mentions.

2. **Coverage detection.** The traceability check can mechanically determine which intent goals have no supporting requirements — a gap that is easy to miss in a long PRD. Implicit traceability cannot support this check without NLP parsing.

3. **Downstream propagation.** Stage 4 (Schema) generates tables and columns that trace back through requirements to intent. Stage 6 (UI Generation) generates components that trace back to user stories. Stage 8 (Test Generation) generates tests that trace back to acceptance criteria. The full dependency chain is queryable only if each link is a typed reference, not a narrative mention.

4. **Queryable relationships.** The platform can answer questions like "which requirements trace to goal-3?" or "which intent fields have no coverage?" These queries are O(n) over structured fields and O(n) NLP inference over narrative text. The structural approach is faster and more reliable.

5. **Not reliant on NLP parsing.** Extracting traceability from narrative text requires NLP and produces uncertain results. Structural fields are deterministic: either the reference is present or it isn't.

## Consequences

**Easier:**

- Coverage analysis is mechanical: count `tracesTo` references per intent goal
- Dependency chain queries across the full pipeline are straightforward
- Downstream stages receive typed references, not free text
- The traceability matrix UI renders from structured data without parsing

**Harder:**

- The AI must populate `tracesTo` fields accurately; hallucinated field paths degrade traceability quality
- Traceability check must load and validate referenced artifacts (adds I/O to the check)
- If intent brief goals are renumbered or restructured, existing `tracesTo` references may become stale (staleness detection, ADR-0171, handles this)
- The `fieldPath` format must be stable and documented for AI prompt authors

**Alternatives considered:**

- **Implicit narrative traceability:** No schema changes, no AI discipline required; rejected because it cannot support automated coverage checks, downstream typed consumption, or pipeline-wide dependency queries.
- **Separate traceability matrix artifact:** The matrix lives outside requirements rather than inside them; rejected because requirements without embedded references are incomplete without the matrix. Embedded references are self-contained and survive partial exports.
