# Objective 26: Stage 6 — UI Generation

**Status:** Ready for development
**Prerequisites:** Objectives 19 (Public SDK), 20 (AI Pipeline Foundation), 22 (Stage 2: PRD), 23 (Stage 3: Design Tokens), 24 (Stage 4: Schema), 25 (Stage 5: Data Migration — for non-greenfield) complete
**Blocks:** Objective 27 (Stage 7: Code Generation — server-side logic the UI calls), Objective 29 (Stage 9: Deployment)

---

## 1. Purpose

This is the stage where the AI pipeline starts producing **the actual product**. Not artifacts about the product, not specifications, not schema definitions — actual React components, page layouts, forms, tables, navigation. The customer can run what comes out of this stage.

The inputs are everything generated up to now: design tokens (the visual language), the schema (the data shape), the PRD (what should exist and how it should behave). The output is a complete, functional, accessible, runnable frontend application that talks to the platform's auto-generated APIs via the Public SDK.

A good UI generation stage:

- **Composes from the design tokens** — every color, spacing, typography decision flows from Stage 3
- **Renders the schema** — every table the user defined has appropriate views (list, detail, edit, create)
- **Implements the PRD's user stories** — the workflows described become navigable flows in the app
- **Uses the SDK correctly** — auth, data fetching, real-time, storage, all through the public SDK
- **Is accessible** — WCAG 2.2 AA inherited from design tokens; preserved through component generation
- **Is editable** — generated code is readable; users can customize after generation
- **Is regenerable** — small intent or PRD changes regenerate affected components, not the whole app

Done well, the customer has a working app at this stage that genuinely matches what they described. Done poorly, the customer has React-shaped slop and rebuilds from scratch.

This stage is the most code-intensive in the pipeline. The AI is generating real source files; the platform stores them as artifacts; the customer reviews them in something resembling a code review interface.

---

## 2. Scope

### In Scope

- **Page generation**: routes derived from the PRD's information architecture
- **Component generation**: standard CRUD components per schema entity (list, detail, edit form, create form)
- **Layout generation**: app shell (navigation, header, footer); page layouts
- **Form generation**: schema-aware forms with validation matching schema constraints
- **Table generation**: lists with filtering, sorting, pagination using the SDK
- **Detail view generation**: per-record viewers with related data
- **Workflow generation**: multi-step flows from PRD user stories
- **Navigation**: derived from the IA; sidebar/topbar generation
- **Authentication integration**: sign-in/sign-up/session management using the SDK's auth client
- **Real-time integration**: live-updating lists and detail views via the SDK's realtime client
- **File handling**: upload, preview, download for file-typed columns via the SDK's storage client
- **Permission-aware UI**: components hide/disable controls based on user permissions
- **Accessibility**: every component meets WCAG 2.2 AA; verified with axe-core during generation
- **Component review UI**: the customer reviews generated components in a code-diff style with live previews
- **Section-level approval**: pages, components, layouts approved independently
- **Iterative refinement**: regenerate specific components or pages with feedback
- **Code that's editable post-generation**: clean, readable React with conventional patterns
- **Storybook stories**: per generated component, a Storybook story for documentation
- **Foundation for Stage 9 (Deployment)**: produced code is committable to the workspace's repo
- ADRs

### Out of Scope (Belongs to Later Objectives)

- Server-side logic / API endpoints (Stage 7: Code Generation)
- Custom server-side actions (Stage 7)
- Tests for the generated UI (Stage 8: Test Generation; this stage produces components, Stage 8 produces their tests)
- Deployment of the running app (Stage 9)
- Mobile app generation (deferred indefinitely; mobile-responsive web is in scope)
- Native desktop apps (out of scope; web-first)
- AI-generated illustrations or custom imagery (deferred; uses default placeholders or customer-supplied)
- Animation choreography beyond what design tokens specify (deferred)
- Multi-page application state management complexity beyond what TanStack Query/React Context naturally provides (deferred)
- A/B testing infrastructure (deferred)
- Internationalization beyond i18n scaffolding (translations are a future objective)

---

## 3. Locked Decisions

| Decision                     | Choice                                                                              | Rationale                                   |
| ---------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------- |
| Frontend framework           | React (most mature ecosystem; aligns with platform's UI)                            | Don't fragment by technology                |
| Build tool                   | Vite                                                                                | Fast, modern, well-supported                |
| Routing                      | React Router 6                                                                      | Standard, mature                            |
| Styling                      | Tailwind CSS configured with Stage 3's tokens                                       | Aligns with token export                    |
| Component library base       | shadcn/ui (the platform's own choice)                                               | Consistency; copy-paste customization model |
| State management             | TanStack Query for server state; React Context for UI state                         | Standard, well-tested                       |
| Forms                        | react-hook-form + zod resolvers                                                     | Same as platform's UI                       |
| Component generation pattern | Per-page-and-per-component prompts; not whole-app                                   | Testable, focused                           |
| File organization            | Standard Vite-React project structure                                               | Familiar                                    |
| TypeScript                   | Strict; types from SDK's `pdm sync-types` output                                    | Type safety end-to-end                      |
| Accessibility validation     | axe-core during generation; failures retry once                                     | Accessibility non-negotiable                |
| Generated code style         | Prettier + ESLint with the platform's config                                        | Consistent style                            |
| Code review UI               | Side-by-side diff for regenerations; full preview for new components                | Mirrors GitHub PR experience                |
| Storybook                    | Generated alongside components; one story per component                             | Documentation; visual review                |
| Cost target                  | $5–$30 per full app generation (varies wildly with scope)                           | Cost-aware                                  |
| Approval routing             | Per workspace's `ui_components` stage; typically reviewer or designer in enterprise | Reuse engine                                |

---

## 4. Architectural Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                  INPUTS (from prior stages)                            │
│                                                                       │
│   - Approved PRD (what the app does)                                  │
│   - Design Tokens (how it looks)                                      │
│   - Schema (what data exists)                                         │
│   - SDK types (typed access to the data plane)                        │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│                  UI GENERATION SERVICE                                 │
│                                                                       │
│   1. Information architecture extraction — pages, navigation          │
│   2. Per-page component decomposition                                 │
│   3. Per-component generation                                         │
│   4. Layout / app shell generation                                    │
│   5. Routing configuration                                            │
│   6. SDK integration code                                             │
│   7. Accessibility validation per component                           │
│   8. TypeScript validation                                            │
│   9. Storybook story generation                                        │
│  10. Output as a coherent project tree                                 │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
                ┌────────────────────────┐
                │   Project Artifact      │
                │  - Source files          │
                │  - Component manifest    │
                │  - Page manifest         │
                │  - Routing config        │
                │  - Each file is its own  │
                │    sub-artifact          │
                └─────────────────────────┘
                             │
                             ▼
                ┌────────────────────────┐
                │   Code Review UI         │
                │  - Browse files          │
                │  - Diff view             │
                │  - Live preview          │
                │  - Approve per component │
                │  - Regenerate per file   │
                └─────────────────────────┘
                             │
                             ▼
                  Approved code → Stage 7 (Code Generation)
                  for server-side; Stage 9 for deployment
```

---

## 5. The Hard Parts

**5.1 The information architecture problem**

Before any component can be generated, the platform needs to know what pages exist and how they connect. The IA extraction:

- Reads PRD user stories and functional requirements
- Identifies primary entities (users, posts, comments, etc.)
- Identifies primary workflows (signup, browse, search, edit)
- Maps entities and workflows to pages
- Establishes navigation hierarchy

A typical CRM IA might produce:

- `/` → dashboard
- `/contacts` → list
- `/contacts/new` → create form
- `/contacts/:id` → detail
- `/contacts/:id/edit` → edit form
- `/deals` → list (similar pattern)
- `/deals/:id` → detail
- ... etc.

Plus auth pages, account pages, settings.

The IA is itself an artifact — reviewable, editable. The user can add or remove pages before component generation begins.

**5.2 Per-component generation pattern**

Just like PRD generation went per-section, UI generation goes per-component:

- Each page is a component
- Each major sub-component within a page is its own artifact
- Each generation is a focused prompt with focused inputs
- Components share types (from the SDK) but are generated independently

The orchestrator manages dependencies (a Page references its sub-Components). Independent components generate in parallel.

This pattern:

- Keeps prompts tight and testable
- Allows per-component regeneration without disrupting others
- Makes review tractable (review one component at a time, not 10,000 lines)
- Enables incremental improvement (fix a component without rebuilding the app)

**5.3 The standard CRUD pattern per entity**

For each schema table, generate a standard set:

- **List view**: a data browser-like grid using the SDK's data client; pagination, filtering, sorting; permission-aware row controls
- **Detail view**: shows a single record; embedded related data via FKs; edit and delete buttons (permission-aware)
- **Create form**: schema-driven form with validation; uses the SDK's insert mutation
- **Edit form**: same as create but pre-populated; uses the SDK's update mutation; optimistic concurrency

Variations per entity:

- Some entities are user-managed (CRUD all four)
- Some are admin-only (CRUD restricted)
- Some are read-only (just list/detail)
- Some have specialized views (a `users` table might have a "members" list with workspace context)

The PRD informs which variation each entity gets.

**5.4 Workflow generation from user stories**

Some user stories don't fit the CRUD pattern — they're multi-step workflows:

- "As a user, I want to import contacts from CSV" → multi-step wizard
- "As a sales rep, I want to convert a lead to a deal" → action with confirmation + form
- "As an admin, I want to bulk-archive expired records" → bulk action with preview

These become workflow components — a wizard, an action handler with dialog, etc. The AI identifies workflow patterns from user stories and generates appropriate components.

A workflow component has:

- Multiple steps
- State management between steps
- Validation per step
- Final action (typically calling an SDK mutation or a Stage 7 endpoint)

**5.5 Permission-aware UI generation**

The schema and PRD specify what each role can do. Generated UI respects this:

- Buttons hidden when the user lacks permission
- Forms read-only when the user can see but not edit
- Routes guarded so unauthorized users see "access denied" or are redirected
- Field-level permissions: PII columns redacted in display when the user lacks `pii.read`

The SDK's permission helpers make this straightforward — but the generated components must use them consistently. The AI is prompted to always check permissions before rendering edit/delete controls, never assume the current user can do everything.

**5.6 Real-time integration**

For entities the PRD says "should update in real-time," generated list and detail components subscribe via the SDK's realtime client:

```tsx
function ContactsList() {
  const { data } = useQuery(
    platform.data('contacts').where(...)
  );

  useRealtime(platform.realtime('contacts'), {
    onInsert: (event) => refetch(),
    onUpdate: (event) => refetch(),
    onDelete: (event) => refetch(),
  });

  // ...
}
```

The PRD's non-functional requirements specify which entities need real-time. The default is yes for entities used in collaborative workflows; no for write-once entities.

**5.7 File / image / video columns**

Columns of types `file`, `image`, `video` get special component treatment:

- **List view cell**: thumbnail (image/video) or icon (file) with click-to-preview
- **Detail view**: full preview rendered (image, video player, PDF embed)
- **Edit form**: file picker that uses the SDK's storage client; upload progress; preview of new vs. current

The components handle:

- Upload via tus.io for resumable
- Preview via signed URLs from storage
- Replace with new file
- Remove (clear the column)

**5.8 Foreign key UI**

FK columns in forms become combobox pickers:

- Search-as-you-type calling the related table's list endpoint
- Display the related entity's primary display column (configurable per FK in the schema)
- "Create new" option when applicable (open a modal with that table's create form)

In list/detail views, FK columns display the related entity's name/title (not the raw UUID), with a click-to-navigate link to the detail view.

**5.9 Form validation matches schema constraints**

The schema specifies columns: required/nullable, lengths, types, defaults, FKs. Generated forms reflect this:

- Required columns: `*` indicator, "required" validation
- Length constraints: maxLength on inputs
- Type-specific inputs: date pickers for dates, number inputs for numbers, etc.
- Validation messages: schema-aware ("must be a valid email", "must be unique within workspace")

zod schemas are derived from the customer schema and used for client-side validation. The same zod schema can be reused server-side (Stage 7) for symmetric validation.

**5.10 Accessibility validation per component**

After each component is generated, axe-core runs against the rendered output:

- Color contrast (inherited from design tokens; usually passes)
- Form labels properly associated
- Heading hierarchy
- Landmarks (nav, main, footer)
- ARIA roles used correctly
- Keyboard navigation works

Failures cause a single retry of the generation prompt with the failure feedback. Persistent failures surface to the user with a clear "this component failed accessibility checks" warning.

This is non-negotiable. WCAG 2.2 AA is the baseline; AI generation doesn't get to lower it.

**5.11 The code review UI**

The user reviews generated code component-by-component. The UI shows:

- **File tree**: navigate the generated project
- **Code view**: the source file in a syntax-highlighted viewer
- **Live preview**: the component rendered in an iframe, with sample data
- **Diff view**: when regenerating, show what changed
- **Approve / Reject / Regenerate**: per file or per component
- **Comments**: inline comments on specific lines for revision feedback

The preview iframe runs the generated component in isolation with mock data (from a schema-aware data factory). This lets the user see what the component looks like without deploying anything.

The code view is read-only initially. Power users can edit directly (after approval) — the platform supports edited-after-AI components, tracking which sections were AI-generated vs. human-edited.

**5.12 Iterative refinement**

The user looks at the contacts list, doesn't like the layout. They click "Regenerate this component" and provide feedback ("more compact rows", "show avatars", "add a sticky header").

The regeneration prompt receives:

- The original generation inputs (schema, PRD, tokens)
- The current component code
- The user's feedback
- The other components in the project (for consistency)

The new version replaces the old; old preserved as a previous version. Other components untouched.

For larger structural changes ("rethink the navigation"), the user regenerates the IA artifact, which then triggers regeneration of affected components.

**5.13 Quality signals**

Beyond Objective 20's generic signals:

- **Component acceptance rate**: how many generated components are approved without regeneration?
- **Accessibility pass rate**: how often does axe-core pass on first generation?
- **TypeScript compilation rate**: how often does the generated code compile without errors?
- **Edit volume after approval**: how much do users edit components post-approval?
- **Downstream issues**: did Stage 7 (Code Generation) hit problems integrating with these components?

These signals reveal which prompts produce code that works in practice.

---

## 6. Component Specifications

### 6.1 UiGenerationService

```typescript
// packages/core/src/services/ai/ui-generation/ui-generation.service.ts

export class UiGenerationService {
  constructor(
    private readonly authz: AuthorizationPort,
    private readonly artifacts: ArtifactService,
    private readonly generation: GenerationService,
    private readonly pipeline: StagePipelineService,
    private readonly storage: StorageService,
    private readonly accessibilityValidator: AccessibilityValidator,
    private readonly typeChecker: TypeChecker,
    private readonly audit: AuditPort,
    private readonly logger: LoggerPort,
  ) {}

  /** Generate the full UI project from prior artifacts. */
  async generateProject(ctx: RequestContext, input: GenerateProjectInput): Promise<Result<Artifact<UiProject>, AppError>>;

  /** Generate the IA only (page list + navigation). */
  async generateIa(ctx: RequestContext, input: GenerateIaInput): Promise<Result<Artifact<InformationArchitecture>, AppError>>;

  /** Generate a specific page. */
  async generatePage(ctx: RequestContext, projectId: string, pageId: string): Promise<Result<Artifact<UiPage>, AppError>>;

  /** Generate a specific component. */
  async generateComponent(ctx: RequestContext, projectId: string, componentSpec: ComponentSpec): Promise<Result<Artifact<UiComponent>, AppError>>;

  /** Regenerate a component with feedback. */
  async regenerateComponent(ctx: RequestContext, componentArtifactId: string, feedback?: string): Promise<Result<Artifact<UiComponent>, AppError>>;

  /** Get the project artifact. */
  async getProject(ctx: RequestContext, projectId: string): Promise<Result<Artifact<UiProject>, AppError>>;

  /** Get a single component. */
  async getComponent(ctx: RequestContext, componentArtifactId: string): Promise<Result<Artifact<UiComponent>, AppError>>;

  /** Approve a single component. */
  async approveComponent(ctx: RequestContext, componentArtifactId: string): Promise<Result<UiComponent, AppError>>;

  /** Approve the full project (all components). */
  async approveProject(ctx: RequestContext, projectId: string): Promise<Result<UiProject, AppError>>;

  /** Generate a live preview iframe URL for a component. */
  async getPreviewUrl(ctx: RequestContext, componentArtifactId: string): Promise<Result<{ url: string; expiresAt: Date }, AppError>>;

  /** Export the project as a downloadable archive. */
  async exportProject(ctx: RequestContext, projectId: string): Promise<Result<{ downloadUrl: string }, AppError>>;
}
```

### 6.2 The UI Project Artifact

```typescript
interface UiProject {
  prdArtifactId: string;
  designTokensArtifactId: string;
  schemaArtifactId: string;

  ia: InformationArchitecture; // navigation, routes, top-level structure

  // The generated files, organized as a project tree
  files: ProjectFile[];

  // Component decomposition
  pageArtifactIds: string[]; // each page is its own sub-artifact
  componentArtifactIds: string[]; // shared components

  // Build configuration
  buildConfig: BuildConfig; // package.json, tsconfig, vite.config, tailwind.config

  // Quality reports
  accessibilityReport: AccessibilityReport;
  typeCheckReport: TypeCheckReport;
  consistencyReport: ConsistencyReport;
}

interface InformationArchitecture {
  pages: PageDefinition[];
  navigation: NavigationDefinition;
  authPages: AuthPageDefinition[];
  globalLayouts: LayoutDefinition[];
}

interface PageDefinition {
  id: string;
  path: string; // route path
  title: string;
  pageType: 'list' | 'detail' | 'create' | 'edit' | 'workflow' | 'dashboard' | 'custom';
  primaryEntity?: string; // schema table id, if applicable
  components: ComponentRef[];
  permissions: PermissionRequirement[];
  realtimeEnabled: boolean;
  tracesTo: TraceabilityRef[]; // links back to PRD
}

interface UiComponent {
  id: string; // artifact ID
  projectId: string;
  pageId?: string; // null = shared/global component
  componentSpec: ComponentSpec;
  files: ProjectFile[]; // .tsx, .stories.tsx, etc.
  reasoning: ReasoningRecord;
  qualitySignals: ComponentQualitySignals;
}

interface ComponentSpec {
  componentName: string;
  componentType: 'page' | 'list' | 'form' | 'detail' | 'modal' | 'navigation' | 'layout' | 'utility';
  primaryEntity?: string;
  props: PropDefinition[];
  uses: { sdk: string[]; libraries: string[] };
}

interface ProjectFile {
  path: string; // relative path
  content: string;
  fileType: 'component' | 'page' | 'config' | 'style' | 'story' | 'manifest' | 'other';
  generatedBy?: string; // artifact id of the generation
  hash: string; // for diff detection on regeneration
}
```

### 6.3 The Generation Prompts

In `packages/core/src/ai/prompts/ui-generation/`:

- `information-architecture.prompt.ts` — extract IA from PRD
- `app-shell.prompt.ts` — generate the navigation/layout shell
- `list-component.prompt.ts` — list views per entity
- `detail-component.prompt.ts` — detail views per entity
- `create-form.prompt.ts` — create forms
- `edit-form.prompt.ts` — edit forms
- `workflow-component.prompt.ts` — multi-step flows from user stories
- `dashboard-component.prompt.ts` — dashboard pages
- `auth-pages.prompt.ts` — sign-in, sign-up, etc.
- `routing-config.prompt.ts` — React Router config from IA
- `build-config.prompt.ts` — package.json, vite.config, tsconfig, tailwind.config
- `storybook-story.prompt.ts` — generate a Storybook story per component
- `accessibility-fix.prompt.ts` — regenerate to fix axe-core failures
- `regeneration.prompt.ts` — component regeneration with feedback
- `consistency-check.prompt.ts` — verify components are consistent
- `orchestrator.prompt.ts` — top-level

Each follows Objective 20's `definePrompt` pattern with test suites that include rendered-component golden snapshots.

### 6.4 The Accessibility Validator

```typescript
// packages/core/src/services/ai/ui-generation/accessibility-validator.ts

export class AccessibilityValidator {
  /** Validate a component by rendering and running axe-core. */
  async validate(component: UiComponent): Promise<AccessibilityReport>;
}

interface AccessibilityReport {
  componentId: string;
  passed: boolean;
  violations: AxeViolation[]; // from axe-core
  warnings: string[];
  suggestions: string[];
}
```

The validator renders the component in a headless browser (Playwright); axe-core analyzes; report returned. Failures feed back to the regeneration prompt.

### 6.5 The TypeScript Type Checker

```typescript
export class TypeChecker {
  /** Compile the project and return any TS errors. */
  async check(project: UiProject): Promise<TypeCheckReport>;
}
```

Uses the TypeScript compiler API; checks the full project compiles. Errors feed back to regeneration. Persistent compile errors surface to the user.

### 6.6 The Component Renderer (for Preview)

The platform runs generated components in a sandboxed iframe for live preview:

- A small "preview app" hosted at `/preview/<component-artifact-id>`
- Loads the component plus mock data via the SDK
- Stage tokens applied via CSS variables
- Renders without affecting other parts of the platform

The mock data factory is schema-aware: it generates plausible sample data for any entity (faker-style — "Acme Corporation", "alice@example.com"). This makes previews look realistic without exposing real customer data.

### 6.7 The Code Review UI

Lives in `apps/web/src/ai-pipeline/ui-generation/`:

- `UiGenerationPage.tsx` — main page; layout shell
- `panels/ProjectTreePanel.tsx` — file tree
- `panels/CodeViewerPanel.tsx` — Monaco-based code viewer
- `panels/PreviewPanel.tsx` — live preview iframe
- `panels/DiffPanel.tsx` — diff view for regenerations
- `panels/CommentsPanel.tsx` — inline comments for revision feedback
- `dialogs/RegenerateComponentDialog.tsx`
- `dialogs/RegenerateProjectDialog.tsx`
- `dialogs/ExportProjectDialog.tsx`
- `dialogs/AccessibilityIssuesDialog.tsx`
- `views/ComponentApprovalView.tsx`
- `views/ProjectStatusView.tsx`

The layout: file tree (left), code viewer (center), live preview (right). The user navigates files, reviews, comments, approves.

### 6.8 Audit Events

```
ai.ui_generation.project_generation_started
ai.ui_generation.ia_generated
ai.ui_generation.page_generated
ai.ui_generation.component_generated
ai.ui_generation.component_regenerated
ai.ui_generation.accessibility_failure
ai.ui_generation.typecheck_failure
ai.ui_generation.preview_rendered
ai.ui_generation.component_approved
ai.ui_generation.component_rejected
ai.ui_generation.project_approved
ai.ui_generation.exported
```

### 6.9 Permissions

```
ai.ui_generation.create
ai.ui_generation.read
ai.ui_generation.regenerate
ai.ui_generation.approve
ai.ui_generation.export
```

Default role mappings:

- `workspace_owner`, `workspace_admin`: all
- `designer`: all
- `developer`: all
- `business_analyst`: read, regenerate, approve
- `reviewer`, `viewer`: read
- `qa`: read (full Stage 8 tooling)
- Custom roles configurable

### 6.10 Quality Signal Specifics

```typescript
interface UiGenerationQualitySignals {
  projectArtifactId: string;

  // Component generation
  totalComponents: number;
  componentsAcceptedFirstPass: number;
  componentsRegenerated: number;

  // Quality
  initialAccessibilityPassRate: number;
  finalAccessibilityPassRate: number;
  initialTypeCheckPassRate: number;
  finalTypeCheckPassRate: number;

  // Editing
  componentsEditedAfterApproval: number;
  totalEditChars: number;

  // Time
  totalGenerationTimeMinutes: number;
  totalApprovalTimeHours: number;

  // Downstream
  causedDownstreamCodeGenIssue: boolean;
  causedDownstreamTestGenIssue: boolean;
}
```

### 6.11 Operational Runbooks

- `ui-generation-component-quality.md` — diagnosing low-quality component generation
- `ui-generation-accessibility-storm.md` — when many components fail axe-core
- `ui-generation-typecheck-failures.md` — handling persistent TypeScript errors
- `ui-generation-preview-not-rendering.md` — debugging preview iframe failures
- `ui-generation-large-project.md` — tuning for projects with many entities/pages

---

## 7. Implementation Order

1. **Project artifact schema** locked in TypeScript types and zod.

2. **Information architecture artifact schema.**

3. **Component spec schema.**

4. **IA extraction prompt** with test suite.

5. **Per-component generation prompts** (list, detail, create form, edit form) with test suites.

6. **App shell prompt.**

7. **Routing config prompt.**

8. **Build config prompt** (vite, tsconfig, tailwind).

9. **Storybook story prompt.**

10. **UiGenerationService skeleton.**

11. **Project tree assembly** — coordinator that runs prompts in dependency order.

12. **Accessibility validator** integrated with axe-core.

13. **TypeScript checker** integrated.

14. **Component renderer** for live preview.

15. **Mock data factory** — schema-aware faker-style.

16. **Auth pages prompt.**

17. **Workflow component prompt** for multi-step flows.

18. **Dashboard component prompt.**

19. **Permission-aware code generation** — components check permissions correctly.

20. **Real-time integration** in list/detail components.

21. **File/image/video column rendering.**

22. **FK column rendering with combobox.**

23. **Code review UI** with all panels.

24. **Project export** as downloadable archive.

25. **Stage pipeline integration** (component-level approval, project approval).

26. **Quality signal recording.**

27. **Audit events emitted.**

28. **End-to-end test**: PRD + tokens + schema → UI project → preview works → approval → export.

29. **Documentation, ADRs, runbooks.**

30. **Verify Definition of Done.**

---

## 8. ADRs to Write

- **ADR-0191: React + Vite + Tailwind as the Generated Stack** — alternatives considered; consistency with platform UI
- **ADR-0192: Per-Component Generation, Not Whole-App** — testability, regenerability, review-friendly
- **ADR-0193: Information Architecture as Separate Artifact** — review and edit before component generation
- **ADR-0194: Accessibility Validated During Generation** — non-negotiable; axe-core in the loop
- **ADR-0195: Live Preview via Sandboxed Iframe** — review by seeing, not just reading code
- **ADR-0196: Generated Code is Editable Post-Approval** — humans own the code after AI generates it
- **ADR-0197: Storybook Stories Co-Generated** — documentation as a first-class output

---

## 9. Verification Steps

1. **Generate IA from a CRM PRD**: produces pages for contacts, deals, activities, dashboard.

2. **Generate full UI project** from the IA + tokens + schema; project tree complete.

3. **Generated code compiles** without TypeScript errors.

4. **Live preview renders** for a list component with mock data.

5. **List component**: filtering, sorting, pagination work using SDK.

6. **Detail component**: shows record fields; FK columns resolve to display values; edit/delete buttons present.

7. **Create form**: schema-driven; validation matches schema constraints; submit calls SDK insert.

8. **Edit form**: pre-populated; optimistic concurrency; submit calls SDK update.

9. **FK combobox**: search-as-you-type; selecting a value populates the form.

10. **File upload**: file column shows upload UI; uploads via tus.io; preview renders.

11. **Image column**: thumbnail in list view; full preview in detail; upload/replace in edit form.

12. **Real-time list**: opens a component in two tabs; insert in tab 1 reflects in tab 2 within 2 seconds.

13. **Auth pages**: sign-in, sign-up, forgot-password generated; use SDK auth client.

14. **Permission-aware UI**: a viewer-role user sees no edit buttons; an admin sees them.

15. **Accessibility**: axe-core passes on all generated components; failures retry once successfully.

16. **Storybook stories**: each component has a corresponding `.stories.tsx`; stories render without errors.

17. **Code review UI**: file tree navigates; code viewer shows source; preview iframe renders.

18. **Diff view**: regenerated component shows old vs. new; user can approve diff.

19. **Per-component regeneration**: regenerate one component with feedback; only that component changes.

20. **Project regeneration**: regenerate the project with feedback; affected components regenerate.

21. **Export project**: produces a zip archive with all source files; project is buildable with `npm install && npm run dev`.

22. **Approval flow**: per workspace config; section-level approval for components.

23. **Cross-database**: same UI generation works for Postgres/MSSQL/Mongo workspaces (modulo schema-driven differences).

24. **Workflow component**: a user story like "import contacts from CSV" generates a multi-step wizard.

25. **Dashboard generation**: a dashboard page produces a layout with stats cards and recent-activity lists.

26. **Audit events**: all lifecycle actions emit expected entries.

27. **Cost tracking**: per-component and total project cost recorded.

28. **Quality signals**: component acceptance rate, accessibility pass rate, TypeScript pass rate recorded.

If all 28 pass, the objective is met.

---

## 10. Definition of Done

**Schema & Types**

- [ ] UiProject artifact type
- [ ] InformationArchitecture artifact type
- [ ] UiComponent artifact type
- [ ] All sub-structures
- [ ] Locked at downstream stages (Stage 7, 8, 9)

**Prompts**

- [ ] All component generation prompts
- [ ] IA extraction
- [ ] Build config
- [ ] Storybook stories
- [ ] Accessibility-fix
- [ ] Regeneration
- [ ] Consistency check
- [ ] Orchestrator
- [ ] Test suites per prompt

**Service Layer**

- [ ] UiGenerationService implemented
- [ ] All generation, regeneration, approval methods
- [ ] Accessibility validation integrated
- [ ] TypeScript validation integrated
- [ ] Stage pipeline integration

**Validators**

- [ ] AccessibilityValidator using axe-core
- [ ] TypeChecker using TypeScript compiler

**Preview**

- [ ] Component renderer in sandboxed iframe
- [ ] Mock data factory (schema-aware)

**UI**

- [ ] Code review page with all panels
- [ ] File tree, code viewer, preview, diff, comments
- [ ] All dialogs

**Generated Code Quality**

- [ ] React + Vite + Tailwind + TypeScript stack
- [ ] Uses SDK for data, auth, realtime, storage
- [ ] Permission-aware components
- [ ] Real-time integration where appropriate
- [ ] FK combobox, file/image cells
- [ ] Storybook stories co-generated
- [ ] WCAG 2.2 AA verified

**Quality & Observability**

- [ ] Quality signals recorded
- [ ] Per-prompt dashboards
- [ ] Stage-specific metrics

**Permissions**

- [ ] Stage permissions added
- [ ] Default role grants

**Cross-Database**

- [ ] UI generation works for all three database drivers
- [ ] Capability-aware components (no array column UI on MSSQL, etc.)

**Documentation**

- [ ] ADRs 0191–0197 written and Accepted
- [ ] All runbooks in Section 6.11 written
- [ ] Customer-facing UI generation guide
- [ ] Generated code style guide

**Verification**

- [ ] All 28 verification steps in Section 9 pass

---

## 11. Anti-Patterns to Refuse

- **Whole-app single-prompt generation.** Per-component is the discipline.
- **Skipping accessibility checks.** Non-negotiable; axe-core in the loop.
- **Skipping TypeScript checks.** Generated code must compile.
- **Generating code that doesn't use the SDK.** Custom fetch/axios calls bypass auth, error handling, retries; use the SDK.
- **Permission-blind components.** Always check permissions before rendering edit/delete.
- **Cross-component coupling beyond what's necessary.** Components share types, not implementation.
- **Hardcoded sample data in components.** Mock data via the data factory; real data via SDK.
- **Accessibility violations marked "won't fix" by AI.** Retry once, then escalate to user; don't silently ship inaccessible code.
- **Generated code that doesn't follow Prettier/ESLint.** Format and lint as part of generation.
- **Ignoring the design tokens.** Tailwind config wires tokens; components use Tailwind classes; visual consistency mechanical.
- **Mock data that looks like real customer data.** Faker-style placeholder names; customers shouldn't confuse mocks for real data.
- **Storybook stories that don't render.** Stories are validated as part of generation.

---

## 12. Open Questions for Confirmation Before Starting

1. **React-only stack** — confirmed? Some teams prefer Vue or Svelte. Recommendation: ship with React; add Vue support as a follow-up if customer demand justifies (would require alternate prompt set).

2. **shadcn/ui as base components** — confirmed? Some teams prefer Material-UI or Chakra. Recommendation: shadcn/ui because it's copy-paste customization model fits AI generation; alternates as future option.

3. **Storybook generation in v1** — proposing yes; documentation value is high. Acceptable given the cost/complexity?

4. **Live preview iframe** — proposing browser-based via Playwright server-side or local dev server. Recommendation: server-side rendering via a small "preview service" running the components in isolation.

5. **Mobile responsiveness** — components are responsive by default (Tailwind breakpoints). Worth a separate "mobile preview" mode? Recommendation: yes, as a quick toggle in the preview panel.

6. **Generated code customization post-approval** — proposing the platform tracks "AI-generated regions" so regenerations don't trample human edits. Acceptable, or should regeneration always overwrite?

7. **Cost target ($5–$30 per project)** — varies wildly with project size. Per-component costs more reliable. Recommendation: track both; surface to user.

---

## 13. Designer is the Same Canvas (post-v1 clarification)

Stage 6 generates the **first version** of every page. From that point on, all editing happens in the **Page Designer** surface — which is the _same canvas_ as Stage 6's component browser, just opened from a different entry point.

This means:

1. The Designer loads existing project pages (not blank canvases). The page list in Designer mirrors the actual deployed pages.
2. Stage 6's "Edit in Designer →" button opens the Designer with the just-generated page selected — no hand-off, no export, just a different URL into the same surface.
3. Inside the Designer, a persistent **✦ Ask AI** affordance lets the user invoke AI on any page or block at any time. Stage 6 is the _first_ AI generation; subsequent regenerations and adjustments happen through Ask AI in the Designer.
4. **App Chrome** (header / footer / side nav / breadcrumb — see Objective 26.5) renders inside the Designer canvas as locked regions with a "Configured in App Chrome ↗" indicator. The Designer does not edit chrome — that's a separate surface.
5. The Designer's Save action is "Save & Deploy" — saving triggers the same build/test/deploy cycle as any other change.

This continuation is what makes the AI Pipeline a true _lifecycle pipeline_ (not a one-shot generator). The user creates with the pipeline, maintains with the Designer + SQL Editor, and the pipeline keeps running in the background through Stage 10 (Maintenance) signals — proposing changes when production data shows they're warranted.

---

## 14. What Comes Next

With Objective 26 complete, the customer has a working frontend application. They can run it locally; they can deploy it (Stage 9). It connects to the platform's APIs via the SDK; it shows real data from the schema; it respects permissions; it's accessible.

But it doesn't have custom server-side logic yet — workflows that require server computation (a CRM that calculates deal scores; a blog that publishes on a schedule; a dashboard that aggregates data nightly).

**Objective 27: Stage 7 — Code Generation** generates the server-side logic. Edge functions, scheduled jobs, integrations with third-party APIs, custom validation, custom transformations. The UI calls these endpoints; the generated code runs the business logic.

The remaining stages chain forward:

- **28: Test Generation** — from PRD acceptance criteria + UI components + server-side code
- **29: Deployment** — through the environments from Objective 2
- **30: Maintenance & Evolution** — feedback loops, regeneration, change management

After all stages ship, the platform delivers the master plan's full vision: a structured AI-assisted development pipeline that produces a complete, deployable, maintainable application.

---

_This document is the contract. Every checkbox in Section 10 must be true before moving on to Objective 27._
