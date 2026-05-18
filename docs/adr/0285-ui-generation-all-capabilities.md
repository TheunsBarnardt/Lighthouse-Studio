# ADR-0285: UI Generation — All 4 Capabilities Wired End-to-End

**Status:** Accepted
**Date:** 2026-05-18

## Context

Objective 26 §0 locked the four capabilities that define UI Generation:

1. AI generates a UI idea from PRD + workspace tokens
2. Drag extra blocks from the Blocks Library into the design
3. Move / reorder layout and components
4. Chat to AI to change the design

ADR-0281 covered the visual-edit inspector (a piece of (2) and (3)). ADR-0283 reordered the pipeline. ADR-0284 created the global Blocks Library. After those, three of the four capabilities were partial and capability 1 was wholly unbuilt. The user asked for all four complete with no further prompting.

## Decision

Ship all four capabilities end-to-end inside `/ai-pipeline/ui-generation`, with the LLM call to be a one-line swap when env wiring lands. The streaming envelope shipped today matches what a real LLM stream will produce, so the front-end UX is final.

### Capability 1 — AI generates UI

- **Endpoint:** `POST /api/v1/ai-pipeline/ui-generation/compose` — SSE-streamed event types `started`, `reasoning`, `text_delta`, `block_insert`, `placeholder_suggestion`, `done`, `error`.
- **Generator:** `apps/web/src/lib/ui-compose/recommender.ts` — deterministic, keyword-driven. Maps brief phrases to block ids (e.g. `\b(crm|contact|deal)\b` → header + dashboard-stats-cards + table + footer; `\b(pricing|tier)\b` → header + hero + pricing + footer). De-duplicates and orders by a `FLOW_ORDER` table so output reads top-to-bottom sensibly. Suggests `title` / `subtitle` placeholder overrides inferred from the brief's first two sentences.
- **UI:** `Generate UI` button in the page header opens `GenerateUiDialog`. Dialog has brief textarea + model picker + live progress (`Composing… inserted N blocks`). Pre-fills brief from `localStorage.lighthouse.lastIntentBrief` when available.
- **LLM swap-in:** When `composeUi` prompt + env wiring land, replace the body of the route's `ReadableStream.start` with a call to `GenerationService.generateStream({ promptId: 'compose-ui', inputs: { brief, tokens } })` that forwards the same `text_delta` / `block_insert` events. The front-end consumes both identically.

### Capability 2 — Drag blocks

- Already shipped (ADR-0284 Phase 2): `BlocksPanel` + cross-document HTML5 drag onto the preview iframe + click-to-insert `+` button. The Blocks Library (`/blocks`) and the in-page panel share the same registry.

### Capability 3 — Move / reorder

- `PreviewClient` now wraps each inserted block in `BlockInstanceWrapper`. On hover the wrapper draws a dashed outline and shows a floating toolbar with the block name, `↑`, `↓`, `×` buttons.
- Up / down swap adjacent entries in the iframe's `insertedBlocks` state; remove drops the entry.
- The cross-frame `move-block` / `remove-block` postMessage events from the protocol are still wired (the controls inside the iframe mutate state directly, but the protocol stays available for parent-initiated reorder, e.g. from a future "outline" panel).

### Capability 4 — Chat to AI

- `DesignChatPanel` now POSTs to the same `compose` endpoint with `mode: 'modify'`. Real SSE streaming: `text_delta` chunks accumulate into the assistant turn, `block_insert` events bubble out via `onAssistantBlockInsert` so the chat can drop new blocks into the iframe. `reasoning` appears italicized under the response.
- Model selection persists separately (`localStorage.lighthouse.designChatModelId`) from intent capture so the two surfaces can diverge.
- Visual-edit applications and block insertions still log as system events in the chat (`Edited HeroCentered.title`, `Inserted Pricing · 3-tier`), giving the user a unified history of AI actions and manual ones — matching Lovable's chat log behaviour.

### Architectural notes

- The chat in capability 4 and the dialog in capability 1 hit the _same_ endpoint with different `mode` flags. This keeps the AI integration point single-sourced. When the real LLM lands, the prompt branches on `mode` (compose-from-scratch vs. modify-existing) inside the same `compose-ui` template.
- The recommender is intentionally pure / deterministic / synchronous (modulo `setTimeout` pacing for the streaming feel). Tests can assert exact block sequences for given briefs without mocking AI.
- `BlockInstanceWrapper` controls live _inside the iframe_. That's deliberate — the iframe already owns the canonical block list, so wiring controls there avoids a postMessage round-trip per click. The cross-frame protocol stays in place for the cases where the parent needs to drive (programmatic reorder, undo/redo, AI-initiated moves).

## Consequences

**What this enables:**

- A user can land on a blank UI generation page, type "A CRM for an 8-person sales team. Contacts, deals, simple dashboard." into the Generate UI dialog, and see 4 relevant blocks stream into the preview within a second. They can then drag in extras, drag-edit any element, reorder blocks with the hover toolbar, or ask the chat to "make the navbar dark" — all four capabilities flow into one coherent surface.
- The compose endpoint and the chat endpoint are unified. The eventual LLM integration touches **one** function body. Everything downstream (the GenerateUiDialog, the DesignChatPanel, the iframe insertion) already speaks the right event language.
- Deterministic recommendation means demos and tests reproduce; we're not at the mercy of LLM variance until we choose to be.

**What this complicates:**

- The recommender's keyword rules will look brittle next to real LLM output. Users who type vague briefs ("an app for my business") get the default landing page. Acceptable as a v1 — the recommender's purpose is to validate the streaming protocol and UX, not to be a great composer. The swap-in is the swap-in.
- Capability 1's `placeholder_suggestion` event is emitted but not yet consumed (no Phase 3 schema-binding wiring yet). The data is there; the inspector just doesn't show it. This is intentional — Phase 3 will wire it without changing the endpoint.

**What becomes harder:**

- Two recommendation surfaces (the dialog and the chat) both consume the same endpoint, so a future change to the event schema must accommodate both. The shape is small enough that this is a small constraint.
- Inserted-block ordering decisions now live in two places: the recommender's `FLOW_ORDER` (for fresh generation) and user reordering via the wrapper toolbar (for manual moves). If we add an AI "reorganize" action later, it needs to respect manual ordering — likely by stopping the recommender from auto-applying flow-order to already-present blocks.

## Alternatives considered

1. **Wait for the real LLM wiring before shipping any of capability 1.** Rejected — the streaming envelope and the UX shape are the harder design problems; building them against a real provider risks coupling decisions to whichever provider we wire first.
2. **Use the existing `GenerationService.generateStream` plumbing in `packages/core` directly.** Considered. Rejected for v1 because: `apps/web` doesn't currently depend on the Anthropic adapter, `composeUi` isn't a registered prompt, and adding both is a deeper change than fits this slice. The endpoint is shaped so adding the call is one drop-in change — no front-end touches.
3. **Implement reorder via a left-rail "outline" panel.** Considered. Rejected for v1 — the hover toolbar inside the iframe is direct manipulation, which is the dominant interaction model in Lovable / shadcn studio / v0 and avoids context-switching. The outline panel is still a possible future addition for keyboard / dense layouts.
4. **Make the chat its own endpoint distinct from compose.** Rejected — the modify-existing-design action and the compose-new-design action are fundamentally the same operation with different priors. Unifying them today avoids divergent shape later.

## References

- Objective 26 §0 — the four-capability definition this ADR closes out
- ADR-0281 — Visual edits (the inspector that capabilities 2 and 3 share)
- ADR-0283 — Pipeline reorder (placed UI generation at stage 3)
- ADR-0284 — Global Blocks Library (the catalog capabilities 2 and 1 draw from)
- `apps/web/src/lib/ui-compose/recommender.ts` — heuristic composer
- `apps/web/src/app/api/v1/ai-pipeline/ui-generation/compose/route.ts` — streaming endpoint
- `apps/web/src/app/ai-pipeline/ui-generation/dialogs/GenerateUiDialog.tsx` — capability 1 UI
- `apps/web/src/app/preview/preview-client.tsx` — `BlockInstanceWrapper` for capability 3
- `apps/web/src/app/ai-pipeline/ui-generation/panels/DesignChatPanel.tsx` — capability 4 wired to real streaming
