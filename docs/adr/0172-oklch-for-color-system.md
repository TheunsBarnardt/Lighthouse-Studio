# ADR-0172: OKLCH for Color System

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 23 (Stage 3: Design Tokens)

## Context

When generating color scales programmatically (9-step palettes from a base color), the choice of color space determines whether the resulting scale feels intentional or muddy. The most common approaches are:

- **RGB lightening/darkening** — fast, simple, universally understood, but produces perceptually uneven steps and hue shifts at extremes
- **HSL** — better than RGB, but lightness in HSL doesn't map to perceived lightness; results are often surprising at high saturation
- **OKLCH** (Oklab-based lightness, chroma, hue) — a perceptually uniform color space designed for programmatic color manipulation; even perceptual steps, no hue drift, stable chroma

The platform generates 9-shade scales from a single base color, then validates WCAG AA contrast at each shade against likely backgrounds. The quality of these scales directly determines whether users accept the AI-generated tokens without manual correction.

## Decision

Use **OKLCH** as the internal color space for all scale generation and manipulation.

- Base colors (from brand inputs or AI generation) are converted from hex to OKLCH
- Scale generation varies lightness along fixed stops (0.97 → 0.25) while preserving chroma and hue
- Chroma is reduced slightly at extremes to prevent overly saturated light/dark shades
- Output is converted back to hex for compatibility with CSS and all downstream tooling
- The OKLCH source values are retained for precision round-tripping

## Consequences

**Better:**
- Color scales look intentional across all 9 shades
- Hue is stable from light to dark (no orange-to-red drift at extremes)
- WCAG contrast checks on the generated shades have predictable outcomes
- Designers who see the output find it more "correct" than HSL-based equivalents

**Worse:**
- OKLCH is not universally supported as a CSS value in older browsers (but we output hex, so this doesn't affect runtime compatibility)
- The conversion math is non-trivial; the implementation is a custom module (`oklch.ts`) rather than a trivial utility
- Edge cases exist (highly saturated colors near the perceptual boundary may require chroma clamping)

**Neutral:**
- The `culori` library is the production-grade alternative; the current `oklch.ts` implementation is sufficient for scale generation and is drop-in replaceable

## Alternatives Considered

- **HSL** — rejected; HSL lightness is not perceptual; known to produce muddy greens and hue-shifted blues at extremes
- **RGB** — rejected; even worse than HSL for perceptual uniformity
- **Lab/LCH** — considered; OKLCH is the modern successor and has better numerical properties for the saturation range we use
- **Delegating to `culori`** — considered; left as upgrade path; `culori` adds ~15 KB gzip; the current implementation covers our use case with no external dependency
