# Generated Apps Design Guide

*The design language for applications the platform generates for customers. NOT the design language for the platform's own admin interface — that's the Platform UI Design Guide. This document covers what Stage 6 (UI Generation, Objective 26) produces.*

**Audience:** Engineers (you, Claude Code) building Stage 6's component generation prompts and the supporting infrastructure. Customer designers who want to understand what their generated apps will look like before they generate. Customer engineers who edit generated code post-approval.

**Status:** Authoritative for the shape and conventions of generated apps. Specific visual values (colors, typography) come from Stage 3's design tokens, not this guide — this guide describes how those tokens are USED and the patterns into which they're poured.

---

## 1. What This Document Is For

The platform's AI Build Pipeline ends with apps deployed to customer URLs. Those apps must:

- **Feel like a coherent product**, not a stitched-together collection of generated parts
- **Match the customer's brand** (defined via Stage 3's design tokens)
- **Work for end users** who never touch the platform — they just use the customer's CRM, blog, dashboard, etc.
- **Be editable post-generation** by customer engineers without fighting the AI's choices
- **Be accessible** (WCAG 2.2 AA, non-negotiable)
- **Work across screen sizes** including mobile (unlike the platform UI)

This guide locks in the patterns Stage 6's generation prompts produce. Without it, every generated app reflects the prompt of the day and the customer experience drifts. With it, generated apps share a recognizable shape regardless of what the customer is building.

---

## 2. Design Principles

Six principles — different from the platform UI's because the audience is different.

### 2.1 The customer's brand, not the platform's

Generated apps look like the customer, not like the platform. Stage 3's design tokens define colors, typography, spacing, motion. The customer's logo. The customer's voice. The platform's name appears nowhere in the generated UI by default (a small "Powered by [platform]" footer is opt-in for customers who want it).

This means: the same generation pipeline produces a CRM that looks like a CRM, a blog that looks like a blog, a dashboard that looks like a dashboard. The patterns are consistent; the visual identity varies.

### 2.2 End users first; engineers second

The platform UI is for power users; generated apps are for end users. End users include the customer's employees (an enterprise CRM's sales reps), the customer's customers (a B2B portal's clients), or the customer's audience (a blog's readers). They aren't operating a complex tool — they're trying to do their job, place an order, read an article.

This means: forgiveness over efficiency, simplicity over density, clarity over information richness. A generated form has bigger inputs and more breathing room than the platform UI's forms. A generated table has 48px rows by default, not 32px.

### 2.3 Mobile-responsive by default

Generated apps must work on phones. Real workflows happen on phones — checking a status, approving an expense, reading a notification. Customer apps that don't work on phones lose users.

This means: every component is responsive. Tables collapse to cards on small screens. Multi-column layouts stack. Touch targets are at least 44×44px.

### 2.4 Accessibility is non-negotiable

The platform validates with axe-core during generation (Objective 26, Section 5.10). WCAG 2.2 AA is the floor. Generated apps that fail accessibility don't ship — they regenerate.

The customer doesn't choose accessibility. The platform makes it.

### 2.5 Honest about state

Generated apps tell the truth: loading states are visible, empty states explain what should be there, errors are clear, confirmations match consequences. This is the same discipline as the platform UI but expressed differently — end users need more reassurance than power users.

### 2.6 Editable, not magical

Generated code is meant to be read and edited. It uses conventional patterns, not clever ones. A customer engineer who opens `ContactsList.tsx` shouldn't need to learn a meta-framework to understand it. The code looks like good React, written by a competent engineer who used standard libraries.

This is the discipline that makes "the AI generates the app, you maintain it" actually viable.

---

## 3. The Stack

Generated apps share a fixed stack. The customer can't choose React vs. Vue at generation time — Stage 6 produces React. They can edit anything they want post-generation, but the AI generates React.

### 3.1 Core Stack

- **React 19** with the new compiler enabled (no manual `useMemo`/`useCallback` for typical optimization)
- **TypeScript** strict mode
- **Vite** as the bundler
- **React Router 6** for routing
- **TanStack Query** for server state (matches the platform's SDK pattern)
- **TanStack Table v8 + Virtual** for tables and grids
- **react-hook-form + zod** for forms

### 3.2 UI Library

- **shadcn/ui** as the component library (copy-paste, customer-owned code, not a black-box dependency)

Why shadcn over Material UI / Chakra / Mantine: copy-paste customization fits AI generation. The customer ends up with components they own; the AI generates new variations based on existing patterns; nothing is locked behind a closed library version. Material UI's prescriptiveness fights AI generation; Chakra's API surface is wider than needed; Mantine is great but smaller community.

shadcn components live in `src/components/ui/` in the generated app. The AI generates additional components in `src/components/` that compose shadcn primitives.

### 3.3 Styling

- **Tailwind CSS** configured with Stage 3's design tokens
- The Tailwind config is generated by Stage 3 (Objective 23, Section 6.8) and consumed by Stage 6
- All styling uses Tailwind classes; no inline styles; minimal custom CSS

Why Tailwind: utility-first works with AI generation (the AI composes utilities, not invented class names); customers can edit utilities directly without learning the platform's CSS conventions; widely understood; performant.

### 3.4 SDK Integration

- **`@platform-name/sdk`** for data, auth, real-time, storage (Objective 19)
- **`@platform-name/sdk-react`** for React-specific hooks
- All data flows through the SDK; the AI doesn't generate raw `fetch` calls

The SDK is typed end-to-end. When Stage 4 changes the schema, the customer regenerates types via `pdm sync-types` and TypeScript catches breaks. This is the discipline that keeps generated apps in sync with the data plane.

### 3.5 Storybook

Each generated component has a Storybook story (Objective 26, Section 5.10 covers this). Stories live in `src/components/<Component>.stories.tsx`. They render the component with mock data from the schema-aware factory.

### 3.6 What's NOT in the Stack

- **Redux/Zustand/Jotai** — TanStack Query covers server state; React Context covers UI state. Apps that genuinely need a state library are rare; customers can add one post-generation.
- **CSS-in-JS** — Tailwind is the choice; no Emotion, no Styled Components.
- **GraphQL clients** — the SDK abstracts both REST and GraphQL; the customer's UI doesn't write GraphQL queries directly.
- **Any UI library that isn't shadcn/ui** — generated apps don't import from Material UI, Chakra, Ant Design, etc.
- **Custom build setup** — Vite default config + Tailwind plugin + the SDK's recommended config. The customer can extend post-generation.

---

## 4. Visual Language

The visual language is **defined by Stage 3's tokens**, not by this guide. This guide describes how the tokens are USED.

### 4.1 Token Categories

Stage 3 produces tokens for:

- **Colors** (semantic + scales, light + dark themes)
- **Typography** (families, scales, weights, line heights)
- **Spacing** (modular scale)
- **Sizing** (component dimensions)
- **Border radius** (5 values)
- **Shadows** (3 elevation levels)
- **Motion** (durations, easings)
- **Z-index layers** (consistent stacking)
- **Breakpoints** (responsive)

Generated apps consume these via Tailwind config. The AI's generation prompts reference Tailwind utility classes — never raw values.

### 4.2 Theme Support

Generated apps support light and dark themes (both generated by Stage 3). The user toggles via a button in the app (location varies by app type — usually in a header or user menu).

The user's preference persists in `localStorage`. The default respects `prefers-color-scheme`.

### 4.3 Typography Application

Stage 3 generates a 10-step type scale (`xs` through `6xl`). Generated apps use the scale consistently:

- **Page titles**: `text-3xl font-bold`
- **Section headings**: `text-xl font-semibold`
- **Subsection headings**: `text-lg font-medium`
- **Body**: `text-base`
- **Captions / labels**: `text-sm`
- **Micro labels / metadata**: `text-xs text-muted-foreground`

The AI doesn't invent new sizes. If a customer needs a size that's not in the scale, they edit the Tailwind config — not the component.

### 4.4 Color Application

Semantic color tokens drive everything:

- **Primary actions**: `bg-primary text-primary-foreground`
- **Secondary surfaces**: `bg-secondary text-secondary-foreground`
- **Destructive**: `bg-destructive text-destructive-foreground`
- **Borders**: `border-border` (subtle), `border-input` (form inputs)
- **Text**: `text-foreground` (primary), `text-muted-foreground` (secondary)

Direct color references (`bg-blue-500`, `text-red-700`) are forbidden in generated code. Always semantic tokens. This means the customer can change the primary color in their tokens and it propagates everywhere.

### 4.5 Spacing Application

Standard spacing patterns:

- **Page padding**: `px-4 md:px-6 lg:px-8` (4 on mobile, 6 on tablet, 8 on desktop)
- **Section gaps**: `space-y-6` between major sections
- **Form field gaps**: `space-y-4` between fields
- **Inline gaps**: `gap-2` (8px) for related items, `gap-4` (16px) for groups

The 4px-grid discipline holds; AI generation doesn't invent custom spacing.

---

## 5. Layout Patterns

Generated apps use a small set of layout patterns. Stage 6 picks per page based on the PRD.

### 5.1 The App Shell

Every generated app has a consistent shell:

```
┌─────────────────────────────────────────────────────────────┐
│  TopBar (56px, taller than platform UI)                      │
│  [Logo] [Nav]               [Notifications] [User Menu]      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│             Page Content                                     │
│             (max-width: 1280px, centered)                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

For apps with deeper navigation (CRM, admin tools, dashboards), a side nav is added:

```
┌─────────────────────────────────────────────────────────────┐
│  TopBar (56px)                                               │
├──────────┬──────────────────────────────────────────────────┤
│  SideNav │                                                   │
│  240px   │   Page Content                                    │
│          │   (flex; fills remaining space)                   │
│          │                                                   │
└──────────┴──────────────────────────────────────────────────┘
```

For content-heavy apps (blogs, marketing sites, documentation), no side nav. The TopBar's nav links cover navigation:

```
┌─────────────────────────────────────────────────────────────┐
│  TopBar (64px, even taller for prominence)                   │
│  [Logo]  Home  Articles  About               [Sign in]       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│              Centered content (max-width: 768px)             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

The PRD's information architecture (extracted in Stage 6) determines which shell. The AI doesn't pick at random.

### 5.2 List Page

```
┌────────────────────────────────────────────────┐
│  Page Header                                    │
│  ┌────────────┐  ┌──────────────────────────┐ │
│  │ Page Title │  │ [Search]  [Filter] [+ New]│ │
│  │ Description│  │                          │ │
│  └────────────┘  └──────────────────────────┘ │
├────────────────────────────────────────────────┤
│  Filters bar (chip-style; saved views)         │
├────────────────────────────────────────────────┤
│                                                 │
│  Items (table on desktop; cards on mobile)     │
│                                                 │
├────────────────────────────────────────────────┤
│  Pagination                                     │
└────────────────────────────────────────────────┘
```

Generated tables are denser on desktop and progressively simpler on tablets/phones. By default:

- **Desktop (≥1024px)**: full table with all columns
- **Tablet (768–1023px)**: fewer columns; less-important ones tucked into a popover
- **Mobile (<768px)**: card layout, one card per row, primary fields visible

The AI infers column priority from the schema (PK and primary display always visible; metadata last) and from PRD context.

### 5.3 Detail Page

```
┌────────────────────────────────────────────────┐
│  [← Back]  Item Title                          │
├────────────────────────────────────────────────┤
│  Tabs (overview, details, history, ...)        │
├──────────────────────┬─────────────────────────┤
│                      │                          │
│  Main content (2/3)  │  Side panel (1/3)        │
│  - Primary fields    │  - Metadata              │
│  - Related items     │  - Actions               │
│                      │  - Recent activity       │
└──────────────────────┴─────────────────────────┘
```

On mobile, the side panel stacks below the main content.

### 5.4 Form Pages

```
┌────────────────────────────────────────────────┐
│  Page Header                                    │
│  [← Back]  Create Contact                       │
├────────────────────────────────────────────────┤
│                                                 │
│  Centered form (max-width: 640px)               │
│                                                 │
│  Field groups separated by sections             │
│                                                 │
│  [Cancel]                            [Save]    │
└────────────────────────────────────────────────┘
```

For long forms (more than ~10 fields), the AI generates a multi-section layout with anchored navigation:

```
┌────────────────────────────────────────────────┐
│  [← Back]  Create Contact                       │
├──────────┬─────────────────────────────────────┤
│          │                                      │
│  Section │  Form fields                         │
│  Nav     │                                      │
│          │  Section: Personal Info              │
│  • Personal│  ─────────────                    │
│  • Contact │                                    │
│  • Notes   │  Section: Contact Methods         │
│          │  ─────────────                      │
│          │                                      │
└──────────┴─────────────────────────────────────┘
```

Mobile collapses to single-column; the section nav becomes a sticky breadcrumb at the top.

### 5.5 Dashboard

```
┌────────────────────────────────────────────────┐
│  Page Header (greeting, time period selector)  │
├────────────────────────────────────────────────┤
│  ┌────────┬────────┬────────┬────────┐        │
│  │  Stat  │  Stat  │  Stat  │  Stat  │        │
│  └────────┴────────┴────────┴────────┘        │
├────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌────────────────┐    │
│  │     Chart        │  │   List         │    │
│  │                  │  │                │    │
│  └──────────────────┘  └────────────────┘    │
└────────────────────────────────────────────────┘
```

Stat cards are 4-up on desktop, 2-up on tablet, stacked on mobile. Charts and lists in 2-column grid on desktop, stacked on smaller screens.

The AI generates dashboard layouts conservatively — it's easy to over-stuff a dashboard. Better to ship 4 useful stats than 12 confusing ones.

### 5.6 Workflow / Wizard

For multi-step user flows (sign-up, onboarding, multi-step forms):

```
┌────────────────────────────────────────────────┐
│  Stepper (1—2—3—4)                              │
│                                                 │
│  Step Title                                     │
│  Step description                               │
├────────────────────────────────────────────────┤
│                                                 │
│  Centered step content (max-width 640px)       │
│                                                 │
│  [← Back]                          [Continue → ]│
└────────────────────────────────────────────────┘
```

State preserved across steps (using URL params and form state). The user can navigate back without losing progress.

---

## 6. Component Conventions

### 6.1 Buttons

Three primary variants (matches shadcn/ui's API):

- **default** (filled with primary): the page's main action
- **secondary** (filled with secondary): supporting actions
- **outline** (border only): tertiary
- **ghost** (no background): inline / table actions
- **destructive** (filled with destructive): delete, remove
- **link** (text only): inline links that are actions

Sizes: `sm` (32px), `default` (40px), `lg` (48px). Generated apps default to `default` — slightly bigger than platform UI to feel less dense.

Icon buttons use `size="icon"` (square). All have `aria-label`.

Loading state: spinner + disabled. Buttons don't change size when loading.

### 6.2 Forms

Generated forms follow the shadcn/ui `<Form>` pattern with react-hook-form + zod:

```tsx
const formSchema = z.object({
  name: z.string().min(1, 'Required'),
  email: z.string().email(),
});

function ContactForm() {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });
  
  const onSubmit = (values) => {
    // Calls SDK
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* ... */}
        <Button type="submit">Save</Button>
      </form>
    </Form>
  );
}
```

The AI generates this shape. Validation is derived from the schema (required, types, length limits). Custom validation rules (e.g., "this email must be unique") happen as a check in the submit handler.

### 6.3 Tables

Built on TanStack Table v8 + TanStack Virtual.

- Default row height: 48px (more breathing room than platform UI)
- Header: 40px
- Hover: subtle background change
- Selection: checkbox column on the left
- Sort: click header
- Filter: optional per-column filter popovers; URL-encoded
- Pagination: cursor-based via the SDK

Mobile: tables collapse to cards. Each row becomes a card with primary fields prominent and secondary fields subtle. The AI generates the card layout from the schema (which fields to show prominently is inferred or specified in the PRD).

### 6.4 Empty States

Pattern: **icon + headline + helpful sub-message + primary action**.

```
        [Icon]
    
    No contacts yet
    
  Add your first contact to start managing your customer relationships.
  
        [+ New Contact]
```

Empty states are warm but not cute. They tell the user what they're missing and how to fix it.

### 6.5 Loading States

Three loading patterns:

- **Skeleton**: for tables, lists, detail pages — show the structure with placeholder shapes
- **Spinner**: for in-progress actions inside buttons or small areas
- **Page-level loading**: a centered spinner with "Loading..." for the rare case of a full-page load

Skeletons match the actual content's shape. A list of 10 items shows 10 skeleton rows, not a generic spinner.

### 6.6 Error States

Three error categories:

- **Network errors**: a retry button, "Couldn't load. Try again."
- **Permission errors**: explain what permission is missing, who to contact
- **Server errors**: generic message + retry, optionally a "Report this" link

Errors don't blame the user. Errors don't show stack traces. Errors are friendly but not falsely cheerful.

### 6.7 Notifications and Toasts

Generated apps use shadcn/ui's `<Toaster>`:

- Success toasts (green): "Contact saved"
- Info toasts (blue): "Updates received"
- Warning toasts (amber): "Connection unstable"
- Error toasts (red): "Failed to save"

Position: top-right on desktop, top-center on mobile (where the right edge is too narrow).

Duration: 4s default; persistent for errors with action buttons.

### 6.8 Dialogs

Three categories (matches platform UI):

- **Confirmation** (small, 480px): destructive actions
- **Form** (medium, 560–720px): inline create/edit
- **Sheet** (slide-in from right): non-modal panels

Mobile: dialogs become full-screen modals. Sheets become bottom sheets.

### 6.9 Navigation

Generated apps use whichever pattern fits:

- **Top nav** for content-heavy apps (blogs, marketing)
- **Side nav** for tool-style apps (CRM, dashboard, admin)
- **Bottom nav** for mobile-first apps (rare, but supported when the PRD specifies)
- **Hamburger menu** on mobile when desktop has a side nav

Active route indication: bold text + accent color underline (top nav) or accent background (side nav).

### 6.10 Forms in Tables (Inline Editing)

For data-browser-style apps where inline editing makes sense:

- Double-click cell to edit
- Enter saves; Escape cancels
- Optimistic update with rollback on error
- Conflict resolution (Objective 18's pattern)

This is opt-in per table, based on PRD requirements. Most apps use modal forms; data-management apps use inline.

---

## 7. Specialized Patterns

### 7.1 Authentication Flows

Generated apps include auth screens (Stage 6, Section 5.X mentions):

- Sign up
- Sign in
- Password reset
- MFA setup and verification
- Account / profile

These follow the platform's auth UI patterns (Objective 16) but styled with the customer's design tokens. Same flows; different visual identity.

### 7.2 Permission-Aware UI

Generated components check permissions before rendering edit/delete controls:

```tsx
const { canEdit, canDelete } = usePermissions('contacts');

<TableActions>
  {canEdit && <EditButton />}
  {canDelete && <DeleteButton />}
</TableActions>
```

Routes are guarded; users without access see a clean "You don't have access to this page" with a way to request access.

PII columns hide their values from users without `pii.read` permission — showing `••••••@example.com` instead of `alice@example.com`.

### 7.3 Real-Time Where Specified

When the PRD says an entity is real-time, generated lists and detail views subscribe via the SDK:

```tsx
function ContactsList() {
  const { data, refetch } = useQuery(...);
  
  useRealtime(platform.realtime('contacts'), {
    onChange: () => refetch(),
  });
  
  return <Table data={data} />;
}
```

Realtime indicator: a small pulsing dot in the table header showing "Live" status. When the connection drops, a "Reconnecting..." banner appears.

### 7.4 File and Image Handling

For columns of type `file`, `image`, `video`:

- **List view cell**: thumbnail (image/video) or icon + filename (file). Click to preview.
- **Detail view**: full preview rendered (image, video player, PDF embed).
- **Edit form**: file picker using SDK's storage client; tus.io for resumable upload; preview before saving.

### 7.5 Foreign Key UI

FK columns become combobox pickers in forms:

```tsx
<FormField name="contactId">
  <FormLabel>Contact</FormLabel>
  <ContactCombobox /> {/* searchable, shows display value, links to detail */}
</FormField>
```

In list/detail views, FK columns display the related entity's display value (not the UUID), with a click-to-navigate link.

### 7.6 Search

Generated apps include a search component when the PRD calls for it. Default: a top-bar search box with autocomplete from the relevant entities.

Implementation: uses the SDK's filter API (Objective 12); generates a debounced query; displays results grouped by entity type.

For more advanced search (full-text, faceted), the customer can extend post-generation.

### 7.7 Settings / Account Pages

Standard sections:

- Account (email, password, MFA)
- Notifications (preferences)
- Workspace (if multi-tenant; team management, invitations)
- Integrations (third-party connections)
- Billing (if monetized)
- Data (export, delete account)

Generated based on PRD requirements. Customers can customize post-generation.

---

## 8. Mobile Responsiveness

### 8.1 Breakpoints

Generated apps use Tailwind's defaults (set by Stage 3's tokens):

```
sm   640px   small phones / large phones in landscape
md   768px   tablets
lg   1024px  small laptops
xl   1280px  desktops
2xl  1536px  large monitors
```

Generated apps are mobile-first: base styles target the smallest screen; `md:`, `lg:`, etc. add breakpoint-specific styles.

### 8.2 Touch Targets

All interactive elements are at least 44×44px on touch devices. Buttons in dense interfaces (like inline table actions) maintain this minimum even when they look smaller — the click area exceeds the visual.

### 8.3 Mobile-Specific Patterns

- **Bottom sheets** instead of side sheets
- **Full-screen modals** instead of centered dialogs
- **Hamburger menus** instead of side nav
- **Stacked forms** instead of multi-column
- **Card lists** instead of tables
- **Pull-to-refresh** on lists (when realtime isn't available)
- **Swipe gestures** for common actions (delete, archive) — opt-in per PRD

### 8.4 Performance on Mobile

- Code splitting per route (Vite handles this by default)
- Lazy-loading for heavy components (charts, rich editors)
- Image optimization (Stage 3's tokens drive size; the SDK handles resized variants)
- Skeleton states to prevent layout shift

---

## 9. Accessibility

WCAG 2.2 AA. Validated by axe-core during Stage 6's generation. Generated apps that fail accessibility don't pass review.

### 9.1 Color Contrast

Stage 3's tokens already enforce AA. The AI applies tokens correctly; nothing falls below the floor.

### 9.2 Keyboard Navigation

- Tab order matches visual order
- Focus rings visible (uses tokens)
- Modal trap focus
- Escape closes overlays
- Skip-to-content link on every page

### 9.3 Screen Readers

- Every form input has a label
- Every icon button has `aria-label`
- Tables use semantic markup
- Dynamic content uses `aria-live`
- Loading states announced

### 9.4 Forms

- Required fields marked with `*` AND `aria-required`
- Errors announced to screen readers
- Field associations correct (`htmlFor`)

### 9.5 Motion

- Respects `prefers-reduced-motion`
- No flashing content
- No autoplay video with sound

### 9.6 Internationalization

The platform's i18n scaffolding (Objective 16) is in place but English-only by v1. Generated apps inherit this. The structure supports translation when added later — no hardcoded strings outside translation files.

---

## 10. Voice and Tone

Generated apps inherit voice from the customer's brand inputs (Stage 3). The AI generates copy that matches the customer's specified tone (professional, playful, formal, casual, etc.).

But across all customer apps, baseline rules apply:

### 10.1 Defaults

- **Active voice over passive**
- **Specific over vague**
- **Helpful over apologetic**
- **Plain over jargon**
- **Consistent over creative**

### 10.2 Examples

Standard generated copy:

- Sign in: "Sign in" (not "Login")
- Sign out: "Sign out"
- Settings: "Settings"
- Profile: "Profile" or "Account" (varies by app type)
- Save: "Save" (not "Submit", unless the form is form-y)
- Delete: "Delete" (always confirmed)
- Required field marker: `*`

### 10.3 Customer Customization

The customer can override every string post-generation. The platform doesn't enforce voice rigidity — but the AI's generation defaults are professional and clear.

### 10.4 Empty States

Pattern: **what this is + how to start**.

- "No contacts yet. Add one to get started. [+ New Contact]"
- "Your inbox is empty. Welcome!"

### 10.5 Error Messages

Pattern: **what happened + (optional) what to do**.

- "Couldn't load contacts. Check your connection and try again."
- "This email is already used. Try signing in instead."

---

## 11. Generated Code Quality

### 11.1 Readability

Generated code is readable by a competent React engineer. Patterns:

- One component per file (named export)
- Props typed with explicit interfaces
- No clever tricks; standard hooks, standard patterns
- Comments only when the AI's choice isn't obvious from the code

### 11.2 File Organization

```
src/
├── components/
│   ├── ui/              # shadcn/ui primitives
│   ├── ContactsList.tsx
│   ├── ContactsList.stories.tsx
│   ├── ContactForm.tsx
│   └── ContactForm.stories.tsx
├── pages/
│   ├── HomePage.tsx
│   ├── ContactsPage.tsx
│   └── ContactDetailPage.tsx
├── lib/
│   ├── platform.ts       # SDK client setup
│   └── utils.ts
├── App.tsx
└── main.tsx
```

The structure is conventional. Customer engineers find what they expect to find.

### 11.3 Type Safety

- TypeScript strict mode
- No `any` (the AI's generation prompt forbids it)
- SDK types from `pdm sync-types` provide schema-aware types
- zod schemas for form validation match TypeScript types

### 11.4 Consistency Across Components

The AI generates components that share patterns. Two list components in the same app use the same column priority logic, the same toolbar layout, the same empty state pattern. This is partly the prompt's discipline and partly Stage 6's consistency check (Objective 26, Section 5.13).

### 11.5 Editability

When a customer engineer edits a generated component, the platform tracks "AI-generated regions." Subsequent regenerations of the same component won't trample human edits — they're merged where possible, conflict-flagged where not.

This is what makes "the AI generates, you maintain" actually work.

### 11.6 Code Review Comfort

Generated code passes:

- `eslint` with the platform's config
- `prettier` formatting
- `tsc --strict`
- `vitest` unit tests (Stage 8 generates these)
- `@axe-core/playwright` accessibility tests

Customer engineers reviewing generated code see code that meets their team's standards by default. They aren't fighting the AI's style.

---

## 12. Per-App-Type Variations

Some app types have specific patterns. Stage 6's prompts have variants for common types.

### 12.1 CRM-Style

- Heavy use of FK comboboxes (contacts → deals → activities)
- Pipeline / Kanban view for deal stages
- Activity timelines
- Bulk operations on lists

### 12.2 Dashboard

- Stat cards
- Charts (Recharts via shadcn-style chart primitives)
- Time period selectors
- Drill-down from cards/charts to detail views

### 12.3 Blog / Content

- Article list with pagination
- Article detail with rich rendering (Markdown, HTML, embeds)
- Comments (if PRD specifies)
- Author pages

### 12.4 E-Commerce-Adjacent

- Product list with grid view
- Product detail with image gallery
- Cart / checkout flow (if PRD specifies)
- Order history

The platform's generated apps **are not e-commerce platforms** in the Shopify sense — payments require integration adapters from Stage 7 (Stripe) and aren't generated automatically. The customer adds them.

### 12.5 Internal Admin Tools

- Density-leaning layouts (closer to platform UI's defaults)
- More tables, fewer forms
- Bulk operations prominent
- Filters and saved views

### 12.6 Customer Portal

- Limited surface (only what the end customer needs)
- Heavy emphasis on clarity
- Explicit help and support links
- Account / billing prominent

---

## 13. Brand Customization

### 13.1 What Stage 3 Captures

- Logo (uploaded image)
- Brand colors (1-3 hex, with locks)
- Vibe descriptors (3-5 from a curated list + free-text)
- Reference URLs (optional, AI fetches and analyzes)
- Font preferences (system default, Google Font opt-in)

### 13.2 What Stage 3 Generates

A complete token set covering all categories. Light + dark themes. AA-validated.

### 13.3 What This Means for Generated Apps

The same generation pipeline produces visually different apps based on tokens:

- A CRM with `oklch(0.55 0.20 250)` (deep blue) primary feels different from a CRM with `oklch(0.60 0.18 145)` (forest green) primary
- A blog with serif typography feels different from a blog with sans-serif
- A dashboard with tight spacing feels different from one with generous spacing

The customer's brand drives visual identity. The platform's patterns drive functional consistency.

### 13.4 Brand Don'ts

The AI doesn't:

- Use the customer's brand colors in ways that fail accessibility (it adjusts within their hue family until AA passes)
- Generate font choices that are dramatically different from the customer's brand
- Override the customer's locked colors

The AI does:

- Suggest harmonious additions (secondary, success, warning, danger colors that work with the primary)
- Flag accessibility issues with brand colors and propose alternatives
- Produce both light and dark themes from any single brand color set

---

## 14. Common Pitfalls

What goes wrong if Stage 6's prompts drift, and what to watch for.

### 14.1 The "AI Slop" Problem

Symptoms: generic-looking apps that all feel the same despite different design tokens, inconsistent component patterns within a single app, uninspired empty states, mediocre copy.

Cause: prompts that don't anchor to specific patterns; whole-app generation; insufficient quality signals.

Mitigation: per-component generation (Objective 26's discipline), strict pattern adherence, prompt test suites with golden examples, quality signals tracking.

### 14.2 The "Doesn't Look Like the Brand" Problem

Symptoms: customer says "this doesn't feel like our brand" even though tokens are correct.

Cause: the AI applied tokens mechanically without understanding the brand's vibe.

Mitigation: Stage 3's vibe descriptors and reference URLs; the AI uses them to inform component selection (more rounded for "playful", sharper for "professional"); generation prompts reference the vibe explicitly.

### 14.3 The "Doesn't Work on Mobile" Problem

Symptoms: tables overflow, modals don't fit, touch targets are too small.

Cause: AI generates desktop-first instead of mobile-first.

Mitigation: prompts explicitly require mobile-first; axe-core checks and visual regression tests on multiple viewport sizes; PRD-driven specification of mobile importance.

### 14.4 The "Code is Hard to Edit" Problem

Symptoms: customer engineers fight the AI's patterns; refactoring is painful.

Cause: AI generates clever code, custom abstractions, non-standard patterns.

Mitigation: generation prompts forbid clever; require standard React + TanStack patterns; quality signal tracks edit volume after approval (high edit volume signals friction).

### 14.5 The "Inconsistent Across Pages" Problem

Symptoms: the contacts list and the deals list use different layouts, different table behaviors, different empty states.

Cause: per-component generation without consistency enforcement.

Mitigation: Stage 6's consistency check prompt (Objective 26, Section 5.13) reviews all generated components and flags inconsistencies for regeneration.

---

## 15. What This Guide Does NOT Cover

- **Specific component implementations.** The shadcn/ui components themselves are documented at shadcn-ui's site.
- **Stage 3's token generation logic.** Covered in Objective 23.
- **Stage 6's generation prompts.** Covered in Objective 26.
- **Customer-specific deviations.** Customers can edit anything post-generation; the platform doesn't enforce this guide on edited code.
- **Generated email templates.** Auth emails are customer-branded but minimal; transactional emails depend on Stage 7's integration adapters.
- **Marketing pages or landing pages.** Generated apps focus on the operational surface; marketing is the customer's concern.
- **Native mobile apps.** Generated apps are responsive web; native iOS/Android is out of scope.

---

## 16. Decision Log (Initial)

| Date | Decision | Why |
|------|----------|-----|
| 2026-05 | React + Vite + Tailwind + shadcn/ui as the locked stack | Mature, AI-friendly, copy-paste customization |
| 2026-05 | TanStack Query for server state, no Redux | Most apps don't need a state library |
| 2026-05 | shadcn over Material UI / Chakra | Copy-paste model fits AI generation; customer-owned code |
| 2026-05 | Mobile-responsive by default | Real workflows happen on phones |
| 2026-05 | Default row height 48px (vs platform UI's 32px) | End users want breathing room; platform users want density |
| 2026-05 | No Redux/Zustand by default | Adds complexity without value for typical apps |
| 2026-05 | Customer brand colors honored even when accessibility-edge | AI adjusts within the hue; never overrides |
| 2026-05 | Storybook stories per component | Documentation + visual regression value worth the cost |
| 2026-05 | shadcn/ui primitives in `src/components/ui/` | Customer owns the components; not a black-box dependency |
| 2026-05 | English-only at v1; i18n scaffolding in place | Translations are future work; structure supports them |

---

*This guide is the contract for what Stage 6's generation produces. Implementation lives in `packages/core/src/ai/prompts/ui-generation/`. When this guide and Objective 26 conflict, this guide wins for visual decisions; the objective wins for functional decisions.*

*Status: v1, written before Stage 6 ships. Will iterate as the first generated apps reveal what's missing or wrong.*
