# ADR-0177: Live Preview as Primary UX for Design Tokens

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 23 (Stage 3: Design Tokens)

## Context

Design tokens are abstract — "primary color 500 is #2563eb" means little without context. The user's judgment of whether a token set is correct is inherently visual: does the button feel right? Is the typography scale proportional? Does the dark theme look professional?

Two UX approaches exist:

1. **Token table UX** — present tokens as a table/list; user edits values directly; no visual feedback except color swatches
2. **Live preview UX** — render sample components using the tokens; user edits tokens and sees components update instantly

## Decision

The **live preview is the primary UX** for design token review and editing. The token editor is a secondary panel that the user consults when they want to change a specific value.

The preview renders:
- Sample buttons (primary, secondary, destructive)
- A card with header/body/footer
- A form with input fields and checkboxes
- A color palette grid
- A typography scale demonstration

All components update within milliseconds of a token edit (the CSS custom property system drives updates client-side). The user can toggle light/dark to see both themes side-by-side.

The token editor panel is visible but secondary: it shows the full token tree, allows direct value editing, and shows accessibility badges. It's accessed when the user knows which token to change, not as the starting point for review.

## Consequences

**Better:**
- Users evaluate design correctness visually, not abstractly; this matches how design decisions are actually made
- Issues (e.g., low contrast, wrong border radius feel) are immediately visible without mental mapping from token values to visual output
- The live preview de-risks acceptance criteria: a user who approves token set X has seen how it actually looks on sample components

**Worse:**
- Sample components are not the user's actual components (those come in Stage 6); some users may be confused by the discrepancy
- The preview renders a fixed set of components; unusual design systems (e.g., heavy illustration-based) may feel underrepresented
- More implementation complexity than a simple token table

**Neutral:**
- The preview components are platform-defined reference points, explicitly documented as such; Stage 6 produces the actual app components
- Performance requirement: preview updates must be < 100ms; achieved via CSS custom property injection (no React re-render needed for token value changes)

## Alternatives Considered

- **Token table only** — rejected; abstract values don't enable visual judgment; user adoption of the token stage drops significantly without visual feedback
- **Embed the user's own components** — not feasible at Stage 3 (Stage 6 hasn't run yet); the platform uses representative sample components instead
- **Rendered iframe from the generated app** — considered for a future iteration; requires Stage 6 to complete first; deferred
