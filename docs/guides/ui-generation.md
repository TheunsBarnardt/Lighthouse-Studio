# UI Generation Guide (Stage 6)

Stage 6 of the AI Build Pipeline generates a complete React + Vite + TypeScript application from your approved PRD, design tokens, and database schema.

## Prerequisites

Before starting UI generation:

- PRD approved (Stage 2)
- Design tokens approved (Stage 3)  
- Schema approved (Stage 4)
- Data migrations complete if applicable (Stage 5)

## What gets generated

For a typical CRM application with 3 entities, the pipeline generates:

| Artifact | Count |
|----------|-------|
| Page components | 8–15 |
| Shared components (AppShell, Navigation) | 2–4 |
| Auth pages (sign-in, sign-up, etc.) | 2–4 |
| Router config | 1 |
| Build config (package.json, tsconfig, vite, tailwind) | 4–6 |
| Storybook stories | 1 per component |

Total: typically 20–35 files, 2,000–5,000 lines of TypeScript.

## Generation flow

### 1. Information Architecture

First, the pipeline generates the Information Architecture (IA) — a structured description of every page, its type, its navigation slot, and its component decomposition. The IA is derived from your PRD's feature list and your schema's entity list.

Review the IA before proceeding. You can:
- Add or remove pages
- Change page types (list → dashboard)
- Adjust navigation order

Regenerating the IA after approving components will invalidate those components.

### 2. Component generation

Components are generated in parallel groups:
1. Build config (package.json, vite, tsconfig, tailwind)
2. App shell (AppShell, Navigation)
3. Auth pages (sign-in, sign-up, forgot-password)
4. Router config
5. Content pages (in parallel, grouped by entity)

Each component is validated for TypeScript correctness and WCAG 2.1 AA accessibility. Accessibility violations trigger one automatic fix attempt.

Estimated time: 3–8 minutes for a 12-component project.

### 3. Code review

The code review UI shows:

- **Project tree** — all files with status badges (approved ✓, draft, issue !)
- **Code viewer** — line-numbered source with Approve and Regenerate buttons per file
- **Live preview** — sandboxed iframe rendering the component with mock data

Review each component. Click **Approve** when satisfied, or **Regenerate** with optional feedback to request changes.

### 4. Export

Once satisfied, export the project:

- **ZIP download** — full project bundle ready for `npm install && npm run dev`
- **Push to GitHub** — creates a new repository in your connected GitHub account
- **Open in StackBlitz** — instant browser IDE

You do not need to approve all components before exporting. Unapproved components are included in the export with a comment marking them as draft.

## Generated code conventions

### Data fetching

List and detail pages use TanStack Query:

```tsx
const { data, isLoading } = useQuery({
  queryKey: ['contacts'],
  queryFn: () => platform.data('contacts').list({ limit: 50 }),
});
```

The `platform` SDK client is pre-configured with the workspace URL and auth headers.

### Permission checks

Every create/update/delete action is gated by `usePermissions()`:

```tsx
const { can } = usePermissions();

{can('contact.create') && (
  <Button onClick={() => navigate('/contacts/new')}>New Contact</Button>
)}
```

Permissions are sourced from the RBAC configuration in your platform workspace.

### Forms

Create and edit forms use react-hook-form with zod schemas:

```tsx
const schema = z.object({
  full_name: z.string().min(1),
  email: z.string().email(),
});

const form = useForm({ resolver: zodResolver(schema) });
```

Form schemas are derived directly from your database schema's validation constraints.

### Optimistic concurrency

Edit forms include a hidden `_version` field. The platform SDK rejects updates where the version has changed since the form was loaded, surfacing a conflict resolution UI.

## Regenerating components

Click **Regenerate** on any component to request a new version. You can provide feedback:

> "Add a search bar above the table. Show a status badge (Active/Inactive) in the Status column. Sort by created_at descending by default."

The regeneration prompt receives your original PRD section, schema, design tokens, and your feedback. It preserves the component's API shape (props, exports) so dependent components don't break.

## Storybook stories

Every component ships with a `.stories.tsx` file using CSF3 format:

```tsx
export const Default: Story = {
  args: { contacts: mockContacts },
};

export const Empty: Story = {
  args: { contacts: [] },
};

export const Loading: Story = {
  args: { isLoading: true },
};
```

Stories mock the platform SDK so no backend is required to run Storybook.

## Cost

Approximate cost per 12-component project (claude-opus-4-7 for IA and complex components, claude-haiku for simpler prompts):

| Phase | Model | Est. cost |
|-------|-------|-----------|
| IA generation | opus | $0.15 |
| App shell + auth (4 components) | opus | $0.30 |
| Content pages (8 components) | opus | $0.60 |
| Storybook stories (12) | haiku | $0.05 |
| Accessibility fixes (avg 3) | haiku | $0.01 |
| **Total** | | **~$1.10** |

Costs vary with schema size. A 20-table schema with complex relationships will cost more. Monitor workspace AI usage in Settings → Usage.

## Troubleshooting

See runbooks:
- [Preview server not responding](../runbooks/ui-generation-preview-server-restart.md)
- [Component generation stuck](../runbooks/ui-generation-component-generation-stuck.md)
- [Export failing](../runbooks/ui-generation-export-failure.md)
- [TypeScript validation errors](../runbooks/ui-generation-typescript-validation-errors.md)
- [Persistent accessibility violations](../runbooks/ui-generation-accessibility-persistent-violations.md)
