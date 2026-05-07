# Runbook: Design Tokens Color Conversion Issue

**Trigger:** Colors appearing wrong in preview or export; hex values look incorrect relative to expected hue.

## Symptoms

- Preview shows unexpected colors (e.g., primary shows as greenish when brand input was blue)
- Exported CSS variables have unexpected hex values
- OKLCH shade generation produces colors with unexpected hue shifts

## Common Root Causes

### 1. NaN in OKLCH conversion

The `hexToOklch()` function can produce NaN for edge-case colors (pure black `#000000`, pure white `#ffffff`, or colors with hex values outside valid range).

**Debug:**
```typescript
import { hexToOklch, oklchToHex } from 'packages/core/src/services/ai/design-tokens/oklch.js';
const oklch = hexToOklch('#000000');
console.log(oklch); // { l: 0, c: 0, h: NaN } — hue is undefined for achromatic colors
```

**Fix:** Guard against `c === 0` in `generateColorScale()` — achromatic colors have no meaningful hue; use h=0 as fallback and set c=0 for all shades.

### 2. Chroma clamping produces desaturation

For highly saturated inputs, the `chromaFactor` at extreme shades (0.97 lightness) may produce chroma values that map to out-of-gamut sRGB, causing clamping in `oklchToHex()`. The resulting hex is in-gamut but visually different.

**Debug:**
```typescript
import { oklchToHex } from 'packages/core/src/services/ai/design-tokens/oklch.js';
// Try with high chroma
console.log(oklchToHex({ l: 0.97, c: 0.3, h: 30 })); // Orange at near-white lightness
```

Inspect whether r/g/b values were clamped (check if they were at 0 or 1 before clamping).

**Fix:** Reduce chroma more aggressively at extreme lightness stops, or implement chroma binary search to find the maximum in-gamut chroma at each lightness.

### 3. Hex input with invalid format

Inputs like `#RGB` (3-digit) or `#RRGGBBAA` (8-digit) will produce garbage from `parseInt(hex.slice(1, 3))`.

**Debug:** Add input validation to `hexToOklch()`:

```typescript
if (!/^#[0-9a-fA-F]{6}$/.test(hex)) throw new Error(`Invalid hex: ${hex}`);
```

### 4. Brand color in wrong format

The AI may return a color in a non-hex format (e.g., `rgb(59, 130, 246)` or `hsl(217, 91%, 60%)`). The color palette prompt's output schema enforces hex regex, but a model hallucination can produce invalid output that passes the regex imperfectly.

**Debug:** Check the raw AI output before schema validation in `GenerationService.run()`.

## Remediation

1. Add the hex validation guard to `hexToOklch()`
2. Add a test case for achromatic colors (`#000000`, `#ffffff`, `#808080`)
3. Add a test case for highly saturated colors (`#ff0000`, `#00ff00`, `#0000ff`)
4. For production incidents, the workaround is to re-generate with a slightly different brand color (e.g., `#2561eb` instead of `#2563eb`) to avoid the edge case

## Prevention

- Unit tests for all edge cases are in `oklch.test.ts`
- Integration test generates a token set with a highly saturated input and validates hex format of all 9 shades
