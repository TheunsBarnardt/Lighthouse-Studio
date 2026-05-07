# Runbook: Design Tokens Accessibility Storm

**Trigger:** Multiple workspaces reporting WCAG AA failures after token generation; failure rate spikes in monitoring.

## Symptoms

- `ai.design_tokens.accessibility_check_run` events show `failCount > 0` at high rate
- Users report "my generated colors are flagged as inaccessible"
- Support tickets reference specific hues or brand colors that consistently fail

## Investigation

### 1. Determine scope

```sql
-- Postgres: recent accessibility check results
SELECT meta->>'passCount' AS pass, meta->>'failCount' AS fail, created_at
FROM audit_events
WHERE event = 'ai.design_tokens.accessibility_check_run'
ORDER BY created_at DESC
LIMIT 100;
```

Check if failures cluster around specific:
- Brand color hues (e.g., yellow/orange consistently fails at 500 shade)
- Vibe descriptors ("vibrant", "bold" → prompts may generate high-saturation primaries)
- Time window (prompt regression after a model update?)

### 2. Test the OKLCH generation

Run the accessibility validator against the failing token set manually:

```typescript
import { validateTokenSetAccessibility } from 'packages/core/src/services/ai/design-tokens/accessibility-validator.js';
// Load the failing artifact's tokenSet and pass it
const report = validateTokenSetAccessibility(tokenSet);
console.log(report.results.filter(r => !r.wcagAaPass));
```

### 3. Check if it's a prompt regression

Compare the current color palette prompt output against the golden test inputs. If the prompt is returning colors that were previously valid, a model update may have changed behavior.

```bash
pnpm test packages/core --grep "color-palette"
```

### 4. Check OKLCH conversion

Edge cases in OKLCH conversion can produce unexpected hex values. Run:

```typescript
import { generateColorScale } from 'packages/core/src/services/ai/design-tokens/oklch.js';
const scale = generateColorScale('#ff9500'); // Orange — common failure case
console.log(scale);
```

Verify shade 600–800 are dark enough for white text (lightness < 0.45).

## Remediation

### Option A: Prompt adjustment

If the AI is generating colors with insufficient lightness contrast, update the system prompt in `color-palette.prompt.ts` to reinforce the lightness constraints:

- Light theme content: OKLCH lightness < 0.35 for AA on white surfaces
- Dark theme content: OKLCH lightness > 0.75 for AA on dark surfaces

### Option B: Post-generation adjustment

If a specific hue range consistently fails, apply a lightness clamp in `generateColorScale()`:

```typescript
// Clamp dark shades to ensure sufficient lightness contrast
const clampedL = shade in ['600', '700', '800', '900'] ? Math.min(l, 0.42) : l;
```

### Option C: User communication

If failures are expected (locked brand colors that inherently fail AA), ensure the override UX is visible. The `ACCESSIBILITY_FAILURE_OVERRIDDEN` audit event tracks user acknowledgments.

## Prevention

- Monitor the ratio `failCount / (passCount + failCount)` per workspace in Grafana
- Alert when the ratio exceeds 0.2 across any 1-hour window
- Run the golden test suite against new model versions before enabling in production
