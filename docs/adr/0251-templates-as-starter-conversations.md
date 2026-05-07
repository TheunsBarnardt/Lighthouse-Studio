# ADR-0251: Templates as Starter Conversations, Not Constraints

**Status:** Accepted
**Date:** 2026-05-06
**Objective:** 21 (Intent Capture)

---

## Context

Users starting a new conversation about a CRM system face a blank page. Templates help. The design question is: should templates constrain what the conversation can cover (i.e., required fields, validation rules per category) or should they simply bootstrap the conversation with a helpful first message and suggested focus areas?

---

## Decision

Templates are **starter conversations, not schema constraints**. An `IntentBriefTemplate` contains:

- `name` and `description` — for the template picker UI
- `category` — for grouping and search (`business`, `content`, `technical`, etc.)
- `starterMessage` — the first AI message injected into the conversation when the template is selected
- `suggestedFocusAreas` — hints shown to the user at the start, not enforcement

When a template is selected:

1. A new `intent_conversation` artifact is created with `templateId` recorded.
2. The `starterMessage` is injected as the first assistant message, giving the conversation context and direction.
3. The user types their first message — they can ignore the template direction entirely.

Templates do not: add required fields, change the brief schema, restrict what can be captured, or alter the validation rules. The intent brief schema is universal (ADR-0247).

Ten built-in templates cover common use cases: CRM, Blog/Content platform, Task tracker, E-commerce, Internal tool, Customer portal, API service, Mobile app, Data dashboard, Legacy system migration.

---

## Consequences

**What becomes easier:**

- Users get a warm start without being constrained by form fields.
- The AI can pivot based on what the user actually says, even if it diverges from the template category.
- Adding new templates is a data change (INSERT into `intent_brief_templates`), not a schema change.

**What becomes harder:**

- Templates can't enforce domain-specific required fields (e.g., "all e-commerce briefs must include payment processor"). If this is needed, it would require a template-specific validation overlay — deferred.
- Template quality affects conversation quality; bad starter messages produce worse briefs. Templates need periodic review and updates.

---

## Alternatives Considered

- **Templates as required-field overlays:** Rejected — forces users into a structured form, losing the conversational discovery value.
- **Templates as full prompt system overrides:** Rejected — would require maintaining 10 separate orchestrator prompt variants; maintenance burden grows with each template.
- **No templates:** Rejected — blank-page paralysis is real; templates reduce time-to-first-message by giving users an obvious starting point.
