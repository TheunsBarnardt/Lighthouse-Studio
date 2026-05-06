# ADR-0158: Quality Signals as Continuous Improvement

**Status:** Accepted
**Date:** 2026-05-06
**Objective:** 20 (AI Pipeline Foundation)

## Context

The AI Build Pipeline generates artifacts that humans review and either accept, revise, or reject. Without recording the outcome of each artifact, the platform has no feedback signal: it cannot know which prompts consistently produce good first-pass output, which produce outputs that require heavy revision, and which produce outputs that are rejected entirely. This blinds the platform to quality regressions when prompts change and prevents evidence-based prompt improvement.

The signals needed are behavioral, not just correctness: how many edits did the developer make? How long did review take? Was the artifact accepted first time, or revised three times first? Did the artifact cause a downstream stage to fail? These are observable outcomes that don't require human rating; they are captured from normal developer workflow.

## Decision

After each artifact is finalized (accepted or rejected), a record is written to `artifact_quality_records`:

```
artifact_id, prompt_id, prompt_version, provider_id, model_id,
outcome (enum), revision_count, edit_distance, time_to_approval_seconds,
caused_downstream_issue (bool), workspace_id, created_at
```

`outcome` values: `accepted_first_pass`, `accepted_after_revisions`, `rejected`, `abandoned`.

`edit_distance` is the character-level edit distance between the generated artifact and the final accepted version, capped at a maximum for very large artifacts. `revision_count` is the count of save actions before acceptance. `caused_downstream_issue` is set to `true` if a later stage references this artifact and the stage fails with an error attributed to artifact content.

These records feed two consumers:

1. **Per-prompt dashboards** in the platform's admin UI: acceptance rate, average revision count, average edit distance, and downstream issue rate per prompt+version combination. Prompt authors use this to evaluate prompt changes.
2. **Anonymized aggregates** in the customer-facing AI usage UI: a workspace can see how their pipeline stages are performing — which stages tend to require the most revision — to inform their own process.

Quality records are never deleted on workspace data wipe; they are anonymized (workspace_id set to null, artifact_id zeroed) on workspace deletion to preserve aggregate validity.

## Consequences

**Easier:**

- Prompt changes can be evaluated against historical baselines: did the new prompt version reduce revision counts?
- Quality regressions are detectable before they are widespread: a prompt version with rising rejection rates triggers a dashboard alert
- The platform has objective evidence for which AI providers and models produce better first-pass output for each stage, enabling evidence-based default model selection
- Customers understand their own revision patterns without manual tracking

**Harder:**

- `edit_distance` computation on large artifacts is non-trivial; a background job computes it after acceptance rather than inline to avoid blocking the UX
- `caused_downstream_issue` attribution is heuristic; a stage failure may be caused by factors other than upstream artifact content; false positives in this field reduce signal quality; the heuristic must be documented in the dashboard UI
- Anonymization on workspace deletion requires careful implementation to avoid referential integrity errors; artifact_id zeroing must handle foreign key constraints gracefully

**Alternatives Considered:**

- **Explicit human ratings (thumbs up/down per artifact):** Ask developers to rate each artifact; rejected — rating fatigue is real; behavioral signals are more reliable than solicited ratings because they require no extra action from the developer and cannot be gamed
- **No quality tracking; rely on manual prompt evaluation:** Prompt authors manually assess quality when they have concerns; rejected — manual evaluation is episodic and doesn't catch slow-moving regressions; the platform will have thousands of artifacts per day at scale; automated signals are the only viable approach
- **Quality signals in a separate analytics service:** Pipe quality data to an external analytics platform (Mixpanel, Amplitude, etc.); rejected — the data is sensitive (it reflects customer pipeline performance); keeping it in-platform maintains privacy guarantees and avoids an external dependency for an internal product metric
