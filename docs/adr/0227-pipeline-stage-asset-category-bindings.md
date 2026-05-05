# ADR-0227: AI Pipeline Stage-to-Asset-Category Bindings

**Status:** Accepted
**Date:** 2026-05-04
**Deciders:** solo

## Context

The AI Pipeline has multiple stages (PRD generation, design token generation, UI generation, code generation). Each stage benefits from different subsets of workspace assets. The objective (15.5) illustrates four stage context configurations:

- Stage 2 (PRD): documents — voice, strategy, reference
- Stage 3 (Design Tokens): brand — logos, colors, fonts; documents — voice
- Stage 6 (UI Generation): brand — logos, colors, fonts, images, icons; documents — voice, reference
- Stage 7 (Code Generation): documents — compliance, specs

Two questions need answering:

1. **Where are the bindings declared?** — in each stage's code, or in a shared config?
2. **How are they enforced?** — runtime check, type-level constraint, or convention?

## Decision

The bindings are declared as **exported constants in `packages/ports/workspace-assets/src/stage-context.ts`** and consumed by each pipeline stage at construction time.

```typescript
export const STAGE_ASSET_CONTEXT = {
  stage2_prd: {
    documents: ['voice', 'strategy', 'reference'],
  },
  stage3_design_tokens: {
    brand: ['logos', 'colors', 'fonts'],
    documents: ['voice'],
  },
  stage6_ui_generation: {
    brand: ['logos', 'colors', 'fonts', 'images', 'icons'],
    documents: ['voice', 'reference'],
  },
  stage7_code_generation: {
    documents: ['compliance', 'specs'],
  },
} as const satisfies Record<string, StageAssetContext>;
```

The `WorkspaceAssetPort` exposes a `listByContext(workspaceId, ctx: StageAssetContext)` method that returns only the assets matching the declared categories. Pipeline stages **must** call `listByContext` with their declared constant — they must not call `listByCategory` directly with ad-hoc strings.

An ESLint rule (`platform/no-adhoc-asset-category`) enforces this: direct calls to `listByCategory` outside of `workspace-asset.service.ts` are flagged as errors.

### Least-context principle

Each stage fetches only what it declared. The `listByContext` signature makes this structural: a stage cannot accidentally receive assets from undeclared categories.

### Provenance tagging

`listByContext` returns assets with a `contextRole` field indicating which declared category slot the asset fills. Pipeline stages pass this through to the generation record so the audit trail can identify which assets influenced each generation.

## Consequences

### Positive

- Bindings are in one place — changes to what Stage 3 reads require one edit in one file, not a hunt through stage implementation code
- The port's `listByContext` API makes the least-context principle structural rather than conventional
- Provenance is captured automatically at the point of asset loading, not as a separate concern

### Negative

- Pipeline stages (Obj 22, 23, 26, 27) must import from `@platform/ports-workspace-assets` — a new dependency. Acceptable because ports are the correct dependency direction.
- The ESLint rule must be written and maintained alongside the port

### Neutral

- `STAGE_ASSET_CONTEXT` uses `as const satisfies` to get both literal inference and type safety without a separate type annotation

## Alternatives Considered

### Option A: Each stage declares its own context inline

Each stage file contains its own asset category list. Simple, no shared config. Rejected: when a new document category is added (e.g. "legal"), finding all stages that should read it requires grep; the binding is invisible until a stage is audited. Central declaration makes the full policy visible at a glance.

### Option B: Runtime configuration (stored in DB per workspace)

Workspace admins configure which stages read which categories. Flexible but adds significant complexity: a UI, a migration, a validation layer, and the risk of misconfiguration silently starving stages of context. Rejected: the objective says "declarative (an objective in code) so it can be audited and changed" — this is code-level configuration, not runtime.

## References

- Obj 15.5 — Workspace Assets and Documents
- Obj 22 — Stage 2: PRD Generation
- Obj 23 — Stage 3: Design Tokens
- Obj 26 — Stage 6: UI Generation
- Obj 27 — Stage 7: Code Generation
- ADR-0226 — Workspace Assets storage layout
