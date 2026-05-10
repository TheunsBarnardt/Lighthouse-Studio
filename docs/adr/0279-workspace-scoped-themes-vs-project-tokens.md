# ADR-0279: Workspace-Scoped Themes vs Project-Scoped Design Tokens

**Status:** Accepted
**Date:** 2026-05-09

## Context

Objective 23 (Stage 3 — Design Tokens) specifies design tokens as **project-scoped, AI-generated** artifacts: each project's PRD feeds brand inputs into an LLM that produces a `DesignTokenSet` for that project alone. The locked decisions in Objective 23 cover the AI generation pipeline, not workspace-level branding.

In parallel, the product positions a **workspace as a company's identity** — themes, fonts, logos, and brand assets that every project inside the workspace inherits by default. This is the user's mental model for multi-tenant branding: a workspace is "Acme Corp," every project inside it should feel like Acme Corp without re-deriving the brand from scratch.

These two views aren't contradictory but they are different layers, and the codebase needs an explicit decision about how they relate before we add UI for either.

## Decision

The platform will support **two complementary token layers**:

1. **Workspace theme (this ADR).** A single `WorkspaceTheme` artifact per workspace, manually authored via the workspace branding UI. Stored as `workspace.settings.theme`. Two-tier: primitives (raw OKLCH/HSL color scales, spacing, radii) and semantics (CSS variable bindings, with aliases referencing primitives). Light + dark modes generated together. This is the **canonical brand layer**.

2. **Project tokens (Objective 23).** AI-generated per-PRD `DesignTokenSet` artifacts. Layer **on top of** the workspace theme as overrides — projects do not start from a blank slate.

**Precedence at render time:** `project tokens > workspace theme > platform defaults`. Implemented via nested CSS-var providers: `<WorkspaceThemeProvider>` injects workspace tokens at the app shell; a future `<ProjectThemeProvider>` (per Objective 23) injects project overrides inside individual project surfaces.

The workspace theme schema in `apps/web/src/lib/theme/types.ts` is **not** the same as Objective 23's `DesignTokenSet` schema. Workspace themes are simpler (no AI reasoning metadata, no PRD linkage, no accessibility/consistency reports), reflecting their role as a manual brand layer rather than an AI-generated artifact. Conversion utilities can bridge the two when project tokens need to be derived from workspace defaults.

## Consequences

**What this enables:**
- Workspaces can ship a consistent brand without invoking the AI pipeline for every project.
- Vibe users get a fast preset-based path; designers get a Figma-level token editor — both at the workspace layer.
- Projects in Objective 23 layer on top, so AI generation has a richer starting point (existing brand) rather than reinventing colors from scratch.

**What this complicates:**
- Two schemas exist (`WorkspaceTheme`, `DesignTokenSet`); we accept the duplication because their lifecycles, inputs, and consumers differ. A future ADR may unify them if real overlap emerges.
- The merge precedence (`project > workspace > platform`) must be honored consistently; subtle bugs can arise if a project inherits a workspace theme but then overrides only some semantic tokens. Tests must cover the override surface.
- Plan-gating differs by layer: workspace themes are core (free); some workspace features (custom fonts, multiple themes, AI generation) are plan-gated; project AI generation is plan-gated separately per Objective 23.

**What becomes harder:**
- Documenting the relationship in user-facing docs. We will explicitly call out that the workspace theme is the brand and project tokens are project-specific overrides.

## Alternatives considered

1. **Move all tokens to the workspace level; drop project-scoped tokens.** Rejected — Objective 23's AI-generated per-project tokens are a core differentiator of the AI Build Pipeline; removing them would gut Stage 3.

2. **Keep tokens project-only (strict Objective 23 reading); ignore the workspace layer.** Rejected — contradicts the product positioning of workspace = company identity, and forces every project to re-derive the brand.

3. **Single unified schema for both layers.** Rejected for now — `DesignTokenSet` carries AI-specific metadata (reasoning, consistency report, accessibility report, brand inputs) that isn't relevant to a manually-authored workspace brand. Forcing one schema would either bloat workspace themes or strip AI metadata from project tokens.

## References

- Objective 23 — Stage 3 Design Tokens (project-scoped AI generation)
- Objective 15.5 — Workspace Assets and Documents (logos, fonts, reference docs live here, not in the theme artifact)
- ADR-0172 through ADR-0177 — Objective 23's locked color/typography/contrast decisions
- `apps/web/src/lib/theme/types.ts` — WorkspaceTheme schema
- `apps/web/src/components/providers/workspace-theme-provider.tsx` — runtime injection
- `apps/web/src/app/workspaces/[slug]/branding/page.tsx` — two-tab editor (Presets, Advanced)
