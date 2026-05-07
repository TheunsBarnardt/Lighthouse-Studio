# ADR-0252: Brief Preview as Live UI

**Status:** Accepted
**Date:** 2026-05-06
**Objective:** 21 (Intent Capture)

---

## Context

As the user converses with the AI, the AI is simultaneously extracting structured information (goals, target users, scope, risks). Users have no visibility into what the AI has captured unless they generate the brief. This opacity reduces trust: users don't know whether to keep talking or whether the AI has already understood enough.

---

## Decision

The intent capture page uses a two-column layout: the chat on the left, a **live Brief Preview panel** on the right. The preview panel updates in real-time after each conversation turn:

- Each conversation turn's `turn_complete` event includes the full current `BriefDraft`.
- The `ChatPanel` propagates `BriefDraft` updates upward via `onBriefUpdate` callback.
- The `BriefPreviewPanel` re-renders the brief fields immediately.

Each field is rendered in a `BriefFieldCard` with a visual status:

- **Gray border (empty):** not yet captured
- **Yellow border (tentative):** captured with low confidence (below 0.7 threshold)
- **Green border (confident):** captured with high confidence

A completeness percentage bar summarizes overall brief completeness (weighted count of confident fields).

The panel also shows a "Ready" badge when the orchestrator signals `readyToGenerate: true`, prompting the user to generate their brief.

On mobile, the brief preview is accessible as a tab (URL: `?tab=brief`), not a sidebar.

---

## Consequences

**What becomes easier:**

- Users can see the AI's understanding in real time and course-correct by saying "actually, the main goal is X, not Y."
- Users know when they have enough information to generate (the "Ready" badge) without guessing.
- The preview doubles as a progress indicator, reducing anxiety on long conversations.

**What becomes harder:**

- The brief preview updates on every turn, which means the right panel re-renders frequently. React's reconciliation handles this well for the typical brief size; if it becomes slow, memoization can be added.
- Users may be tempted to use the preview as a substitute for actually generating the brief. The panel shows draft state only; the formal brief has its own approval flow.

---

## Alternatives Considered

- **Preview only visible after brief is generated:** Rejected — removes the most valuable feedback loop in the conversation.
- **Polling for brief updates:** Rejected — polling adds latency and load; SSE push is already in use for the conversation stream, so piggybacking `briefDraft` on `turn_complete` events is essentially free.
- **Separate "analyze brief so far" button:** Rejected — requires user action; live updates are better UX and don't require extra API calls.
