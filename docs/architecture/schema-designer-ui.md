# Schema Designer UI — Architecture Guide

This document describes the architecture of the Schema Designer UI (`apps/web/src/`). It is intended for contributors adding features, new column types, or new views.

---

## Component Map

```
apps/web/src/
├── app/
│   ├── data-management/
│   │   ├── page.tsx                              Schema list + CreateSchemaDialog
│   │   └── [schemaSlug]/
│   │       ├── page.tsx                          Loads SchemaDesigner component
│   │       ├── history/page.tsx                  Version history timeline
│   │       └── api-explorer/page.tsx             OpenAPI explorer (Obj 12)
│   └── layout.tsx                                Root layout (Geist fonts, ThemeProvider)
├── components/
│   ├── schema-designer/
│   │   ├── schema-designer.tsx                   Main coordinator (loads schema, tab switcher)
│   │   ├── diagram-view/
│   │   │   ├── diagram-view.tsx                  ReactFlow container
│   │   │   ├── table-node.tsx                    @xyflow custom node
│   │   │   └── diagram-toolbar.tsx               Add Table + Fit buttons
│   │   ├── table-view/
│   │   │   ├── table-view.tsx                    Table list sidebar + column grid
│   │   │   └── column-row.tsx                    Per-column editable row
│   │   ├── code-view/
│   │   │   └── code-view.tsx                     Monaco editor (lazy-loaded)
│   │   └── lifecycle/
│   │       ├── create-schema-dialog.tsx          Template selector + form
│   │       ├── validation-banner.tsx             Error/warning/info badge strip
│   │       └── deploy-bar.tsx                    Validate → Preview → Deploy workflow
│   ├── theme-provider.tsx                        Reads localStorage, sets data-theme attribute
│   └── ui/                                       Base components (button, input, select, etc.)
├── lib/
│   ├── types.ts                                  Client-side type mirrors of backend model
│   ├── api-client.ts                             Typed fetch wrapper for schema REST API
│   ├── schema-utils.ts                           Pure schema manipulation functions
│   └── utils.ts                                  cn() helper
├── state/
│   └── designer-store.ts                         Zustand + Immer store (single source of truth)
└── styles/
    ├── design-tokens.css                         CSS variables for colors, spacing, typography
    └── globals.css                               Tailwind + design token imports
```

---

## State Model

The Zustand store (`designer-store.ts`) is the single source of truth for all schema designer state.

```typescript
interface DesignerState {
  workspaceId: string | null;
  schema: CustomerSchema | null; // In-memory working copy
  deployed: CustomerSchema | null; // Last deployed (server) version
  isDirty: boolean; // schema !== deployed
  selectedTableId: string | null;
  selectedView: 'diagram' | 'table' | 'code';
  validationReport: ValidationReport | null;
  migrationPreview: MigrationPreview | null;
  isLoading: boolean;
  error: AppError | null;
}
```

### View-sync invariant

All mutations go through `updateSchema(draft => { ... })`. This is an Immer producer — mutate the draft, get a new immutable schema. React subscriptions in all three views re-render automatically.

**Never:**

- Store schema state locally in a view component
- Let two views communicate directly
- Call the API directly from a view (go through the store actions)

### Selectors

```typescript
selectCanDeploy(state); // validationReport valid && migrationPreview present
selectHasErrors(state); // validationReport has errors
selectTableById(id)(state);
```

---

## Capability-Aware Controls

The `DRIVER_CAPABILITIES` object in `lib/types.ts` maps each `DatabaseDriver` to a set of boolean feature flags.

When rendering a control that depends on a capability:

```tsx
const caps = DRIVER_CAPABILITIES[schema.databaseDriver];
<Tooltip content="Arrays not supported on SQL Server">
  <Select disabled={!caps.arrays} ...>
</Select>
</Tooltip>
```

The tooltip should explain _why_ the control is disabled and (when available) link to the capability matrix.

---

## Adding a New Column Type

1. Add the new variant to `NormalizedType` in `lib/types.ts`.
2. Add a human-readable label in `normalizedTypeName()` in `lib/schema-utils.ts`.
3. Add the kind to `ALL_KINDS` in `column-row.tsx`.
4. If the type is driver-specific (e.g., arrays), add a `DriverCapabilities` flag and gate the option in the type selector.
5. Update the backend `NormalizedTypeSchema` (in `packages/core`) to match.
6. Write a Storybook story showing the new type in the column row.

---

## Adding a New View

1. Create the view component in `components/schema-designer/<view-name>/`.
2. Subscribe to the store with `useDesignerStore(s => s.schema)`.
3. Write mutations via `const updateSchema = useDesignerStore(s => s.updateSchema)`.
4. Add the view to the tab list in `schema-designer.tsx`.
5. The view should render correctly even when `schema` is null (show an empty state).

---

## Testing Strategy

- **Zustand store:** Test state transitions directly without React. Import the store, call actions, assert state.
- **Schema utility functions:** Pure functions — unit test with vitest.
- **Component tests:** Use `@testing-library/react` with a `DesignerStoreProvider` that initializes the store with test data.
- **Visual regression:** Storybook snapshot tests (light + dark themes).
- **Accessibility:** axe-core on every component story via `@storybook/addon-a11y`.

---

## Design Tokens

All colors, spacing, and typography values come from CSS variables defined in `styles/design-tokens.css`. Never use hardcoded hex colors or pixel values.

Tailwind classes reference these variables via the `tailwind.config.cjs` configuration:

```css
/* design-tokens.css */
:root {
  --color-primary: 220 90% 56%; /* HSL triple, no hsl() wrapper */
}
```

```js
// tailwind.config.cjs
colors: {
  primary: 'hsl(var(--color-primary) / <alpha-value>)',
}
```

Dark theme: set `data-theme="dark"` on `<html>`. `ThemeProvider` reads `localStorage` and sets the attribute on mount.

---

## Bundle Budget

The schema designer route (`/data-management/[schemaSlug]`) must stay under **350 KB gzipped** first load.

Current state (2026-05-03): **164 KB** first load JS.

Key rules:

- Monaco is lazy-loaded (`next/dynamic({ ssr: false })`) — it only loads on Code view open.
- @xyflow/react is always loaded for the diagram view; it is acceptable in the initial bundle.
- Avoid adding large dependencies (chart libraries, PDF renderers, etc.) to the designer route without a lazy-load strategy.

Check bundle size: `pnpm -C apps/web build` and read the route size table in the output.
