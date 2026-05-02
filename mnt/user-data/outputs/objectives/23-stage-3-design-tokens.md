# Objective 23: Stage 3 — Design Tokens

**Status:** Ready for development
**Prerequisites:** Objectives 20 (AI Pipeline Foundation), 22 (Stage 2: PRD Generation) complete
**Blocks:** Objective 26 (Stage 6: UI Generation — consumes design tokens directly)

---

## 1. Purpose

Take an approved PRD plus brand inputs (logo, colors, vibe descriptors) and produce a structured **Design Token Set** — the visual language that Stage 6 (UI Generation) will use to generate consistent components. Design tokens are the abstraction layer between "we want it to feel professional and trustworthy" and "use #2563eb at 16px Inter Medium."

The token set is structured, machine-readable, and complete enough that Stage 6 can produce a coherent UI without any further design decisions. It's also human-reviewable: a designer or stakeholder can look at the tokens and know what the resulting UI will feel like before any components are generated.

This stage is unique in the pipeline: it's the only stage where **visual judgment** is central. The AI's output isn't text or code — it's a palette, a typography scale, a spacing rhythm. The user reviews not by reading but by seeing. The platform's UI shows live previews of every token decision; rejecting a color isn't "comment on this paragraph" but "this red feels wrong, try something more muted."

This objective produces **the visual foundation** of every UI the platform generates. Get it right, and the resulting apps feel intentional. Get it wrong, and even well-coded apps feel like AI slop.

---

## 2. Scope

### In Scope

- **Design Token Set artifact type**: structured schema for the complete visual language
- **Token categories**: colors (semantic + scale), typography (families, scales, weights), spacing scale, sizing scale, border radius, shadows, motion (durations, easings), z-index layers, breakpoints
- **Brand input collection**: logo upload, hex colors, vibe descriptors, reference inspirations
- **AI generation of token sets** from PRD + brand input
- **Live preview UI**: a sample interface rendered with the tokens; updates as tokens change
- **Component-level previews**: button, card, form, modal, navigation — rendered with current tokens
- **Token editing**: each token directly editable; constraint validation (contrast ratios, scale ratios)
- **Accessibility validation**: WCAG AA contrast checks; warnings for failures
- **Multiple theme support**: light theme + dark theme generated together
- **Token export formats**: CSS variables, Tailwind config, design system JSON, Figma tokens (compatible format)
- **Approval routing per workspace's `design_tokens` configuration**
- **Iterative refinement**: regenerate full set or refine specific token groups
- **Quality signals specific to design**: accessibility pass rate, downstream UI rejection rate
- ADRs

### Out of Scope (Belongs to Later Objectives)

- Component implementation (lives in Stage 6: UI Generation)
- Page layouts / wireframes (Stage 6)
- Icon set generation (deferred; the platform uses an established icon library — Lucide — and customers can override)
- Custom illustration generation (deferred; out of scope)
- Animation choreography beyond duration/easing tokens (Stage 6 uses these)
- Brand strategy / logo design (the user provides; the platform doesn't generate logos)
- Per-page custom design (the design language is project-wide; per-page variation lives in Stage 6 with the same tokens)
- A/B testing of design variants (deferred)

---

## 3. Locked Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Token format | W3C Design Tokens Community Group format (DTCG) | Industry standard; cross-tool compatible |
| Color system | OKLCH for semantic generation; converts to RGB/hex for output | Perceptually uniform; better for accessible scales |
| Typography | System font stacks by default; Google Fonts as opt-in (no auto-bundle) | Performance; predictable rendering; privacy |
| Spacing scale | Modular scale (1.5 ratio default); tokens at 0, 1, 2, 3, ... 12 | Visual rhythm; downstream-predictable |
| Theme support | Light + dark generated together; not separately | Equal treatment; reduces post-hoc dark-mode work |
| Color contrast | WCAG AA enforced; AAA preferred where possible | Accessibility is non-negotiable |
| Token count per category | Fixed counts (12 spacing values, 9 color shades per palette, etc.) | Predictability for downstream |
| Brand input handling | Logo + hex colors + 3-5 vibe descriptors + optional reference URLs | Enough signal without prescription |
| Live preview library | A small set of platform-defined sample components (button, card, form, etc.) | Consistent reference points |
| Editing UX | Token-by-token editing; bulk edit via "regenerate this category" | Direct manipulation + AI assistance |
| Accessibility tooling | Color-contrast validation built in; warnings inline | Caught at design time, not deployment |
| Export targets | CSS variables, Tailwind config, JSON | Common consumers |
| Cost target | $0.50–$2.00 per generation | Cost-aware |

---

## 4. Architectural Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                  APPROVED PRD + BRAND INPUTS                          │
│        (PRD from Stage 2; brand inputs from user)                     │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│                  DESIGN TOKEN GENERATION SERVICE                      │
│                                                                       │
│   Per-category prompts:                                               │
│   - color_palette (semantic + scale, light + dark)                    │
│   - typography (families, scales)                                     │
│   - spacing (modular scale)                                           │
│   - sizing                                                            │
│   - border_radius                                                     │
│   - shadows                                                           │
│   - motion                                                            │
│                                                                       │
│   Validation: accessibility check, scale consistency check            │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
                ┌────────────────────────┐
                │   Design Token Set      │
                │  - All categories       │
                │  - Light + dark themes   │
                │  - Validated for AA      │
                │  - Reasoning captured    │
                └─────────────────────────┘
                             │
                             ▼
                ┌────────────────────────┐
                │   Live Preview UI        │
                │  - Sample components     │
                │  - Real-time updates     │
                │  - Token-by-token edit   │
                │  - Accessibility flags   │
                └─────────────────────────┘
                             │
                             ▼
                  Input to Stage 6 (UI Generation)
                  + exportable to Tailwind, CSS, etc.
```

---

## 5. The Hard Parts

**5.1 Color systems and OKLCH**

Choosing colors that look good at every shade is hard. Naive approaches (lightening/darkening RGB) produce muddy mid-tones and unintended hue shifts. The platform uses OKLCH (a perceptually uniform color space):

- The AI generates a base color in hex (typically from the brand input)
- The platform converts to OKLCH
- Generates a 9-step scale (50, 100, 200, ... 900) by varying lightness while preserving chroma and hue
- Validates each step against WCAG AA on appropriate backgrounds
- Adjusts chroma when AA fails (some hues can't reach AA at certain lightness; the platform compensates)
- Outputs both OKLCH (for source-of-truth) and hex/RGB (for compatibility)

This produces palettes that feel intentional and pass accessibility checks. The customer sees just the colors; the OKLCH machinery is internal.

**5.2 Light and dark themes generated together**

Many products treat dark mode as an afterthought — the design works for light theme; dark theme is a hasty inversion. The platform generates them together from the start:

- Light theme: surface colors at 95-100% lightness; content colors at 10-30%; primary at 50% lightness
- Dark theme: surface colors at 5-15% lightness; content colors at 80-95%; primary preserves identity (often slightly desaturated)
- Both pass accessibility checks
- The relationship is intentional, not mechanical

This means the brand input informs both themes simultaneously. A user iterating on the primary color sees light + dark side by side; both update.

**5.3 The live preview UI**

This is the user's primary interface. Token decisions are abstract; visual previews are concrete. The preview shows:

- A button (primary, secondary, destructive variants)
- A card with header, body, footer
- A form with input, select, textarea, checkbox, radio
- A modal/dialog
- A navigation bar
- Text samples at every typography scale
- A color palette grid
- A spacing scale demonstration

Each component is rendered with the current token values. Editing a token updates every component using it within milliseconds. The user can toggle light/dark to see both themes.

The components are NOT what Stage 6 will generate — they're reference points. Stage 6 generates components specific to the customer's PRD (a CRM has different components than a blog). But these reference components let the user evaluate the token system itself.

**5.4 Token editing UX**

Each token is directly editable in a side panel. Color tokens have a color picker; typography tokens have font/weight/size selectors; spacing tokens have a numeric input.

Edits are validated:
- Color edits trigger contrast re-checks against backgrounds; failures shown as warnings
- Spacing edits respect the modular scale (the user can override but is warned about scale breakage)
- Typography edits respect the type scale

For larger changes, the user can request "regenerate this category" — the AI re-runs that category's prompt with the user's feedback ("more muted colors" or "smaller spacing scale"). The other categories aren't touched.

**5.5 Brand inputs that aren't constraints**

The user provides:
- Logo (uploaded image)
- 1-3 brand colors (hex, optional)
- 3-5 vibe descriptors ("professional", "playful", "trustworthy", "modern", etc.)
- Optional reference URLs (websites whose feel they like)

These inform generation but don't dictate it. The AI may suggest colors that aren't the brand colors (because the brand colors might be inaccessible at scale, or because the brand has primary brand colors that aren't UI colors). The AI explains its choices via reasoning.

The user can lock specific brand colors as "must use exactly these for primary." The AI respects the lock and works around it.

For workspaces without a brand (early-stage projects), the user can skip brand inputs; the AI generates a sensible default palette.

**5.6 Accessibility validation as part of generation, not after**

WCAG AA contrast checks happen during generation, not as a post-hoc warning. The flow:

- AI generates a candidate color scale
- Platform validates contrast ratios for every text/background pairing
- Failures: AI either adjusts (preferred) or surfaces the issue ("primary on light surface fails AA; needs darker primary or lighter contrast")
- User sees the validation status inline; can override only with explicit acknowledgment

This means tokens that ship are accessible. The user can override accessibility (some marketing sites don't care; most do) but it's an explicit action, not a default.

**5.7 Scale consistency**

Spacing, typography, and sizing scales should be consistent: the spacing between rhythm units should match the typography scale's leading; sizing tokens should align with spacing tokens. The platform enforces this:

- A consistency-check prompt runs after all categories generate
- It identifies misalignments ("your typography scale uses 1.25 ratio but spacing uses 1.5")
- Surfaces as warnings; user can adjust or accept

Strict mathematical consistency isn't the goal (some designs benefit from varied rhythms). But the user sees the relationships and decides.

**5.8 Export formats — meet customers where they are**

Customers using Tailwind want a tailwind.config.js. Customers using vanilla CSS want CSS variables. Customers using Figma want their tokens-compatible JSON. The platform exports all three:

- **CSS variables**: ready to drop into a stylesheet
- **Tailwind config**: a complete config file with the platform's tokens as Tailwind values
- **JSON (DTCG format)**: usable by tools like Style Dictionary, Theo, or Figma plugins
- **TypeScript constants**: for projects using CSS-in-JS

Each format is generated from the same underlying token set. Editing tokens updates all exports automatically.

**5.9 Iterating on design**

A common scenario: the user generates tokens, looks at the preview, doesn't like the feel. The platform offers:

- **Regenerate full set**: AI runs the full generation again with the user's feedback ("more energetic" or "more conservative")
- **Regenerate one category**: only the specified category is regenerated
- **Manual edits**: direct token editing
- **Reset to template**: discard all and start from a template

Each regeneration is a new artifact version (per Objective 20). Old versions are preserved; the user can compare or revert.

**5.10 Quality signals**

Beyond Objective 20's generic signals:

- **Accessibility pass rate**: did the generated tokens pass WCAG AA without manual override?
- **Edit volume after generation**: how much did the user edit?
- **Theme balance**: did the user reject only the light theme, only the dark, or both?
- **Downstream UI rejection rate**: did Stage 6 produce components that worked, or did the user complain "this UI doesn't match what I expected"?

These signals reveal which prompts produce design that matches user expectations vs. design that needs heavy manual intervention.

---

## 6. Component Specifications

### 6.1 DesignTokensService

```typescript
// packages/core/src/services/ai/design-tokens/design-tokens.service.ts

export class DesignTokensService {
  constructor(
    private readonly authz: AuthorizationPort,
    private readonly artifacts: ArtifactService,
    private readonly generation: GenerationService,
    private readonly pipeline: StagePipelineService,
    private readonly storage: StorageService,
    private readonly audit: AuditPort,
    private readonly logger: LoggerPort,
  ) {}

  /** Generate a token set from a PRD plus brand inputs. */
  async generateTokens(
    ctx: RequestContext,
    input: GenerateTokensInput,
  ): Promise<Result<Artifact<DesignTokenSet>, AppError>>;

  /** Get the current token set for a workspace. */
  async getTokens(
    ctx: RequestContext,
    artifactId: string,
  ): Promise<Result<Artifact<DesignTokenSet>, AppError>>;

  /** Edit a specific token. */
  async editToken(
    ctx: RequestContext,
    artifactId: string,
    tokenPath: string,
    newValue: TokenValue,
  ): Promise<Result<Artifact<DesignTokenSet>, AppError>>;

  /** Regenerate a category with feedback. */
  async regenerateCategory(
    ctx: RequestContext,
    artifactId: string,
    category: TokenCategory,
    feedback?: string,
  ): Promise<Result<Artifact<DesignTokenSet>, AppError>>;

  /** Regenerate the full token set. */
  async regenerateAll(
    ctx: RequestContext,
    artifactId: string,
    feedback?: string,
  ): Promise<Result<Artifact<DesignTokenSet>, AppError>>;

  /** Validate accessibility of the current set. */
  async validateAccessibility(
    ctx: RequestContext,
    artifactId: string,
  ): Promise<Result<AccessibilityReport, AppError>>;

  /** Export the token set in a specific format. */
  async export(
    ctx: RequestContext,
    artifactId: string,
    format: 'css' | 'tailwind' | 'json_dtcg' | 'typescript',
  ): Promise<Result<{ content: string; filename: string }, AppError>>;

  /** Submit for approval. */
  async submitForApproval(
    ctx: RequestContext,
    artifactId: string,
  ): Promise<Result<Artifact<DesignTokenSet>, AppError>>;
}
```

### 6.2 The Design Token Set Model

```typescript
interface DesignTokenSet {
  prdArtifactId: string;                    // parent
  brandInputs: BrandInputs;
  
  // Core token categories
  colors: ColorTokens;
  typography: TypographyTokens;
  spacing: SpacingTokens;
  sizing: SizingTokens;
  borderRadius: BorderRadiusTokens;
  shadows: ShadowTokens;
  motion: MotionTokens;
  zIndex: ZIndexTokens;
  breakpoints: BreakpointTokens;
  
  // Validation results
  accessibilityReport: AccessibilityReport;
  consistencyReport: ConsistencyReport;
}

interface BrandInputs {
  logoFileId?: string;
  brandColors?: { name: string; hex: string; locked: boolean }[];
  vibeDescriptors: string[];
  referenceUrls?: string[];
  notes?: string;
}

interface ColorTokens {
  // Semantic colors (the meaningful ones)
  semantic: {
    primary: ColorScale;
    secondary: ColorScale;
    success: ColorScale;
    warning: ColorScale;
    danger: ColorScale;
    info: ColorScale;
    // Surface and content
    surface: SurfaceColors;
    content: ContentColors;
    border: BorderColors;
  };
  // Themes
  themes: {
    light: ThemeColors;
    dark: ThemeColors;
  };
}

interface ColorScale {
  // 9-step scale
  '50': ColorValue;
  '100': ColorValue;
  '200': ColorValue;
  '300': ColorValue;
  '400': ColorValue;
  '500': ColorValue;   // base
  '600': ColorValue;
  '700': ColorValue;
  '800': ColorValue;
  '900': ColorValue;
}

interface ColorValue {
  oklch: { l: number; c: number; h: number };
  rgb: { r: number; g: number; b: number };
  hex: string;
}

interface TypographyTokens {
  families: {
    sans: string;
    serif: string;
    mono: string;
    display?: string;       // optional larger display font
  };
  scale: {
    // Modular scale
    xs: TypographyValue;
    sm: TypographyValue;
    base: TypographyValue;
    lg: TypographyValue;
    xl: TypographyValue;
    '2xl': TypographyValue;
    '3xl': TypographyValue;
    '4xl': TypographyValue;
    '5xl': TypographyValue;
    '6xl': TypographyValue;
  };
  weights: {
    light: number;
    regular: number;
    medium: number;
    semibold: number;
    bold: number;
  };
  lineHeights: {
    tight: number;
    snug: number;
    normal: number;
    relaxed: number;
    loose: number;
  };
  letterSpacings: {
    tight: string;
    normal: string;
    wide: string;
  };
}

interface TypographyValue {
  fontSize: string;        // rem
  lineHeight: string;
  letterSpacing?: string;
}

interface SpacingTokens {
  // 13-step modular scale (0, 1, 2, ... 12)
  '0': string;
  '1': string;
  '2': string;
  '3': string;
  '4': string;
  '5': string;
  '6': string;
  '8': string;
  '10': string;
  '12': string;
  '16': string;
  '20': string;
  '24': string;
}

// SizingTokens, BorderRadiusTokens, ShadowTokens, MotionTokens, etc. follow similar patterns
```

The shape is locked and exhaustive — every downstream stage knows what to expect.

### 6.3 The Generation Prompts

In `packages/core/src/ai/prompts/design-tokens/`:

- `color-palette.prompt.ts`         — generates semantic colors + scales for both themes
- `typography.prompt.ts`             — chooses families and scale ratios
- `spacing.prompt.ts`                — generates the spacing scale
- `sizing.prompt.ts`
- `border-radius.prompt.ts`
- `shadows.prompt.ts`
- `motion.prompt.ts`
- `accessibility-validation.prompt.ts` — verifies AA across pairings
- `consistency-validation.prompt.ts`   — checks scale alignment across categories
- `regeneration.prompt.ts`            — handles regeneration with feedback
- `orchestrator.prompt.ts`            — top-level for "generate full token set"

Each follows Objective 20's `definePrompt`. Each has test suites; CI verifies they produce valid token structures.

### 6.4 Color Palette Generation (Detailed)

The color palette prompt is the most complex. It receives:
- Brand colors (with locks)
- Vibe descriptors
- PRD context (project type, target users)
- Reference URLs (if provided; the platform fetches these and extracts visual cues via a separate analysis prompt)

It returns:
- Primary, secondary, success, warning, danger, info color scales
- Surface, content, border colors for both light and dark themes
- Reasoning explaining each choice

Behind the scenes:
- Brand colors are validated for accessibility at intended use cases
- Locked colors are anchored; the AI generates harmonious additions
- Generated scales use OKLCH for perceptual uniformity
- Both themes generated coherently

### 6.5 The Live Preview UI

Lives in `apps/web/src/ai-pipeline/design-tokens/`:

- `DesignTokensPage.tsx` — main page; layout shell
- `panels/PreviewPanel.tsx` — main panel; renders sample components with current tokens
- `panels/TokenEditorPanel.tsx` — right sidebar; token-by-token editing
- `panels/BrandInputsPanel.tsx` — initial brand input collection
- `views/ColorPaletteView.tsx`
- `views/TypographyScaleView.tsx`
- `views/SpacingScaleView.tsx`
- `components/SampleButton.tsx`
- `components/SampleCard.tsx`
- `components/SampleForm.tsx`
- `components/SampleModal.tsx`
- `components/SampleNavigation.tsx`
- `components/AccessibilityIndicator.tsx`     — inline AA/AAA badges
- `dialogs/RegenerateDialog.tsx`
- `dialogs/ExportDialog.tsx`
- `dialogs/ThemeSwitcher.tsx`               — toggles light/dark in preview

The preview renders by injecting current tokens into a CSS variable-based component library. As tokens change, components re-render instantly.

### 6.6 Brand Input Collection Flow

When the user starts Stage 3, they're prompted for brand inputs:

1. **Logo upload** (optional) — uses Objective 15's storage; the AI extracts dominant colors as suggested brand colors
2. **Brand colors** (optional) — hex inputs; with "lock" toggles
3. **Vibe descriptors** (required) — multi-select from a curated list ("professional", "playful", "minimalist", "bold", "warm", "trustworthy", etc.) plus free-text
4. **Reference URLs** (optional) — up to 3 URLs whose feel the user likes
5. **Project context** — auto-populated from the PRD (project type, target users)

After collection, the user clicks "Generate Design Tokens"; the AI runs the orchestrator and produces the initial set.

### 6.7 Accessibility Validation Logic

```typescript
// packages/core/src/services/ai/design-tokens/accessibility-validator.ts

export class AccessibilityValidator {
  validateContrast(foreground: ColorValue, background: ColorValue): ContrastResult;
  validateScale(scale: ColorScale): ColorScaleAccessibilityReport;
  validateThemes(set: DesignTokenSet): ThemeAccessibilityReport;
  generateRecommendation(failure: ContrastFailure): string;
}

interface ContrastResult {
  ratio: number;
  wcagAaPass: boolean;
  wcagAaaPass: boolean;
  largeTextOnly: boolean;     // some pairings only need to meet large-text contrast
}
```

Built on the WCAG 2.2 contrast formula. Used during generation (the AI retries failing colors) and during user editing (real-time warnings).

### 6.8 Export Format Implementations

```typescript
// packages/core/src/services/ai/design-tokens/exporters/

export interface TokenExporter {
  export(tokenSet: DesignTokenSet): { content: string; filename: string };
}

class CssExporter implements TokenExporter { /* generates :root { --color-primary-500: ...; } */ }
class TailwindExporter implements TokenExporter { /* generates tailwind.config.js content */ }
class JsonDtcgExporter implements TokenExporter { /* W3C DTCG format */ }
class TypeScriptExporter implements TokenExporter { /* exports as TS const declarations */ }
```

Each exporter is independently testable. Adding new formats (e.g., iOS-Swift, Android-Kotlin) is straightforward.

### 6.9 Audit Events

```
ai.design_tokens.set_generated
ai.design_tokens.token_edited
ai.design_tokens.category_regenerated
ai.design_tokens.full_set_regenerated
ai.design_tokens.accessibility_check_run
ai.design_tokens.accessibility_failure_overridden
ai.design_tokens.exported
ai.design_tokens.brand_input_updated
ai.design_tokens.submitted
ai.design_tokens.approved
ai.design_tokens.rejected
```

### 6.10 Permissions

```
ai.design_tokens.create
ai.design_tokens.read
ai.design_tokens.edit
ai.design_tokens.approve
ai.design_tokens.export
ai.design_tokens.delete
```

Default role mappings:
- `workspace_owner`, `workspace_admin`: all
- `designer` (new role; can be added or mapped to existing): all design tokens permissions
- `business_analyst`: read, approve
- `architect`, `developer`: read, export
- Custom roles configurable

### 6.11 Quality Signal Specifics

```typescript
interface DesignTokensQualitySignals {
  artifactId: string;
  
  // Generation
  initialAccessibilityPassRate: number;      // 0-1
  finalAccessibilityPassRate: number;
  accessibilityOverridesAccepted: number;
  
  // Editing
  totalTokenEdits: number;
  totalRegenerations: number;
  categoriesRegenerated: TokenCategory[];
  
  // Time
  totalTimeMinutes: number;
  
  // Approval
  approvedFirstSubmit: boolean;
  
  // Downstream
  causedDownstreamUiRejection: boolean;       // Stage 6 user flagged "doesn't match expected design"
}
```

### 6.12 Operational Runbooks

- `design-tokens-accessibility-storm.md` — many tokens failing AA; investigation
- `design-tokens-color-conversion-issue.md` — OKLCH-to-RGB conversion edge cases
- `design-tokens-export-format-change.md` — handling new export targets
- `design-tokens-brand-input-rejection.md` — when user-provided brand colors can't pass accessibility

---

## 7. Implementation Order

1. **Token schemas** locked in TypeScript types and zod.

2. **OKLCH conversion library integrated** (use `culori` or similar).

3. **Accessibility validator** with WCAG 2.2 contrast formulas.

4. **Per-category prompts** authored as `definePrompt` modules with test suites.

5. **Orchestrator prompt** running categories in order.

6. **DesignTokensService skeleton** — generateTokens, getTokens, editToken.

7. **Token persistence as artifacts** with type `design_token_set`.

8. **Brand input collection flow.**

9. **Accessibility validation integrated** into generation pipeline.

10. **Consistency validator** for cross-category alignment.

11. **Live preview UI** — sample components rendered with tokens.

12. **Token editor UI** — token-by-token editing with validation.

13. **Theme switcher** — toggle light/dark.

14. **Category regeneration with feedback.**

15. **Full regeneration with feedback.**

16. **Export formats** — CSS, Tailwind, JSON-DTCG, TypeScript.

17. **Stage pipeline integration** — submit → approval → approved.

18. **Quality signals recording.**

19. **Audit events emitted.**

20. **Conformance tests** across providers.

21. **End-to-end test**: PRD approved → tokens generated → AA pass → approved → exportable.

22. **Documentation, ADRs, runbooks.**

23. **Verify Definition of Done.**

---

## 8. ADRs to Write

- **ADR-0172: OKLCH for Color System** — perceptually uniform; better accessible scales
- **ADR-0173: Light + Dark Themes Generated Together** — dark mode as first-class, not afterthought
- **ADR-0174: WCAG AA Enforced During Generation** — accessibility is non-negotiable; explicit override required
- **ADR-0175: DTCG as Canonical Token Format** — industry standard; cross-tool compatibility
- **ADR-0176: System Font Stacks Default, Google Fonts Opt-In** — performance, privacy
- **ADR-0177: Live Preview as Primary UX** — visual judgment requires visual feedback

---

## 9. Verification Steps

1. **Generate tokens** from a PRD with brand inputs; complete token set produced.

2. **All categories present**: colors, typography, spacing, sizing, border radius, shadows, motion, z-index, breakpoints.

3. **Light + dark themes**: both generated; both pass AA.

4. **Color scales**: 9-step scales for each semantic color; accessible at intended pairings.

5. **OKLCH validation**: scales are perceptually uniform (visual inspection in tests).

6. **Brand colors honored**: locked colors appear exactly as specified.

7. **Brand colors that fail AA**: AI suggests adjustments; user can override.

8. **Live preview renders**: sample components display with current tokens.

9. **Theme switching**: toggle light/dark instantly updates all preview components.

10. **Token editing**: changing a color updates the preview within milliseconds.

11. **Accessibility warnings**: editing to an inaccessible value shows inline warning.

12. **Category regeneration**: regenerating "colors" with feedback "more muted" produces a different palette; other categories unchanged.

13. **Full regeneration**: regenerating full set replaces everything; user feedback respected.

14. **Export to CSS**: produces valid CSS variable declarations.

15. **Export to Tailwind**: produces a valid tailwind.config.js content.

16. **Export to JSON DTCG**: produces W3C-compatible JSON.

17. **Export to TypeScript**: produces typed const declarations.

18. **Reasoning visible**: user sees explanations for color choices, scale ratios, etc.

19. **Consistency check**: misaligned scales produce warnings.

20. **Submit for approval**: lifecycle transitions correctly.

21. **Approval (solo / enterprise)**: routes per workspace config.

22. **Stale on PRD change**: if upstream PRD is modified, design tokens artifact marked stale.

23. **Cross-database**: works on Postgres, MSSQL, Mongo workspaces.

24. **Audit events**: all lifecycle actions produce expected entries.

25. **Cost tracking**: generation cost recorded; aggregates per workspace.

26. **Performance**: full generation within 1–3 minutes; preview updates < 100ms.

If all 26 pass, the objective is met.

---

## 10. Definition of Done

**Schema & Types**
- [ ] DesignTokenSet schema locked
- [ ] All token category schemas
- [ ] Brand input schema

**Color System**
- [ ] OKLCH conversion library integrated
- [ ] Color scale generation
- [ ] Light + dark themes
- [ ] Accessibility validator

**Prompts**
- [ ] All category prompts authored with test suites
- [ ] Accessibility validation prompt
- [ ] Consistency validation prompt
- [ ] Regeneration prompt
- [ ] Orchestrator prompt

**Service Layer**
- [ ] DesignTokensService implemented
- [ ] All generation, editing, regeneration methods
- [ ] Accessibility validation integrated
- [ ] Stage pipeline integration

**UI**
- [ ] Brand input collection
- [ ] Live preview with sample components
- [ ] Token editor panel
- [ ] Theme switcher
- [ ] Accessibility indicators
- [ ] All dialogs (regenerate, export)

**Exports**
- [ ] CSS variables exporter
- [ ] Tailwind config exporter
- [ ] JSON DTCG exporter
- [ ] TypeScript exporter

**Quality & Observability**
- [ ] Quality signals recorded
- [ ] Per-prompt dashboards
- [ ] Stage-specific metrics

**Permissions**
- [ ] Stage permissions added
- [ ] Default role grants

**Cross-Database**
- [ ] Conformance tests pass on all three databases

**Documentation**
- [ ] ADRs 0172–0177 written and Accepted
- [ ] All runbooks in Section 6.12 written
- [ ] Customer-facing design tokens guide
- [ ] Token consumer documentation (for Stage 6)

**Verification**
- [ ] All 26 verification steps in Section 9 pass

---

## 11. Anti-Patterns to Refuse

- **Naive RGB color manipulation.** OKLCH for source-of-truth; convert at output time only.
- **Dark theme as a post-hoc inversion.** Light + dark generated together; both pass AA.
- **Skipping accessibility checks at design time.** AA is enforced; override is explicit.
- **Hardcoded font choices in the prompt output.** Font choices respect performance and privacy defaults.
- **Token output without reasoning.** Reasoning required per Objective 20.
- **Free-form token keys.** Token shape is locked; downstream stages depend on the keys.
- **Client-side OKLCH conversion in critical paths.** Conversion happens server-side; client receives ready-to-use values.
- **Regenerating tokens without preserving brand locks.** Locked brand colors are sacred.
- **Auto-progressing to Stage 6.** User explicitly transitions.
- **Silent fallback when accessibility can't be achieved.** AI surfaces the conflict; user decides.

---

## 12. Open Questions for Confirmation Before Starting

1. **OKLCH vs. HSL vs. LAB** — proposing OKLCH. Recommendation: OKLCH for modern browser support and perceptual uniformity.

2. **System fonts default** — proposing yes; Google Fonts opt-in. Some customers will want custom fonts. Recommendation: system default; custom fonts via brand input config.

3. **Token category set** — locked at the categories listed. Worth adding more (e.g., illustration tokens, icon sizes)? Recommendation: ship locked; expand based on Stage 6 needs.

4. **Scale ratios** — proposing 1.5 for spacing, 1.25 for typography. User-overridable? Recommendation: yes; but defaults suit most.

5. **Reference URL fetching** — the AI fetches and analyzes user-provided URLs. Privacy implications? Recommendation: only when user explicitly provides; clear UX about what's fetched.

6. **Logo color extraction** — the platform extracts dominant colors from uploaded logos. Worth doing automatically? Recommendation: yes; user can override.

---

## 13. What Comes Next

With Objective 23 complete, the AI pipeline has a complete visual language for any project. The user has structured tokens, both themes, accessibility-validated, exportable, ready for Stage 6.

**Objective 24: Stage 4 — Schema Synthesis** is next. The PRD plus existing schemas (if any) become the database schema. This stage uses Objective 11's Schema Designer as its surface — the AI generates a schema; the user reviews, edits, and approves through the existing schema designer UI. The two halves of the platform (data management module + AI pipeline) converge here.

The remaining stages chain forward:
- **25: Data Migration** — when there's existing data
- **26: UI Generation** — components from tokens + schema
- **27: Code Generation** — server-side logic
- **28: Test Generation** — from acceptance criteria
- **29: Deployment** — through environments
- **30: Maintenance** — feedback loops

---

*This document is the contract. Every checkbox in Section 10 must be true before moving on to Objective 24.*
