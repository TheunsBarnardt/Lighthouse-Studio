# Platform UI Design Guide

*The design language for the platform's own admin interface. NOT the design language for apps the platform generates — that's the Generated Apps Design Guide. This document covers what customers see when they install the platform, configure it, and operate it.*

**Audience:** Engineers (you, Claude Code, future contributors) building the platform's UI surfaces. Designers who need to understand existing conventions before proposing new ones.

**Status:** Authoritative. When this guide and a specific objective's UI section disagree, this guide wins for visual decisions; the objective wins for functional decisions.

---

## 1. What This Document Is For

The platform has many UI surfaces:
- Schema Designer (Objective 11)
- Data Browser (Objective 18)
- Query Console (Objective 17)
- Storage Browser (Objective 15)
- Auth & User Management (Objective 16)
- AI pipeline screens (Objectives 21–30): intent capture, PRD review, design tokens preview, schema synthesis review, data migration canvas, UI generation review, code generation review, test review, deployment monitor, maintenance dashboard
- Settings, billing, audit logs, observability dashboards (Objectives 2, 3, 6, 7)

These surfaces must feel like **one product**. Without a design guide, each surface drifts in its own direction; the platform feels assembled rather than designed.

This guide locks in:
- The visual language (colors, typography, spacing, motion)
- Layout patterns (page shells, panels, tables, forms, dialogs)
- Component conventions (when to use what)
- Accessibility requirements (WCAG 2.2 AA, non-negotiable)
- Density and information architecture rules
- Specific patterns for common platform UX (capability-aware UX, approval routing, AI artifact review, real-time feedback)

---

## 2. Design Principles

Six principles. Every decision in this guide derives from these.

### 2.1 Density, not sparsity

The platform is a **professional operations tool**, not a consumer app. Power users live in it daily. They want to see a lot of information, scan it quickly, and act on it efficiently.

This means:
- Tables are dense by default; one row should fit ~32px of vertical space, not 64px
- Spacing is small but consistent (4px grid)
- Whitespace serves separation, not breathing room
- Information that experts care about is visible, not hidden behind a "show more"

The platform UI's nearest aesthetic relatives: Linear, Notion's database views, Stripe Dashboard, Figma's properties panel, GitHub's repo views, IntelliJ IDEA. NOT: Apple Music, Stripe's marketing pages, or anything optimized for first-time delight.

### 2.2 Honesty over polish

The platform tells the truth about what it knows. If MSSQL doesn't support array columns, the array-column option is hidden or disabled with a tooltip explaining why — not silently allowed and broken at apply time. If the AI's confidence is low, the UI shows that. If a query is slow, the UI shows the slow part.

Polish is good; concealing reality to look smooth is not. This is the same discipline that runs through the objectives: capability-aware UX, reasoning attached to every AI artifact, honest error messages.

### 2.3 The customer is operating a system

Most actions in the platform are **operations**, not casual interactions. Editing a schema migrates real data. Approving a PRD section locks downstream stages. Deploying to production touches a running app.

The UI's job is to make consequences visible:
- Destructive actions require confirmation with a clear preview
- Bulk operations show a progress indicator with per-item status
- Async operations stream their progress; the user isn't left wondering
- Status indicators reflect actual state, not a stale snapshot

### 2.4 Work, not blank pages

Every surface starts with something useful. A new workspace gets a templated project structure, not "click here to create your first thing." A new schema gets sensible default tables, not an empty diagram. A new AI conversation gets a template picker, not a blinking cursor.

Empty states are still designed — but they're designed to **show what comes next**, not to fill silence.

### 2.5 Live where possible

The platform has real-time infrastructure (Objective 14). Use it.

- Lists update when data changes (no manual refresh)
- Long-running operations stream progress
- Multiple users editing the same artifact see each other's cursors and changes
- Background jobs surface their state where the user is, not in a separate "jobs" page

The exception: don't make UI live in ways that distract. A user typing in a form shouldn't see other people's edits stomp on theirs (use optimistic locking, surface conflicts explicitly).

### 2.6 Keyboard-first for power users

Every primary action has a keyboard shortcut. Tables are keyboard-navigable. The command palette (cmd+k) is the universal shortcut to anything.

Touch and mouse are first-class but never the only way. A user who lives in keyboard mode should never need to reach for the mouse for routine work.

---

## 3. Visual Language

### 3.1 Color System

The platform uses **OKLCH** as the source-of-truth color space (the same approach Stage 3 mandates for generated apps). All palette work is done in OKLCH; output happens in CSS as `oklch()` directly with a hex/rgb fallback for older browsers.

**Why OKLCH:** perceptually uniform; lightness is consistent across hues (a 50% lightness blue and 50% lightness red have the same visual brightness); generates accessible scales without manual tweaking.

#### 3.1.1 Color Tokens

The platform defines tokens at three levels:

**Level 1 — Primitive scales** (raw colors, never used directly):
```
Each scale is 11 stops: 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950
Scales: gray, blue, green, amber, red, purple
```

**Level 2 — Semantic tokens** (the only ones that should appear in code):
```
--bg-canvas         (the page background)
--bg-surface        (raised surfaces: cards, panels)
--bg-surface-2      (extra-raised: dialogs, popovers, dropdowns)
--bg-overlay        (modal scrim)
--bg-input          (form inputs)
--bg-hover          (hover state on interactive surfaces)
--bg-pressed        (pressed/active state)
--bg-selected       (selected row, selected item)
--bg-success-subtle, --bg-warning-subtle, --bg-danger-subtle, --bg-info-subtle  (banner backgrounds)

--fg-primary        (default text)
--fg-secondary      (less emphasis, captions)
--fg-tertiary       (least emphasis, placeholders)
--fg-disabled
--fg-on-accent      (text on filled accent buttons)
--fg-success, --fg-warning, --fg-danger, --fg-info

--border-default
--border-emphasis   (more visible borders)
--border-focus      (focus ring)
--border-success, --border-warning, --border-danger, --border-info

--accent-primary           (the platform's primary brand accent — see below)
--accent-primary-hover
--accent-primary-pressed
--accent-primary-subtle    (filled-but-quiet variant for badges, etc.)
```

**Level 3 — Component tokens** (used inside specific component styles, derive from semantic tokens):
```
--button-primary-bg, --button-primary-fg, ...
--input-border, --input-border-hover, ...
--table-row-bg, --table-row-bg-hover, --table-header-bg, ...
```

#### 3.1.2 Light and Dark Themes

Both themes are defined together. Same semantic tokens; different OKLCH values.

**Light theme** — surfaces are 95–100% lightness; primary text is ~20% lightness; accent at ~50%. Borders are subtle (90–92% lightness). Designed for daylight office use.

**Dark theme** — surfaces are 10–18% lightness; primary text is ~88%; accent preserves identity (~55% lightness, slightly desaturated). Borders are emphasized (~25% lightness). Designed for low-light or extended-session use.

The platform respects the OS preference by default (`prefers-color-scheme`). Users can override per-session via a toggle in the user menu.

Both themes pass WCAG 2.2 AA on every text/background pairing. AA is the floor; AAA is preferred for primary text on primary backgrounds.

#### 3.1.3 The Platform's Accent Color

The platform's primary accent is a deep blue: `oklch(0.50 0.20 250)` (light) / `oklch(0.65 0.18 245)` (dark). 

Rationale: blue reads as "professional" and "trustworthy" without being corporate-bland; deep enough to feel intentional, not dilute; differentiated from the typical SaaS primary (which clusters around `#3b82f6`/Tailwind's blue-500).

This is the platform's brand color. Generated apps use whatever Stage 3 produces from the customer's brand inputs — they don't inherit this accent.

#### 3.1.4 Status Colors

Five semantic colors beyond the accent:

- **Success**: green, `oklch(0.55 0.16 145)` light / `oklch(0.70 0.14 145)` dark
- **Warning**: amber, `oklch(0.70 0.16 75)` light / `oklch(0.78 0.14 75)` dark
- **Danger**: red, `oklch(0.55 0.20 25)` light / `oklch(0.68 0.18 25)` dark
- **Info**: blue (slightly different hue from accent), `oklch(0.55 0.16 230)` light / `oklch(0.68 0.14 230)` dark
- **Neutral**: gray (covered by the bg/fg tokens above)

Status colors are used **subtly** by default. A success message has a green left-border and green icon, not a green background that floods the row. The information is the point; the color is supporting evidence.

### 3.2 Typography

#### 3.2.1 Font Families

**Sans (UI text)**: `Inter` with a fallback to `system-ui, -apple-system, "Segoe UI", sans-serif`. Inter loads from `/fonts/` (self-hosted; not Google Fonts) to respect privacy and avoid third-party domain dependencies.

Why Inter: legible at small sizes; tabular-figure variant for tables; widely tested for accessibility; comprehensive language coverage; permissive license.

**Mono (code, IDs, technical strings)**: `JetBrains Mono` self-hosted with fallback to `ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, monospace`.

Why JetBrains Mono: designed for code readability; ligatures supported; pairs well with Inter visually.

**No serif** in the platform UI. (Generated apps may use serif if their design tokens specify; the platform itself does not.)

#### 3.2.2 Type Scale

Modular scale at ratio 1.125 (slightly tight; suits dense UI):

```
xs    11px / 16px line   (timestamps, very subtle metadata)
sm    12px / 18px line   (table cells, labels, captions)
base  13px / 20px line   (body text, default)
md    14px / 22px line   (subtle emphasis, form labels)
lg    16px / 24px line   (page section headings)
xl    18px / 26px line   (page titles)
2xl   22px / 30px line   (large stats, marketing-style emphasis)
3xl   28px / 36px line   (rare; major hero states)
```

The base size is **13px**, not 16px. This is intentional density. It's also why Inter is used — it's legible at 13px in a way that many fonts aren't.

For users who want larger text, the platform respects browser zoom (cmd+/cmd-) without breaking layouts. Body text uses `rem` for sizing; container widths use `rem` or `clamp()` so zoom propagates correctly.

#### 3.2.3 Font Weights

Five weights, no more:

- **400** (regular) — body text, table cells, most UI text
- **500** (medium) — emphasis, button labels, active nav items, selected state
- **600** (semibold) — section headings, primary labels
- **700** (bold) — page titles, strong emphasis, danger confirmations

**No light weights** (300 or below). They look fragile at the platform's small sizes.

#### 3.2.4 Tabular Figures

Numbers in tables, IDs, timestamps, byte counts, etc. use Inter's tabular-figures variant: `font-variant-numeric: tabular-nums`. This keeps numerical columns aligned without manual padding.

Apply via a utility class: `.tabular` or directly on table cells / monospace contexts.

### 3.3 Spacing

#### 3.3.1 The 4px Grid

All spacing is a multiple of 4px. Tokens:

```
--space-0    0
--space-px   1px
--space-0_5  2px
--space-1    4px
--space-1_5  6px
--space-2    8px
--space-3    12px
--space-4    16px
--space-5    20px
--space-6    24px
--space-8    32px
--space-10   40px
--space-12   48px
--space-16   64px
--space-20   80px
--space-24   96px
```

Most UI uses 4px, 8px, 12px, 16px, 24px. Larger values are for major page-level spacing.

#### 3.3.2 Density Modes

The platform supports three density modes via a user setting (defaults to `comfortable`):

- **Compact**: tables 28px row height, smaller padding, no extra spacing
- **Comfortable**: tables 32px row height, standard padding (default)
- **Spacious**: tables 40px row height, more padding for users who prefer breathing room

Density is set via a CSS variable on the root element: `--density-row-h: 32px` etc. Components reference the variable, not hardcoded heights.

### 3.4 Border Radius

Five values. Use sparingly; sharp corners are not unfriendly in a professional tool.

```
--radius-none   0       (most table cells, dividers)
--radius-sm     4px     (buttons, inputs, badges)
--radius-md     6px     (cards, panels)
--radius-lg     8px     (dialogs, popovers)
--radius-full   9999px  (pills, avatars)
```

No exotic radii (3px, 7px, 13px). Stick to the scale.

### 3.5 Shadows

Three elevation levels. Subtle.

```
--shadow-sm     small lift (popovers, dropdowns, hover state on cards)
--shadow-md     medium lift (dialogs, sheets, modal panels)
--shadow-lg     command palette, command bar
```

Light theme shadows are dark-translucent (`rgba(0,0,0,0.08–0.16)`); dark theme uses subtle border emphasis instead of shadow because shadows don't read on dark backgrounds.

No glows. No colored shadows. No multi-layer shadow stacks.

### 3.6 Motion

Three durations, three easings.

**Durations:**
- `--motion-fast` — 100ms (hover state changes, color transitions)
- `--motion-base` — 180ms (most transitions: dialog open, panel slide)
- `--motion-slow` — 280ms (page transitions, large layout shifts)

**Easings:**
- `--ease-standard` — `cubic-bezier(0.2, 0, 0, 1)` (most things; decel)
- `--ease-emphasized` — `cubic-bezier(0.3, 0, 0, 1)` (emphasis on the destination)
- `--ease-linear` — `linear` (progress bars, indeterminate spinners)

Reduce motion: respect `prefers-reduced-motion`. When set, all motions become 0ms duration, except indicators of progress (which stay; progress IS the information).

### 3.7 Z-Index Layers

Six layers. No arbitrary z-index values.

```
--z-base       1
--z-dropdown   100   (select menus, autocomplete)
--z-sticky     200   (sticky table headers, sticky toolbars)
--z-overlay    300   (modal scrims)
--z-modal      400   (dialogs)
--z-popover    500   (tooltips, popovers above modals)
--z-toast      600   (toasts, top of stack)
--z-command    700   (command palette, always on top)
```

---

## 4. Layout

### 4.1 The Application Shell

Every platform page lives inside a consistent shell:

```
┌─────────────────────────────────────────────────────────────┐
│  TopBar (48px)                                               │
│  [Logo] [Workspace ▾]  [Center: breadcrumbs]  [User ▾] [⌘K] │
├──────────┬──────────────────────────────────────────────────┤
│          │                                                   │
│  Side    │             Page Content                          │
│  Nav     │             (scrollable)                          │
│          │                                                   │
│  240px   │                                                   │
│          │                                                   │
│  (col-   │                                                   │
│  lapses  │                                                   │
│  to 56px)│                                                   │
│          │                                                   │
└──────────┴──────────────────────────────────────────────────┘
```

**TopBar** (48px tall):
- Left: platform logo (links to home), workspace switcher (combobox-style), breadcrumbs
- Right: notifications bell, user menu, command palette trigger (cmd+k)

**Side Nav** (240px expanded, 56px collapsed):
- Logo space (matches topbar logo)
- Primary nav: Dashboard, Schema, Data, Storage, Query, AI Pipeline, Auth, Settings
- Secondary nav: contextual to current section (e.g., when in AI Pipeline, shows current project's stages)
- Bottom: collapse toggle, help link

**Page content**:
- Max-width content (`max-width: 1440px` for most pages; `100%` for tables and canvases)
- Padding: 24px on most pages; 0 for full-bleed surfaces (Schema Designer canvas, Data Browser table)
- The content scrolls; the shell stays fixed

### 4.2 Page Layouts

Five common page layouts:

#### 4.2.1 List Page (most common)

Used by: workspace home, project lists, audit logs, deployment history, etc.

```
┌─────────────────────────────────────────────────────────────┐
│  PageHeader (64px)                                           │
│  ┌Title──────────────────┐  ┌Actions: Filter, +Create─────┐ │
│  │ Page Title            │  │ [search]  [filter]  [+ New] │ │
│  └────────────────────────┘  └───────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  Optional sub-toolbar (saved filters, view switcher)        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Content (table, grid, or list)                              │
│  Pagination at the bottom                                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### 4.2.2 Detail Page

Used by: viewing a project, an artifact, an audit entry, etc.

```
┌─────────────────────────────────────────────────────────────┐
│  PageHeader with Back Button                                 │
│  [← Back]  Title                          [Edit] [⋯]        │
├─────────────────────────────────────────────────────────────┤
│  Optional Tabs                                               │
├──────────────────────────────────┬──────────────────────────┤
│                                  │                           │
│  Main Content (2/3)              │  Side Panel (1/3)         │
│  - The artifact's primary view   │  - Metadata               │
│  - Sections separated by         │  - Activity / history     │
│    dividers, not cards           │  - Related items          │
│                                  │                           │
└──────────────────────────────────┴──────────────────────────┘
```

The 2-pane split is the platform's most common layout. It mirrors the "code on left, metadata on right" pattern from VS Code, GitHub PR view, etc.

#### 4.2.3 Three-Pane (Editor Layout)

Used by: Schema Designer, AI pipeline review screens (Stages 6, 7), Code Generation review.

```
┌─────────────────────────────────────────────────────────────┐
│  PageHeader                                                  │
├──────────┬─────────────────────────────────┬───────────────┤
│          │                                 │                │
│  Tree /  │   Editor / Canvas               │  Inspector /   │
│  List    │                                 │  Properties    │
│          │                                 │                │
│  240px   │   (flex)                        │  320px         │
│          │                                 │                │
└──────────┴─────────────────────────────────┴───────────────┘
```

Both side panels are resizable (drag the divider). State persisted per user. Either side panel can be collapsed.

#### 4.2.4 Full-Bleed Canvas

Used by: Schema Designer's diagram view, Data Migration mapping canvas, deployment monitor.

```
┌─────────────────────────────────────────────────────────────┐
│  Minimal toolbar (40px)                                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│              Full canvas (no padding, edge-to-edge)          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

Floating toolbars and panels overlay the canvas; the canvas itself fills the viewport.

#### 4.2.5 Wizard / Multi-Step

Used by: data migration setup, project creation, first-run platform setup.

```
┌─────────────────────────────────────────────────────────────┐
│  Stepper (1—2—3—4)                                           │
├─────────────────────────────────────────────────────────────┤
│  Page header for current step                                │
│                                                              │
│  Step content (centered, max-width 720px)                    │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│  [← Back]                              [Skip] [Next →]      │
└─────────────────────────────────────────────────────────────┘
```

Steps are indicated; skipped steps are visible (so users know they exist). State preserved across steps.

### 4.3 Responsive Behavior

The platform is **desktop-first** (1280px and above is the design target). It works on tablets (768px+) but with some compromises. It is NOT designed for phones; phone users get a "this works best on a larger screen" notice with a button to continue anyway (graceful degradation, not a hard block).

Breakpoints:

```
sm   640px   (large phones — graceful degradation only)
md   768px   (tablets — supported with simplified layouts)
lg   1024px  (small laptops — full features, denser)
xl   1280px  (target design size)
2xl  1536px  (large monitors — extra room for inspectors and panels)
```

Below `lg`, the side nav collapses to a slide-out drawer. Three-pane layouts stack to two-pane. Full-bleed canvases get a "this is best on a wider screen" hint but remain functional.

---

## 5. Component Conventions

### 5.1 Buttons

Three variants. No more.

**Primary** (filled with accent color): the page's primary action. Maximum one per page section.

**Secondary** (outlined or subtle background): supporting actions. Multiple allowed.

**Ghost** (no background, only on hover): tertiary actions. For inline use within tables, lists, headers.

**Sizes:**
- `sm` — 28px tall (used in tables, dense toolbars)
- `md` — 32px tall (default)
- `lg` — 40px tall (page-level primary actions only)

**Destructive variant**: any of the three variants can be `destructive` (red text/border/fill). Used for delete, remove, drop. Always paired with confirmation.

**Icon-only buttons**: square, same height as text variants, with `aria-label`. Tooltip on hover.

**Loading state**: a spinner replaces the icon (or appears alongside text). Button is disabled but doesn't change size.

**Disabled state**: 50% opacity; tooltip explains why if non-obvious ("requires schema.update permission").

#### 5.1.1 Button Composition

Common patterns:

```tsx
// Primary action
<Button variant="primary" size="md">Create Schema</Button>

// Destructive
<Button variant="primary" intent="destructive" size="md">Delete Project</Button>

// Icon + label
<Button variant="secondary" size="sm">
  <PlusIcon /> Add Column
</Button>

// Icon-only with tooltip
<Tooltip content="Refresh">
  <Button variant="ghost" size="sm" iconOnly>
    <RefreshIcon />
  </Button>
</Tooltip>

// Loading
<Button variant="primary" size="md" loading>
  Saving...
</Button>
```

### 5.2 Forms

Forms are dense, label-on-top, validation-on-blur.

**Field structure:**
```
[Label]  optional [Help icon → tooltip]
[Input or control]
[Helper text (optional, persistent)]
[Error text (only when invalid)]
```

**Spacing between fields:** 16px vertical. Within a field: 4px between label and control; 4px between control and helper/error.

**Required fields**: an asterisk (`*`) after the label, in danger color. Not the only indicator (also: HTML `required`, aria-required).

**Validation timing:**
- On submit: validate everything, scroll to first error
- On blur: validate the just-edited field
- During typing: only for length limits and character restrictions (don't show errors while the user is mid-thought)

**Error messages**: specific and actionable. Not "Invalid input." Yes "Email must include an @ symbol" or "This name is already used in this workspace."

**Inline editing in tables**: cells become editable on double-click or Enter. Save on blur or Enter; cancel on Escape. Optimistic update with conflict detection.

#### 5.2.1 Common Inputs

- **TextInput**: standard text field
- **TextArea**: multi-line, auto-grows up to 6 rows then scrolls
- **NumberInput**: with up/down arrows; supports unit suffix
- **Select**: dropdown for ≤ 7 options; searchable for more
- **Combobox**: searchable + creatable (e.g., FK reference picker)
- **Checkbox**: standard
- **Radio**: standard; horizontal for ≤ 3 options, vertical for more
- **Switch**: for boolean settings, especially "feature on/off" semantics
- **DatePicker**: localized; respects user's locale
- **CodeInput**: Monaco-based; for SQL, JSON, YAML, JavaScript expressions
- **FileInput**: drag-and-drop + click-to-browse; uses tus.io for resumable upload
- **TagInput**: multiple values; comma or Enter to add

### 5.3 Tables

The platform's most-used component. Uses TanStack Table v8 + TanStack Virtual.

**Default columns:**
- Frozen left columns (selection checkbox, ID, primary identifier)
- Scrollable middle columns
- Frozen right column (actions menu) — optional

**Row height**: 32px default (comfortable density). 28px compact, 40px spacious.

**Header**: 36px tall, sticky, slightly darker background than rows.

**Row hover**: subtle background change (`--bg-hover`). Cursor pointer if the row is clickable; default cursor if cells are independently interactive.

**Selection**: checkbox column on the left. Shift+click selects ranges. Cmd+click toggles individual rows. "Select all" in the header selects the visible page; a banner appears: "47 rows selected on this page. Select all 1,239 rows?" — clicking selects across all pages.

**Actions:**
- Bulk actions appear in a sticky bar at the top of the table when rows are selected
- Per-row actions are a `⋯` menu in the rightmost column (or inline icons for the most common 1–3 actions)

**Sorting**: click header to sort; click again to reverse; click a third time to clear. Multi-column sort via shift+click.

**Filtering**: a filter bar above the table; per-column filters as popovers from header. Filter state encoded in the URL.

**Pagination**: cursor-based (matches the SDK's pattern from Objective 12). "Load more" infinite scroll for some views; explicit page navigation for audit logs and similar where users want to jump to specific pages.

**Empty states**: a centered message with an icon, a helpful headline, and a primary action. Never just "No data."

**Loading**: skeleton rows (10) for initial load. Bottom spinner for infinite scroll.

### 5.4 Dialogs / Modals

Three categories:

#### 5.4.1 Confirmation Dialog

For destructive or significant actions. Small, centered.

- Width: 480px
- Title: action-specific ("Delete project?")
- Body: 1–3 lines describing consequences ("This will permanently delete 1,239 records. This cannot be undone.")
- Footer: [Cancel] [Confirm] (destructive variant if applicable)

Confirmation requires intentional action: for highly destructive actions (drop schema, delete workspace), the user must type the resource name to confirm.

#### 5.4.2 Form Dialog

For creating or editing without leaving the current page.

- Width: 560px (single-column form) or 720px (multi-column)
- Title: "Create Project" / "Edit Schema"
- Body: form fields
- Footer: [Cancel] [Save]

Esc closes (with confirmation if the form is dirty). Cmd+Enter submits.

#### 5.4.3 Sheet (slide-in panel)

For larger work that doesn't quite need a full page (viewing details, large forms, etc.).

- Slides in from the right; covers part of the screen but not all
- Width: 480px (small), 640px (medium), 960px (large)
- Has a close button; doesn't dim the background as heavily as a modal

Sheets are non-modal: the user can interact with the page behind. Used for detail views of items in a list, where context behind the sheet matters.

### 5.5 Feedback

#### 5.5.1 Toasts

Transient notifications. Top-right of the viewport.

- **Success** (green icon, default 3s): "Schema saved"
- **Info** (blue icon, default 4s): "Migration in progress (12% complete)"
- **Warning** (amber icon, default 6s): "Schema has uncommitted changes"
- **Error** (red icon, default 8s): "Failed to deploy: [error message]"

Toasts can have an action button: "Schema saved [View]" or "Failed to deploy [Retry]".

Toasts stack (newest on top, max 5 visible). Older toasts dismiss automatically.

#### 5.5.2 Banners

Persistent, in-page notifications. At the top of the relevant section.

- Used for: workspace-wide warnings, system status, contextual hints
- Dismissable when appropriate (state remembered)
- Color matches the status

#### 5.5.3 Inline Validation

For form errors: red text below the field. For warning conditions: amber text. For success states (e.g., "username available"): green text with a checkmark.

#### 5.5.4 Progress

For determinate operations: a progress bar with a percentage and (when meaningful) an estimated time.

For indeterminate operations: a subtle spinner (16px) with a text label ("Loading…", "Generating…").

For long-running async operations: a "running" indicator at the location where the result will appear, plus optionally a notification when it completes.

### 5.6 Navigation

#### 5.6.1 Breadcrumbs

Show in the topbar for nested pages. Three levels max; deeper paths are abbreviated with a `…` that shows the full path on hover.

#### 5.6.2 Tabs

Used within a page to split related content.

- Underline-style tabs (not pill-style; pills feel marketing-y)
- Active tab: underlined in accent color, weight 500
- Tabs can be horizontally scrollable on smaller widths

#### 5.6.3 Side Panels

Resizable; state persisted per user (remembers width). Collapsible to an icon-strip.

### 5.7 Command Palette (cmd+k)

The universal action interface. Opens with cmd+k (or ctrl+k).

- Centered, 640px wide
- Search input at top
- Results below, grouped by type ("Pages", "Actions", "Recent", "Help")
- Keyboard navigation (up/down arrows, Enter to execute)
- Esc closes

The palette is the platform's accelerator. Every page, every action, every settings panel is reachable from it. Power users learn this and stop using the side nav.

### 5.8 Tooltips

For icon-only buttons, abbreviated labels, capability flags ("MSSQL doesn't support array columns"), and disabled states.

- Show on hover after 300ms delay
- Show on focus immediately (keyboard users)
- Position: above the trigger by default; flip to below if no room
- Max width: 240px; longer content goes in a popover

Tooltips are NOT used to hide critical information. If something is important enough that the user needs to know, it's visible — not a tooltip.

---

## 6. Specialized Patterns

The platform has several recurring UX patterns specific to its domain. These are locked here so every surface implements them consistently.

### 6.1 Capability-Aware UX

The platform supports three databases with different capabilities (Objective 4c). UI elements that depend on capabilities follow a consistent pattern:

**Capability missing → option hidden by default.** A schema designer's "array column" option doesn't appear at all when the workspace's database is MSSQL.

**Capability missing → option visible but disabled with tooltip.** Used when the user might be confused by something missing. Example: a "Vector search" toggle that's disabled on MSSQL with tooltip "Available on Postgres and via Azure AI Search on MSSQL — configure under Settings → Search."

**Capability with caveat → option enabled with badge.** Example: "Foreign key" option on Mongo is enabled but has a small "advisory" badge with tooltip "Mongo doesn't enforce FK at DB level; the platform validates on writes."

The UI never lies about capabilities. The user always knows what works on their database.

### 6.2 Approval Routing UI

Approval routing (Objective 6) appears in many places. Always shows:

- Who needs to approve (avatars + names)
- Approval mode (any/all/N-of-M) with a clear icon
- Current state (pending, approved by X, rejected by Y)
- An action button if the current user is an approver
- A "view approval history" link to the audit trail

For solo workflows where the user IS the only approver: the UI collapses approval to a single button without ceremony ("Approve" instead of "Submit for Approval → Approve").

### 6.3 AI Artifact Review

AI-generated artifacts (PRD, schema, design tokens, UI components, server functions, tests) all share a review pattern:

```
┌──────────────────────────────────────────────┐
│  Header                                       │
│  [Title]  [Status: Draft / Submitted / ...]  │
│                              [Approve] [⋯]   │
├──────────────────────────────────────────────┤
│  Reasoning panel (collapsed by default)      │
│  > Why was this generated?                   │
├──────────┬───────────────────────────────────┤
│  Content │  Inspector                         │
│  (the    │  - Source artifacts                │
│   actual │  - Quality signals                 │
│   thing) │  - Cost                            │
│          │  - Approval routing                │
│          │  - Edit / Regenerate buttons       │
└──────────┴───────────────────────────────────┘
```

The reasoning panel is critical. It's collapsible but never hidden. Users can expand to read the AI's rationale; collapse to focus on the artifact.

The "Regenerate" action always asks for feedback ("Why are you regenerating? This helps the AI do better."). Feedback is recorded in audit and informs prompt iteration.

### 6.4 Real-Time Indicators

Where data is live:

- A small pulsing dot (`bg-success-subtle`) in the page header indicates "live" status
- Per-row indicators when a row was just changed by someone else (subtle highlight that fades over 2 seconds)
- "Connection lost" banner when WebSocket disconnects, with "Reconnecting…" indicator and timestamp of last update

Where data is NOT live (manual refresh required):

- A "Refresh" button is always visible
- "Last updated: 23 seconds ago" indicator next to the refresh button
- The user is never left guessing whether what they see is current

### 6.5 Long-Running Operations

For operations that take more than ~3 seconds (deployments, migrations, large query results, AI generation):

- Operation kicks off; UI returns immediately
- A persistent indicator appears at the location where the result will go
- Progress is reported via realtime (Objective 14) — actual progress, not a fake spinner
- When complete: the result appears, and a toast confirms ("Deployment completed")
- If the user navigates away: the operation continues; they get notified when it completes
- A "Background Tasks" panel (accessible from the topbar) shows all in-flight operations across the workspace

### 6.6 Error Surfaces

Errors are categorized and styled accordingly:

- **Validation errors** (user can fix): inline, near the offending input, helpful message
- **Authorization errors** (permission denied): a banner explaining which permission is missing and how to request it
- **Resource not found** (404-equivalent): a centered empty state with a back link
- **Server errors** (5xx): a banner saying "Something went wrong" with a retry button and a "Report this" link that includes the error details
- **Network errors** (offline): a top banner that persists until reconnected; cached data remains visible but read-only

Never blame the user. Never just say "Error" — say what happened and (if possible) what they can do.

---

## 7. Accessibility

WCAG 2.2 AA is the floor. Every surface meets it; CI validates with axe-core.

### 7.1 Color Contrast

- Body text: ≥ 4.5:1 against background
- Large text (18pt+ or 14pt+ bold): ≥ 3:1
- UI components and graphical objects: ≥ 3:1
- Focus indicators: ≥ 3:1 against adjacent colors

The OKLCH color system (Section 3.1) generates scales that meet these by default. Edge cases (specific accent colors against specific backgrounds) are checked during component development.

### 7.2 Keyboard Navigation

Every interactive element is reachable by Tab. Tab order matches visual order. Focus is always visible (custom focus ring using `--border-focus`).

Modal dialogs trap focus. Sheets do not (they're non-modal). The Esc key closes overlays.

Skip links: every page starts with "Skip to main content" (visually hidden until focused).

### 7.3 Screen Readers

Every form input has a label (visible or `aria-label`). Every icon-only button has `aria-label`. Tables use proper semantic markup (`<table>`, `<thead>`, `<th>`, etc.).

Dynamic content uses `aria-live` regions appropriately (toasts, status updates).

The platform tests with VoiceOver, NVDA, and JAWS during the accessibility quality gate (Objective 10).

### 7.4 Motion and Animation

Respect `prefers-reduced-motion`. When set, all animations except progress indicators use 0ms duration.

No flashing or strobing content. No content that animates more than 3 times per second.

### 7.5 Cognitive Accessibility

- Plain language by default; jargon explained on first use
- Consistent layouts across pages (the user learns once)
- Confirmation for destructive actions
- Undo where possible
- Sessions don't time out aggressively (15-minute warning before any auto-logout)

---

## 8. Voice and Tone

The platform's voice is **professional, direct, and a little dry**. Closer to Linear's voice than Mailchimp's. Closer to documentation than marketing copy.

### 8.1 General Rules

- **Use the active voice.** "Save changes" not "Changes will be saved."
- **Be specific.** "Workspace deleted" not "Operation completed."
- **Don't apologize unless something genuinely went wrong.** "Failed to save" not "Sorry, we couldn't save your work."
- **Don't use exclamation points.** Save them for genuine moments (rare).
- **Don't be cute.** "Whoops!" "Oh no!" are out. The user is doing serious work.
- **Don't address the user with "you" awkwardly.** "Edit profile" not "Edit your profile."

### 8.2 Specific Language

- Settings → "Settings" (not "Preferences")
- Profile → "Account" (covers settings, billing, etc.)
- Logout → "Sign out"
- Login → "Sign in"
- Username → "Email" (the platform uses email as the primary identifier)
- File → "File" (not "Document" or "Asset")
- User → "Member" inside a workspace; "User" in the abstract
- Tenant → "Workspace" (always)
- Org → "Organization" — used only at the billing/compliance level, not in workflow

### 8.3 Error Messages

Pattern: **what happened + why (if knowable) + what to do**.

- ❌ "An error occurred."
- ✅ "Failed to save schema. The connection to the database was lost. Try again, or contact support if the problem persists."

For errors with actionable causes:

- ✅ "This name is already used in this workspace. Choose a different name."
- ✅ "You don't have permission to delete this project. Ask the workspace owner to grant you `project.delete`."

### 8.4 Empty States

Pattern: **what this is + how to start + (optional) why it matters**.

- ❌ "No projects yet."
- ✅ "No projects yet. Create one to start designing schemas, generating UIs, or migrating data. [Create Project]"

### 8.5 Confirmations

Pattern: **action + scope + irreversibility**.

- ❌ "Are you sure?"
- ✅ "Delete the project 'Customer CRM'? This will permanently remove 1,239 records, 14 functions, and 38 deployments. This cannot be undone."

---

## 9. Specific Surface Guidelines

A few platform surfaces are complex enough to warrant specific notes. The full design lives in each objective's Section 6 ("Component Specifications"); this section calls out cross-cutting decisions.

### 9.1 Schema Designer (Objective 11)

Three views, switchable from a segmented control: **Diagram** (xyflow), **Table** (TanStack Table), **Code** (Monaco JSON/YAML). All three views show the same schema; switching preserves selection.

The diagram view is the default for visual users; the table view is the default for users who think in spreadsheets; the code view is for users who want raw access. The platform tracks last-used view per user and defaults to it.

Edits in any view propagate to the others. Validation errors appear inline in whichever view is active.

### 9.2 Data Browser (Objective 18)

Spreadsheet-style grid. Inline editing on double-click. Row hover shows action icons. Filters and saved views in the toolbar. The data browser is the most-used surface in the Data Management Module — optimize for raw productivity.

### 9.3 AI Pipeline Stages

Each stage has its own page with the review pattern from Section 6.3. The pipeline progress is visible in a horizontal stepper above the page content:

```
[Intent ✓] — [PRD ✓] — [Tokens ◉] — [Schema] — [Migration] — [UI] — [Code] — [Tests] — [Deploy] — [Maintain]
```

Completed stages: green checkmark. Active stage: filled circle, accent color. Future stages: empty circle. Clicking a stage navigates to it.

### 9.4 Deployment Monitor (Objective 29)

Live-updating during deploys. Per-step status (pre-flight, tests, schema, server, UI, health). Streaming logs in a collapsible panel. Big rollback button when applicable. Success state shows post-deploy metrics for the first 10 minutes.

### 9.5 Maintenance Dashboard (Objective 30)

The customer's "what's happening with my app" view. Active signals (errors, perf issues, user reports) at the top; recent change requests in the middle; deployment timeline at the bottom. Designed for a customer who checks it once a day.

---

## 10. What This Guide Does NOT Cover

- **The visual design of generated apps.** That's the Generated Apps Design Guide. Generated apps consume Stage 3's design tokens; the platform UI uses its own tokens (this guide).
- **Marketing pages, landing pages, public docs.** The platform's marketing surface (if any) is out of scope. Anthropic's docs site sets the broader pattern; the platform's public site is a separate concern.
- **Platform email templates.** Auth emails, notification emails, etc. live in MJML templates with workspace branding; they share the platform's color and type system but have their own constraints (email client compatibility).
- **Mobile-specific UX.** The platform doesn't target mobile. Generated apps may.
- **Specific component APIs.** This guide describes the visual and interaction layer. The component library's TypeScript API is documented in the package itself (`packages/ui-components/`).

---

## 11. Implementation Notes

### 11.1 Where the Tokens Live

The platform UI's design tokens live in `packages/ui-tokens/`. They're the source of truth. CSS variables generated from these tokens get loaded into every platform UI page.

The token shape mirrors what Stage 3 generates (Objective 23) — but the **values** are platform-specific. Generated apps never load the platform's tokens; they load their own.

### 11.2 The Component Library

`packages/ui-components/` exports the React components implementing this guide. Components consume the tokens; they don't hardcode colors or spacing.

The library is internal: not published to npm, not a public artifact. Generated apps use shadcn/ui directly, not the platform's component library — even though they overlap conceptually.

Why two libraries? They serve different audiences. The platform UI's components are denser, more specialized (the Schema Designer's column editor isn't a generic component). Generated apps need clean, copy-paste-friendly components matching their generated tokens.

### 11.3 Storybook

Every component in `packages/ui-components/` has a Storybook story. The story shows the component in light theme, dark theme, all variants, all states. The Storybook is the visual reference and the place to test new component work.

### 11.4 Visual Regression

Storybook stories are also visual regression tests. CI compares snapshots; visual changes require explicit acceptance. Catches drift between this guide and implementation.

### 11.5 When to Update This Guide

- **A new pattern emerges**: when a UX problem comes up multiple times and the team converges on a pattern, document it here
- **A token changes**: any change to color/typography/spacing tokens flows through here
- **A new specialized surface appears**: add it to Section 9
- **The voice and tone shifts**: rare but possible; coordinated with copywriters

This guide is a living document. Mark dated decisions with the date. When something is removed, leave a note and a date for context.

---

## 12. Decision Log (Initial)

The why behind some non-obvious choices. Add to this as new decisions are made.

| Date | Decision | Why |
|------|----------|-----|
| 2026-05 | OKLCH for color | Perceptual uniformity; matches Stage 3's approach; same tooling for both |
| 2026-05 | 13px base font size | Density target; Inter is legible at this size; matches Linear/Notion-class tools |
| 2026-05 | Inter + JetBrains Mono | Self-hostable; widely tested for accessibility; permissive license |
| 2026-05 | Desktop-first, no phone target | The platform is professional ops tooling; phone use is rare and graceful degradation suffices |
| 2026-05 | 4px spacing grid | Industry standard for dense UIs; aligns with Tailwind's defaults |
| 2026-05 | Three button variants only | Avoids visual noise; forces clear hierarchy |
| 2026-05 | Three density modes | Respect user preference without forcing one density |
| 2026-05 | No emoji in UI | Professional voice; emoji clutters dense interfaces |
| 2026-05 | OKLCH theme accent: deep blue (oklch 0.50 0.20 250) | Differentiated from typical SaaS blue; reads professional |
| 2026-05 | Reasoning panel always present on AI artifacts | Non-negotiable per Objective 20 |

---

*This guide is the visual contract for the platform UI. Implementation lives in `packages/ui-tokens/` and `packages/ui-components/`. When this guide and a specific objective's UI section conflict, this guide wins for visual decisions; the objective wins for functional decisions.*

*Status: v1, written before any UI is built. Will iterate as the first surfaces ship and reveal what's missing.*
