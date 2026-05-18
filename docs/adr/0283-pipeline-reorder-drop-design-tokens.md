# ADR-0283: Pipeline Reorder — UI Generation Becomes Stage 3, Design Tokens Removed

**Status:** Accepted
**Date:** 2026-05-18

## Context

The AI build pipeline as originally specified was: Intent → PRD → **Design Tokens** → Schema → Migration → UI → Code → Tests → Deploy → Maintenance. After ADR-0280 retired the Maintenance UI we were at 9 stages.

Two problems with that ordering surfaced during implementation:

1. **Design tokens duplicates workspace branding.** ADR-0279 already established that workspaces own brand identity — themes, primitives, semantic tokens, presets, the advanced Figma-style editor — at `/workspaces/[slug]/branding/`. That surface authors tokens far better than a one-shot AI-generation step ever could. Maintaining a parallel Stage-3 generation flow created two ways to do the same thing and the workspace surface is clearly better.

2. **Schema-before-UI is the wrong order.** You don't really know what data shapes you need until you see what the app _is_. The current pipeline forced users to commit to a schema before the UI proved which entities and relationships were actually needed, then suffered rework when the UI revealed missing or unnecessary tables. The natural flow is: agree on intent, agree on requirements, mock the UI to see the app's shape, _then_ derive the schema from what you saw.

## Decision

The build pipeline is now **8 stages** in this order:

1. Intent capture
2. Requirements (PRD)
3. **UI generation** (moved up from old position 6)
4. Schema synthesis
5. Data migration
6. Code generation
7. Tests
8. Deployment

**Design tokens is removed as a standalone stage.** Its responsibilities split as follows:

- **Authoring** lives entirely in `/workspaces/[slug]/branding/` (presets, advanced editor, preview surface). This is where users define their brand.
- **Application** happens inside UI generation: the preview iframe at `/preview/[artifactId]` consumes the active workspace's tokens as CSS variables. No generation step required; UI gen reads workspace state.
- **AI-suggested token tweaks** (the original Stage 3 capability) are deferred. If they're useful, they'll surface inside UI generation as an optional "regenerate brand variants" affordance — not as a gating pipeline stage.

The `DesignTokensService` in `packages/core/` is retained for now (not deleted) so it can be repurposed if Stage 3 wants AI suggestions. Its UI surface (`apps/web/src/app/ai-pipeline/design-tokens/`) is deleted.

Objective 23's status changes to **REMOVED FROM PIPELINE**; a Section 0 note in the objective records the decision and points here.

## Consequences

**What this enables:**

- UI generation runs as soon as the PRD is approved, not five stages later. Users see the app they're building much sooner — which is the dominant feedback signal.
- Schema synthesis has more information to work with: it sees the actual UI components, the forms users will fill out, the lists they'll browse. The schema is derived from a real shape, not a hypothesized one.
- Brand authoring is workspace-scoped (every project inherits) rather than project-scoped (re-derived every time). Matches the product positioning.
- One fewer pipeline stage to maintain.

**What this complicates:**

- The pipeline no longer matches the master-plan narrative if it still says "Stage 3 generates design tokens." Update needed there.
- Existing dev data that referenced design-tokens routes will 404. Acceptable — those routes were never production.
- The "Stage N" numbering shifts. Objective filenames still encode the old numbering (`23-stage-3-design-tokens.md`, `26-stage-6-ui-generation.md`). We keep the filenames for historical continuity but add notes in each objective. Future objectives can use the new numbering.

**What becomes harder:**

- AI-suggested token generation, if we ever want it back, no longer has a natural home as a standalone stage. It would have to be either (a) a sub-step of UI gen, or (b) a feature of workspace branding. (a) is probably the right answer when the time comes.

## Alternatives considered

1. **Keep design tokens as Stage 3 in the pipeline but make it read-only against workspace branding.** Rejected — adds a stage that does nothing but proxy data the next stage could read directly. Pure overhead.
2. **Move design tokens to before intent capture (as a workspace-setup step).** Rejected — that's already what workspace branding _is_; renaming pipeline Stage 3 to "Workspace setup" was just a less honest way of saying "this isn't really a pipeline stage."
3. **Keep schema synthesis at Stage 3 (the conservative reorder) and only remove design tokens.** Considered. Rejected because the user's stated reasoning is correct: knowing the UI shape clarifies the schema. Moving UI up is more valuable than just deleting a stage.
4. **Delete the `DesignTokensService` along with the UI.** Rejected for now — the AI token-generation logic may still be useful as a suggestion engine inside UI gen, and deleting code we might use again is harder than letting it sit unwired for a release.

## References

- ADR-0279 — Workspace-scoped themes vs project-scoped design tokens (the original split that made Stage 3 redundant)
- ADR-0280 — Maintenance UI relocated (the previous pipeline simplification)
- Objective 23 — Section 0 records the removal
- `apps/web/src/components/app-shell/shell-config.ts`, `pipeline-stepper.tsx`, `command-palette.tsx`, `apps/web/src/app/ai-pipeline/stepper.tsx`, `apps/web/src/app/ai-pipeline/page.tsx` — all updated to the 8-stage order
