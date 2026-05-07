# ADR-0175: DTCG as Canonical Token Format

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 23 (Stage 3: Design Tokens)

## Context

The design token ecosystem has historically lacked a standard interchange format. Tools (Figma, Style Dictionary, Theo, etc.) each had proprietary formats. The W3C Design Tokens Community Group (DTCG) published a draft specification (and later a formal working draft) that has gained broad adoption across major tools.

The platform needs to choose an internal canonical format for design tokens that:
1. Is machine-readable and cross-tool compatible
2. Supports metadata ($type, $description) alongside values
3. Can be exported to CSS, Tailwind, and other targets deterministically

## Decision

Use the **W3C Design Tokens Community Group (DTCG) format** as the canonical JSON representation for design token export.

Internally, tokens are stored as structured TypeScript objects (the `DesignTokenSet` schema). The DTCG format is the output of the `JsonDtcgExporter`. Every token is represented as:

```json
{
  "$value": "#3b82f6",
  "$type": "color",
  "$description": "Primary brand color, shade 500"
}
```

Groups are plain JSON objects containing token objects.

## Consequences

**Better:**
- The JSON export works with Figma plugins (Tokens Studio), Style Dictionary, and other DTCG-compatible tools without conversion
- The format is self-describing ($type enables tooling to validate and transform correctly)
- Future additions (e.g., composite token types like typography) map naturally to DTCG

**Worse:**
- DTCG is still a draft spec (W3C working draft); minor schema revisions may require exporter updates
- Customers using older tools may need to convert from DTCG; this is an uncommon edge case

**Neutral:**
- The internal TypeScript/zod schema does not mirror DTCG exactly; the exporter handles the transformation; internal and external representations are deliberately separate

## Alternatives Considered

- **Theo format** — legacy; less tooling support than DTCG in 2026
- **Style Dictionary format** — popular but not a standard; DTCG is increasingly the basis for Style Dictionary v4
- **Custom platform format** — rejected; vendor lock-in with no benefit; DTCG achieves the same goals with broad tooling support
