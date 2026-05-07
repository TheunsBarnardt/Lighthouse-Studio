# ADR-0248: Orchestrator + Sub-Prompts Pattern

**Status:** Accepted
**Date:** 2026-05-06
**Objective:** 21 (Intent Capture)

---

## Context

Intent capture requires multiple AI operations per conversation turn: generating a conversational response, extracting goals, identifying users, clarifying scope, surfacing assumptions, detecting readiness, and finalizing the brief. Doing all of this in a single prompt produces a massive context window, reduces accuracy on each subtask, and makes prompt testing brittle (one failing subtask fails the whole call).

---

## Decision

The intent capture AI layer uses an orchestrator + sub-prompts pattern:

- **`orchestrator.prompt.ts`** handles the conversational response for each user turn. It has access to the full conversation history and the current `BriefDraft`. It produces: `response` (what the AI says to the user), `briefUpdates` (structured delta to apply to the draft), and `readyToGenerate` flag. Temperature: 0.3 (conversational).

- **Sub-prompts** (extract-goals, identify-users, clarify-scope, surface-assumptions, detect-gaps, finalize-brief) are focused single-purpose prompts. Each sees only the conversation history and relevant context. Temperature: 0.2 (extraction). Each has its own Zod input/output schema and golden test suite.

- **`IntentCaptureService.sendMessage()`** calls only the orchestrator for each turn. Sub-prompts are invoked on-demand: `generateBrief()` calls `finalize-brief`; the orchestrator's `briefUpdates` are applied directly without a separate extraction call per turn (the orchestrator extracts inline).

This avoids a "prompt cascade" (calling all sub-prompts on every turn) in favor of lazy extraction and a single conversational loop.

---

## Consequences

**What becomes easier:**

- Each sub-prompt is independently testable with golden inputs.
- The orchestrator's size stays bounded (it doesn't need to embed all extraction rules).
- Parallel extraction (calling multiple sub-prompts concurrently) is possible if latency becomes a problem.

**What becomes harder:**

- The orchestrator must produce valid `briefUpdates` — it is doing double duty (conversation + extraction). If orchestrator quality degrades, both the response and brief accuracy suffer simultaneously.
- Prompt version management covers multiple files; updating the brief schema requires updating both orchestrator and affected sub-prompts.

---

## Alternatives Considered

- **Single mega-prompt:** Rejected — accuracy degrades on subtasks; context window bloat; testing is brittle.
- **Pure cascade (call all sub-prompts every turn):** Rejected — 6 API calls per user message is expensive and slow; user-perceived latency would be unacceptable.
- **Agent loop (prompt decides its own tool calls):** Considered but deferred — an agent loop gives more flexibility but is harder to bound in cost and latency; the fixed orchestrator pattern is more predictable for v1.
