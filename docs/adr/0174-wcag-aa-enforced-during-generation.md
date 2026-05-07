# ADR-0174: WCAG AA Enforced During Generation

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 23 (Stage 3: Design Tokens)

## Context

WCAG AA requires a contrast ratio of at least 4.5:1 for normal text. Many design systems fail this check — especially when brand colors are used as text colors without validation. Violations are typically discovered at QA time or after launch, not at design time.

The question is when in the pipeline to enforce contrast: during AI generation (adjusting candidates before presenting them), or after generation as a warning layer.

## Decision

WCAG AA is **enforced during generation**, not as a post-hoc warning.

After each category prompt runs, the platform validates all critical text/background contrast pairs using WCAG 2.2 luminance calculations. If failures exist:
1. The AI re-runs with the failure information and produces adjusted colors
2. If the AI cannot fix failures (e.g., a locked brand color inherently fails AA), the platform surfaces the specific failure with an explanation
3. The user can override accessibility failures only via **explicit acknowledgment** — a modal that explains the failure and requires confirmation

The user sees inline accessibility badges (AA ✓, AA ✗) on every color token in the editor panel.

## Consequences

**Better:**
- Generated tokens are accessible by default; the most common path produces AA-compliant tokens
- Accessibility failures are caught at design time, not QA or launch
- The user is never silently opted into inaccessible designs

**Worse:**
- Generation is slightly more complex (validate → potentially retry → surface failures)
- Brand colors that fail AA (common with some brand palettes) create friction; the user must acknowledge overrides
- Some legitimate cases (decorative elements, large text) need AA waivers — these are surfaced but require user action

**Neutral:**
- The explicit override mechanism meets WCAG guidance that accessibility isn't always mandatory (e.g., decorative elements); the user decides, not the platform

## Alternatives Considered

- **Post-generation warning only** — rejected; most users won't read warnings; violations ship to production
- **AAA enforced** — considered but rejected; AAA (7:1) is too restrictive for many palettes; brands with saturated primaries cannot meet AAA while maintaining brand identity
- **No enforcement, user's responsibility** — rejected; the platform explicitly commits to accessibility-first design outputs
