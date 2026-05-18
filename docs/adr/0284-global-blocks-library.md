# ADR-0284: Global Blocks Library — Shared Pattern Catalog with DnD into UI Generation

**Status:** Accepted (Phase 1)
**Date:** 2026-05-18

## Context

`master-plan.md` line 143 and Objective 26.5 §3 reference a **Blocks Library** as a planned platform-level system: a catalog of pre-built UI patterns (Hero, CTA, Features, Pricing, Auth forms, Footers, Chrome blocks, etc.) that users can drop into projects to skip starting every component from scratch. Until now this lived only in those docs.

ADR-0279 established that **workspaces own brand identity** — themes, tokens, presets. ADR-0283 established that **UI generation owns structural composition**. The Blocks Library fits between them as the **shared vocabulary of structural patterns** that a brand is applied to. It is global, not workspace-scoped, because the patterns themselves (a 3-tier pricing table, a centered hero, a 4-column footer) are the same across companies — only the brand layered on top differs.

shadcn/ui's blocks gallery and shadcnstudio.com/blocks are the reference UX: a browsable catalog with live previews, a code view, and an action to insert into the user's project. We need the equivalent inside Lighthouse, plumbed into the UI-generation iframe so dropped blocks become editable via the existing visual-edits inspector.

## Decision

Build the Blocks Library as a **new top-level mode** at `/blocks`, parallel to AI Pipeline / Approvals / Data / etc. — not nested under any workspace.

**Layer 1 (Phase 1, this change):**

- **Block registry** at `apps/web/src/lib/blocks/registry.tsx` — 14 starter blocks across 12 categories (hero, cta, features, pricing, testimonial, stats, auth, form, header, footer, table, dashboard). Each block is a typed `BlockDefinition` with id, name, category, tagline, optional `placeholders` map, and a `render()` JSX function. Blocks tag elements with `data-edit-id` so the existing visual-edits selection agent works against them with zero adaptation.
- **Preview route** at `/preview/blocks/[blockId]` — bare iframe target rendering one block plus the shared `SelectionAgent`. Same envelope/postMessage protocol as `/preview/[artifactId]`, just a different data source.
- **Gallery page** at `/blocks` — search box, category pill filter, responsive grid of cards. Each card embeds a scaled-down (0.3×) iframe pointing at `/preview/blocks/<id>` so previews are live, not screenshots.
- **Detail page** at `/blocks/[blockId]` — full-size iframe preview, Code tab (currently a placeholder; full source serialization is a Phase 2 follow-up), Placeholders tab (lists the bindable fields).
- **"Add to UI generation"** button on the detail page — queues the block ID in `localStorage.lighthouse.pendingBlocks` and navigates to `/ai-pipeline/ui-generation`, which surfaces queued blocks as a dismissible banner at the top of the page.
- **Icon-nav + shell mode** registration: new `Blocks` icon (lucide `Blocks`), new `blocksContextNav` listing the 12 categories.

**Layer 2 (Phase 2, deferred):** True drag-and-drop from a `BlocksPanel` inside UI generation into the preview iframe. The drop event posts `{ type: 'insert-block', blockId, anchor }` over the existing postMessage protocol; the iframe inserts the block's DOM at the drop position and tags it with overlay-compatible IDs. HTML5 native DnD (no `react-dnd` dependency).

**Layer 3 (Phase 3, deferred):** Placeholder-to-schema binding. The inspector gains a "Bind to data" section when the selected element is inside a block; users map `placeholders` keys (e.g. `MockListPreview.title`) to schema fields (e.g. `Contact.fullName`). The binding lives in the edit-overlay alongside class/text mutations.

## Consequences

**What this enables:**

- A user can skip "describe my hero from scratch" and just pick `Hero · Centered`, drop it, brand-apply, edit text. Same flow as Lovable's templates and shadcn studio.
- The catalog is the natural home for **chrome blocks** referenced by Objective 26.5 — headers and footers as a category, ready to bind to per-page chrome configuration when that lands.
- Blocks are JSX renderers, not strings, so they're type-checked at compile time and refactorable. The Code tab is currently placeholder; a Phase 2 build step can serialize the JSX to source strings if users want to copy code.
- The selection agent and visual-edit inspector work against blocks identically to mock components, because both expose the same `data-edit-id` contract. No new selection infrastructure.

**What this complicates:**

- The "Add to UI generation" handoff via localStorage is brittle (cleared on browser data wipe; not synced cross-device). Acceptable for Phase 1 because actual drop wiring is Phase 2; localStorage is a placeholder for the real workspace-scoped "draft composition" state that hasn't been designed yet.
- The Code tab currently shows a stub message instead of real source. Users who want to copy a block's code today must open the registry file. Tagged in the page itself and noted here for a Phase 2 follow-up.
- Twelve categories may be too granular if blocks stay sparse. We can collapse low-population categories ("Chrome" wrapping header+footer, say) without breaking the registry — categories are just metadata.

**What becomes harder:**

- Long-term, real source code generation needs to translate block JSX into the user's project codebase (Stage 6 / Stage 7 artifacts). That's a non-trivial JSX-to-source-string serializer with prop handling, not in scope here.
- Visual regression. The gallery shows live iframes; if a block renders inconsistently across browsers/themes, the gallery cards drift visually. Snapshot tests against `/preview/blocks/<id>` would catch this. Not added yet.

## Alternatives considered

1. **Put blocks under each workspace.** Rejected — the patterns are universal; duplicating them per workspace inverts the relationship. Workspace owns the brand, the library owns the structure.
2. **Use an existing component library (shadcn/ui blocks copied verbatim).** Considered. Rejected for v1 because the blocks need to participate in the visual-edit overlay protocol (`data-edit-id` tagging) which requires authoring control. Once the contract is solidified we can ingest shadcn block JSON wholesale.
3. **Inline blocks inside UI generation only (no top-level `/blocks` route).** Rejected — the user explicitly asked for a global section "not on workspace," and a separate destination is the right home for browsing/search/discovery. The DnD-into-UI-gen handoff in Phase 2 doesn't require the catalog to be hidden.
4. **Serialize blocks as JSON strings and render via a generic interpreter.** Rejected — JSX renderers are simpler, faster, and type-safe. Serialization happens when we need a code-copy export; serialization at storage time is premature.
5. **Skip Phase 1 entirely; do DnD first.** Rejected — DnD without a catalog to drag from is moot. Catalog is the prerequisite.

## References

- `apps/web/src/lib/blocks/types.ts`, `apps/web/src/lib/blocks/registry.tsx` — the catalog
- `apps/web/src/app/blocks/page.tsx`, `apps/web/src/app/blocks/[blockId]/page.tsx` — gallery + detail
- `apps/web/src/app/preview/blocks/[blockId]/page.tsx` — preview iframe target
- `apps/web/src/components/app-shell/icon-nav.tsx`, `shell-config.ts`, `command-palette.tsx` — registration
- `apps/web/src/app/ai-pipeline/ui-generation/page.tsx` — pending-blocks banner
- ADR-0279 (workspace branding), ADR-0281 (visual edits), ADR-0283 (pipeline reorder) — adjacent decisions
- master-plan.md line 143, Objective 26.5 §3 — original references to the Blocks Library
