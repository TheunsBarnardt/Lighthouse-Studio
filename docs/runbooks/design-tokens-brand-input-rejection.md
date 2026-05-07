# Runbook: Design Tokens Brand Input Rejection

**Trigger:** User-provided brand colors cannot be made accessible; they conflict with WCAG AA requirements.

## Symptoms

- User locks a brand color (e.g., a bright yellow `#ffd700` as primary)
- Token generation produces WCAG AA failures for that color as text
- The platform surfaces an accessibility failure that the user cannot resolve without unlocking the color

## Understanding the Problem

Yellow (`#ffd700`) has high luminance (~0.74). Against white backgrounds, any text using this color will fail WCAG AA because the contrast is insufficient. The color is fine as a background (with dark text on top), but not as text/icon color.

This isn't a platform bug — it's a fundamental accessibility constraint. The platform must communicate this clearly.

## Investigation

### 1. Identify the specific failure

```typescript
import { contrastRatio } from 'packages/core/src/services/ai/design-tokens/accessibility-validator.js';
const ratio = contrastRatio('#ffd700', '#ffffff');
// e.g., 1.07 — fails dramatically
```

### 2. Determine intended use

Ask (via support): is the brand color intended as:
- A **background** color (e.g., a yellow CTA button with black text) — this may be fine
- A **text** color (e.g., yellow labels on white) — this will fail

### 3. Suggest alternatives

For the customer, the options are:

**Option A: Use the brand color as a background only**
- Primary button: yellow background + near-black text (good contrast)
- The platform generates the dark text color automatically

**Option B: Use a darker shade of the brand color for text**
- Brand yellow `#ffd700` → shade 700 or 800 for text (~`#92400e` for amber-family)
- May not preserve brand identity

**Option C: Acknowledge the override**
- The platform allows the user to explicitly override accessibility failures
- This should be documented with a comment in the token export

## Platform Response

The override UX in `DesignTokensPage.tsx` shows a modal when the user acknowledges an AA failure. This is recorded as `ai.design_tokens.accessibility_failure_overridden` in the audit log.

Customers who override can always return to the token editor and change colors later.

## Prevention

- The brand input form can proactively warn when a locked color is unlikely to meet AA as a primary text color (detect if luminance > 0.6)
- Add a tooltip: "This color may not meet contrast requirements for text use"
