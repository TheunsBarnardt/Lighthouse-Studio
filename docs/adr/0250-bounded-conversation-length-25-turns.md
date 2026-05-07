# ADR-0250: Bounded Conversation Length (25 Turns)

**Status:** Accepted
**Date:** 2026-05-06
**Objective:** 21 (Intent Capture)

---

## Context

An unbounded conversation creates three problems: (1) context window growth increases cost and latency non-linearly; (2) very long conversations produce diminishing intent clarity — users who need 40 turns haven't refined their intent, they've confused it; (3) the artifact's JSONB `content` grows without bound, threatening query performance.

---

## Decision

Conversations are capped at **25 turns**. A "turn" is one user message + one assistant response pair.

Implementation:

- `IntentCaptureService.sendMessage()` checks `turnCount` before accepting a message.
- At turn 22 (25 - 3), the UI shows a yellow warning banner: "N turns remaining — consider generating your brief soon."
- At turn 25, the final assistant response is replaced with a `turn_limit_reached` event; the UI disables the input.
- The user can still generate the brief from the conversation's current state.

A `get-conversation-summary` tool is available to the orchestrator when the conversation exceeds 15 turns; it returns a compressed summary to reduce context window pressure in the later turns.

---

## Consequences

**What becomes easier:**

- Cost per conversation is bounded. At current pricing, 25 turns of orchestrator calls costs approximately $0.05–$0.30 depending on message length — predictable for workspace budgets.
- JSONB artifact content stays bounded and query-friendly.
- Users are nudged toward conciseness, which produces better briefs.

**What becomes harder:**

- Complex products with many constraints may genuinely need more than 25 turns. The mitigation is the summary tool (keeps context fresh) and the template system (pre-seeds the conversation with domain context, reducing turns needed).
- The 25-turn limit is a code constant (`MAX_TURNS`). Changing it requires a code deploy, not a configuration change. This is intentional — cost implications of raising the limit should require an explicit decision.

---

## Alternatives Considered

- **Token-based limit (not turn-based):** Rejected — turns are user-meaningful; tokens are opaque to users. The warning UX ("3 turns remaining") is natural; "3,000 tokens remaining" is not.
- **No limit:** Rejected — unbounded cost; diminishing return on intent quality; JSONB size concern.
- **Limit of 10 turns:** Too restrictive for complex enterprise use cases; 25 is empirically about right based on internal testing.
