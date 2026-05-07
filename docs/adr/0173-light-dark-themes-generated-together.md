# ADR-0173: Light + Dark Themes Generated Together

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 23 (Stage 3: Design Tokens)

## Context

Many products add dark mode as an afterthought: the light theme is designed first, then dark mode is created by inverting or adjusting colors post-hoc. This approach produces dark themes that feel like light themes with the lights off rather than intentionally designed for low-light contexts.

The platform generates design tokens from brand inputs and PRD context. The question is whether light and dark themes should be:
1. Generated in separate requests (one at a time, then compared), or
2. Generated together in a single pass, with both themes being first-class outputs

## Decision

Generate **light and dark themes together** in a single color generation pass.

The color palette prompt receives brand inputs once and returns semantic surface/content tokens for both themes simultaneously. The AI considers both themes coherently:

- Light: surfaces at 95–100% OKLCH lightness; content at 10–30%; primary at ~55% lightness
- Dark: surfaces at 5–15% OKLCH lightness; content at 80–95%; primary identity preserved, often slightly desaturated

Both themes reference the same semantic color scales. The relationship is intentional, not mechanical.

## Consequences

**Better:**
- Dark mode is never an afterthought; it passes WCAG AA from the start
- The AI can optimize both themes coherently (e.g., if the primary is too dark for dark mode, it adjusts the dark theme variant)
- Users see both themes side-by-side in the preview; the live preview toggle is a first-class interaction

**Worse:**
- The color palette prompt is more complex; it must understand both light and dark surface semantics
- Regenerating one theme without touching the other is harder (partial regeneration routes to the regeneration prompt with explicit theme constraint)

**Neutral:**
- The export formats (CSS, Tailwind, JSON) naturally support multiple themes via CSS class selectors or separate variable sets

## Alternatives Considered

- **Sequential generation** (light first, dark derived) — rejected; dark theme ends up being a mechanical transformation rather than an intentional design decision
- **User chooses which theme to generate** — rejected; dark mode omission is a UX debt; both are mandatory outputs
- **Single "adaptive" palette** — considered; some design systems use a single adaptive palette that the platform maps to light/dark; this works for simple cases but loses the ability to express meaningfully different surface hierarchies per theme
