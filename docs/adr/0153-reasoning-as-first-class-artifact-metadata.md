# ADR-0153: Reasoning as First-Class Artifact Metadata

**Status:** Accepted
**Date:** 2026-05-06
**Objective:** 20 (AI Pipeline Foundation)

## Context

Every AI Build Pipeline stage produces an artifact — a PRD, architecture diagram, schema, server function, test suite, or deployment manifest. Today these artifacts are opaque: the output is present but the reasoning behind it is not. When a developer disagrees with a generated decision, they have no way to understand why the AI made it, what alternatives it considered, or what assumptions it relied on.

This creates compounding problems: developers can't efficiently review artifacts, mistakes can't be traced to their root cause, and the platform can't learn which reasoning patterns produce good outcomes versus bad ones. The reasoning behind an artifact is as important as the artifact itself.

## Decision

Every AI-generated artifact includes a `ReasoningRecord` stored in the artifact's `reasoning` JSON field. The `ReasoningRecord` structure is:

```typescript
interface ReasoningRecord {
  rationale: string; // Why this output, not alternatives
  alternatives_considered: Array<{
    option: string;
    reason_rejected: string;
  }>;
  assumptions: string[]; // What the model assumed true
  uncertainties: string[]; // What the model is not sure about
  source_artifacts: string[]; // IDs of upstream artifacts used as context
}
```

All `definePrompt` output schemas include `ReasoningRecordSchema` as a non-optional field. Prompts instruct the model to populate all five fields. The `ReasoningRecord` is stored inline in the artifact row's `reasoning` JSONB column (not in a separate table) for locality when reading the artifact.

A CI lint rule (ADR-0160) enforces that no artifact fixture, migration, or test can land without a populated `ReasoningRecord`. The field is non-optional at the TypeScript level — `reasoning?: ReasoningRecord` is rejected at PR review.

## Consequences

**Easier:**

- Developers reviewing a generated artifact can understand the rationale and evaluate the alternatives without re-running the prompt
- Post-mortem analysis of a wrong decision traces directly to the assumption or uncertainty that was incorrect
- The quality feedback loop (ADR-0158) can correlate specific reasoning patterns with downstream rejection rates
- The platform's teaching value is higher: a rejected artifact with reasoning is a learning document, not a dead end
- Audit requirements in regulated industries (financial services, healthcare) are simpler to satisfy with artifact-level reasoning records

**Harder:**

- Output tokens increase because the model must produce the `ReasoningRecord` in addition to the artifact content; this is accounted for in per-prompt token budgets
- Prompt engineering must consistently instruct the model to use all five fields; shallow reasoning (a one-line rationale, no alternatives) is technically valid but low quality; quality signals (ADR-0158) must track reasoning depth
- Models that do not support structured output (some local models via Ollama) require a fallback parsing strategy for the `ReasoningRecord` fields

**Alternatives Considered:**

- **Reasoning as a separate table:** Normalize `ReasoningRecord` into its own table joined to artifacts; rejected — adds a join on every artifact read; reasoning is always needed when the artifact is displayed; inline JSONB is sufficient and faster
- **Optional reasoning field:** Make `reasoning` nullable so it can be omitted; rejected — optional fields become empty fields in practice; the CI gate (ADR-0160) exists precisely because optional enforcement fails over time
- **Chain-of-thought as raw text, not structured:** Store the model's internal thinking as a free-text field; rejected — unstructured reasoning cannot be queried, aggregated for quality signals, or reliably parsed by the UI; the five-field structure is the minimum useful schema
