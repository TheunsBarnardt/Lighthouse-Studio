# ADR-0249: Conversation as an Artifact Type

**Status:** Accepted
**Date:** 2026-05-06
**Objective:** 21 (Intent Capture)

---

## Context

The intent capture conversation (the chat history between user and AI) needs to be: persisted across sessions, linked to the brief it produces, included in the audit trail, and accessible via the same permission model as other pipeline artifacts. Storing conversations in a separate `conversations` table would duplicate the versioning, lineage, and permission infrastructure already in `ai_artifacts`.

---

## Decision

Conversations are stored as artifacts with `type: 'intent_conversation'` and `stage: 'intent_capture'`. The artifact `content` field holds `{ messages: ConversationMessage[], briefDraft: BriefDraft, templateId?, status }`.

When a brief is generated from a conversation:

- A new `intent_brief` artifact is created with `parent_artifact_ids: [conversationId]`.
- The conversation artifact is set to `status: 'superseded'` (it produced its brief).

This models the natural lineage: one conversation → one brief. The brief's audit trail includes the conversation ID, so reviewers can trace back to the raw chat that produced it.

URL resumability is free: the conversation ID is in the URL path (`/ai-pipeline/intent-capture/[conversationId]`); loading the page fetches the artifact and hydrates the chat history.

---

## Consequences

**What becomes easier:**

- Conversations inherit the artifact permission model — the same `ai.intent_capture.read` check that guards brief access also guards conversation access.
- Conversation lineage is queryable the same way as any artifact relationship.
- Conversations appear in workspace activity feeds alongside other artifacts.

**What becomes harder:**

- Conversation content (full message history) can be large (25 turns × potentially long messages). Storing it in JSONB is workable for typical conversations but may be slow for very long ones. A future enhancement could paginate message storage, but this is not needed for the 25-turn cap.
- Soft-deleting a conversation also removes the lineage link from the brief. The brief's `parent_artifact_ids` array still holds the conversation ID; it just becomes a dangling reference to an archived artifact.

---

## Alternatives Considered

- **Separate `intent_conversations` table:** Rejected — duplicates versioning, lineage, and permission plumbing.
- **Store messages in a separate `conversation_messages` table with FK to `ai_artifacts`:** Rejected — more joins, more tables, same data. The 25-turn message cap keeps JSONB size manageable.
- **No persistence (in-memory sessions only):** Rejected — conversations lost on page refresh; no audit trail; can't resume across devices.
