# Design Tokens Guide (Stage 3)

Design Tokens is Stage 3 of the AI Build Pipeline. It takes an approved PRD plus brand inputs and produces a complete **Design Token Set** — the visual language used by Stage 6 (UI Generation) to produce consistent components.

---

## Prerequisites

- A PRD in **Fully Approved** status (all 13 sections approved)
- Navigate to **AI Pipeline → Design Tokens** to begin

---

## Brand Inputs

When you start Stage 3, you'll provide brand inputs:

### Vibe Descriptors (required)
Choose 3–5 words that describe how your product should feel:

- **Professional** — corporate, trustworthy, reliable
- **Playful** — friendly, fun, approachable
- **Minimalist** — clean, focused, simple
- **Bold** — confident, impactful, strong
- **Warm** — friendly, human, inviting
- **Modern** — forward-looking, innovative, fresh

These guide color palette, typography choices, border radius, and motion tokens.

### Brand Colors (optional)
Add 1–3 hex colors from your brand guidelines. For each:
- Give it a name (e.g., "Brand Blue")
- Enable **Lock** if the color must appear exactly as specified in the primary scale

Locked colors are sacred — the AI works around them rather than adjusting them for accessibility.

> **Note:** If a locked color fails WCAG AA contrast requirements, the platform will flag it and ask you to acknowledge the override.

### Reference URLs (optional)
Add up to 3 URLs of websites or apps whose visual style you'd like to reference. The AI analyzes the visual style as inspiration — not to copy, but to understand the feel you're going for.

---

## Generating Tokens

Click **Generate Design Tokens**. Generation typically takes 1–3 minutes.

The AI generates all categories in sequence:
1. Color palette (semantic colors + light/dark surfaces)
2. Typography (families, scale, weights)
3. Spacing scale
4. Sizing (icons, avatars, containers)
5. Border radius
6. Shadows
7. Motion (durations, easings)
8. Z-index layers
9. Breakpoints

---

## Reviewing Tokens

The review interface has two main areas:

### Preview Panel (left)
Shows sample components rendered with the current tokens:
- Color palette grid
- Buttons (primary, secondary, destructive)
- A card with header/body/footer
- A form with inputs and checkboxes
- Typography scale demonstration

Toggle **Light/Dark** in the toolbar to see both themes.

### Token Editor (right)
Browse and edit any token directly. Categories are collapsible. Each token shows:
- A color swatch (for color tokens)
- The current value
- WCAG AA/AAA status for contrast-sensitive tokens

**Double-click any value** to edit it. Changes update the preview instantly.

---

## Accessibility Indicators

Every color token shows its accessibility status:

| Badge | Meaning |
|-------|---------|
| AA ✓ | Passes WCAG AA (≥ 4.5:1 contrast) |
| AA ✗ | Fails WCAG AA — action required |
| AAA ✓ | Passes WCAG AAA (≥ 7.0:1 contrast) |

The toolbar shows an overall pass rate (e.g., "WCAG AA: 6/6").

To override a failing check, click the warning badge and acknowledge the override. This is recorded in the audit log.

---

## Regenerating Tokens

### Regenerate a Category
Click the ↻ icon next to any category name in the Token Editor, or choose **Regenerate All → [Category]** from the toolbar. Provide optional feedback:

> *"More muted blues, less saturated"*
> *"Rounder corners — this feels too sharp"*

Only the selected category changes; all other tokens are preserved.

### Regenerate All
Click **Regenerate All** in the toolbar. Provide feedback to guide the full regeneration. All tokens are replaced with a fresh generation informed by your feedback.

Each regeneration creates a new artifact version. Old versions are preserved.

---

## Exporting Tokens

Click **Export** to download the token set in your preferred format:

| Format | Use case |
|--------|---------|
| **CSS Variables** | Drop into any stylesheet |
| **Tailwind Config** | Complete `tailwind.config.js` |
| **JSON (W3C DTCG)** | Works with Style Dictionary, Figma plugins |
| **TypeScript** | CSS-in-JS or direct import |

---

## Submitting for Approval

Once satisfied with the tokens:

1. Click **Submit for Approval**
2. Approvers in your workspace receive a notification
3. In solo workspaces, your submission is immediately approved
4. Once approved, tokens feed into Stage 6 (UI Generation)

---

## What Comes Next

With approved design tokens, you can proceed to:

- **Stage 4: Schema Synthesis** — database schema from the PRD
- **Stage 6: UI Generation** — components generated using these tokens

---

## Cost

Design token generation typically costs **$0.50–$2.00**. Cost is tracked per workspace in the usage dashboard.

---

## Frequently Asked Questions

**Q: Can I use custom fonts?**
A: Yes. In the brand input form, enter a font family name in the "Typography" section. If it's a web font (Google Fonts or custom), add the appropriate font loading configuration to your app.

**Q: What if my brand color fails accessibility?**
A: The platform flags it with a warning and shows which contrast pairs fail. You can either unlock the color (let the AI suggest adjustments) or explicitly acknowledge the override. The audit log tracks overrides.

**Q: Can I mix AI generation and manual edits?**
A: Yes. Generate the initial set, then manually edit individual tokens in the Token Editor. Your manual edits are preserved if you regenerate only specific categories.

**Q: How do I revert to a previous version?**
A: Go to the artifact version history (accessible from the artifact detail page). Select a previous version to restore it.
