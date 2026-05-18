# ADR-0281: Stage 6 Visual Edits — Direct DOM Manipulation with Edit-Overlay Persistence

**Status:** Accepted
**Date:** 2026-05-18

## Context

Stage 6 (UI Generation) ships generated React components that the user reviews and approves. The original Stage 6 spec (Objective 26) treated the user as a passive reviewer: read the code, run the preview, approve or send back for regeneration. Anything beyond "looks good / regenerate with this feedback" required regenerating the whole component.

This is too coarse-grained for the common case: the user wants the AI's first pass mostly, but with the dashboard title bumped up a size, the brand color a shade warmer, the submit button rounded. Asking the AI to regenerate over and over for tiny visual tweaks is expensive (tokens), slow (latency), and produces drift (the new generation may rework things the user didn't want changed).

Lovable demonstrated a better workflow: click an element in the live preview, edit it directly in an inspector, see the change immediately, save when satisfied. The "Visual Edits" feature is now table-stakes for AI app builders.

## Decision

Extend Stage 6's code review UI with a Lovable-style visual editing capability built on four layers:

1. **Same-origin sandboxed iframe preview** at `/preview/[artifactId]`. Replaces the previous static-mock inline render. The iframe is bare (no app shell, no auth chrome) so the preview is the generated UI plus a thin selection agent.
2. **Stable element identifiers.** Every editable element carries `data-edit-id` (v1: hand-applied to mock components; v2: `data-loc="<path>:<line>:<col>"` emitted by a Babel/SWC plugin). The inspector and persistence layer address elements by this ID, not by selector heuristics.
3. **postMessage protocol** for iframe ↔ parent. Typed envelope (`source: 'lighthouse-preview'`, version, payload). Origin check on every receive. Iframe → parent: `ready`, `hover`, `select`, `deselect`. Parent → iframe: `apply-edit`, `highlight`, `reset-edits`, `set-overlay`.
4. **Edit overlay persistence (v1).** Saved edits are a JSON `Record<editId, EditMutation>` keyed by artifact. On iframe load, the overlay is read and replayed on the DOM after the base render. The Save endpoint merges new edits into the overlay and the iframe reloads to read the persisted state. **No source code is modified in v1.**

The v2 follow-up (separate ADR when real generated artifacts exist) will replace the overlay backend with Babel-parse / mutate / write-back into the actual `.tsx` source file, preserving the same `EditMutation` shape and the same UX.

## Consequences

**What this enables:**

- Users tweak generated UI in seconds without round-tripping to the AI for small changes — token cost stays near-zero for visual polish.
- The UX is decoupled from real artifact generation existing. The full Lovable-style flow demos and ships against the current mock components.
- The persistence format (`Record<editId, EditMutation>`) is straightforward to translate into AST patches when v2 lands, so v2 is a backend swap, not a redesign.
- The iframe sandbox cleanly isolates generated UI from the platform's app shell — generated code can never break the host page.

**What this complicates:**

- Two identity systems exist transitionally: synthetic `data-edit-id` for mocks (v1) and real `data-loc` for generated artifacts (v2). The protocol treats both as opaque strings, so the inspector doesn't care, but the Babel plugin in v2 must guarantee uniqueness within an artifact.
- The overlay can drift from the source if a component is regenerated. Mitigation: when regeneration happens, the overlay is cleared (v1) and offered for replay against the new generation (v2 — diff overlap detection).
- Same-origin iframe + `allow-scripts allow-same-origin` does not isolate the iframe's JavaScript from the parent's cookies. Acceptable here because the preview only renders our own generated code, never untrusted third-party content. If we ever preview untrusted code, we move to a cross-origin sandbox.

**What becomes harder:**

- Concurrent multi-user editing of the same component. v1 last-write-wins via the in-memory store; v2 needs workspace-scoped persistence and conflict detection (likely shares infrastructure with the optimistic-update conflict resolution from Objective 18).
- Visual regression tests. Storybook visual snapshots assume the static source; overlay-modified renders are a separate snapshot dimension.

## Alternatives considered

1. **Skip visual edits; rely on AI regeneration with text feedback.** Rejected — too slow and expensive for the dominant case (small tweaks), and produces drift in surrounding code the user didn't ask to change.
2. **Build visual edits in the future Page Designer surface (Objective 26 §13) instead of Stage 6.** Rejected — Page Designer is post-approval; visual edits during review is the higher-leverage workflow because edits feed back into the artifact that's still being approved.
3. **Real AST source mutation from day one (skip the overlay layer).** Rejected for v1 — Stage 6 artifacts aren't really generated yet, so there's no source to mutate. Building the AST pipeline against nothing would block the visual UX behind generation work. The overlay layer lets us ship the UX now and swap the backend later.
4. **Cross-origin iframe with strict sandbox.** Rejected — `postMessage` works either way, but cross-origin makes shared CSS variables (design tokens) much harder to thread through. Same-origin is correct for our trust model (we render only our own generated code).
5. **DevTools-style selector-path identifiers (e.g. `body > div:nth-child(2) > h1`).** Rejected — fragile under any structural change; an edit applied to "the third h1" silently moves when components are reordered. Stable IDs are the only contract that survives regeneration sensibly.

## References

- Objective 26 §0 (Visual Edits Addendum) — locked decisions
- Lovable's "Visual Edits" blog post (https://lovable.dev/blog/visual-edits) — inspiration
- `apps/web/src/app/preview/` — iframe target, selection agent, protocol
- `apps/web/src/app/ai-pipeline/ui-generation/panels/PreviewIframePanel.tsx`, `VisualEditInspector.tsx`
- `apps/web/src/lib/visual-edits/edit-overlay.ts`, `overlay-store.ts`
- `apps/web/src/app/api/v1/ai-pipeline/ui-generation/visual-edit/route.ts`
