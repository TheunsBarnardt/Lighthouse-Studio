# Objective 31 — Auto-Generated Documentation Site

**Phase:** 1 (AI Pipeline Module) · **Module:** Documentation
**Depends on:** Obj 22 (PRD Generation), Obj 24 (Schema Synthesis), Obj 26 (UI Generation), Obj 27 (Code Generation), Obj 29 (Deployment), Obj 30 (Maintenance)
**Feeds into:** Obj 30 (Maintenance signals for docs telemetry)

---

## Why this exists

Generated apps need documentation. The original objectives produced PRDs, schemas, and code, but never assembled them into a navigable, searchable, deployable docs site that:

- Keeps itself current as the schema, API, and components change
- Can be exported for distribution to teams who don't have platform access
- Phones home to the platform so doc-site usage feeds back into product signals

This is the difference between _having artifacts_ and _having documentation_.

The reference design is fumadocs.dev — Next.js + MDX, with a clean tree-of-content sidebar, search, and component-level reference pages. We adopt that visual model.

---

## What this provides

### Two distinct surfaces

**Surface A: Project Documentation (in-platform, live).**
Lives at `/project-docs` in the platform. Shows the current state of the project's docs as a navigable surface. Updates within seconds of underlying changes (new schema column → new entry in the Schema section; new generated component → new entry in Components section). Editable inline for human-maintained sections.

**Surface B: Standalone export (point-in-time, deployable).**
Generates a self-contained Next.js + fumadocs site that can be deployed anywhere (Coolify, Vercel, Netlify, static host). Each export is a snapshot tagged with a version (matching the project's deploy version). The exported site embeds telemetry beacons that ship usage data back to the platform's observability surfaces.

These are SEPARATE: in-platform docs are always live, standalone export is a frozen snapshot. A user might export weekly to ship to enterprise customers while the in-platform copy keeps updating.

### Auto-generation sources

Every section of the docs is tagged with its source:

| Section                              | Source                             | Update trigger      |
| ------------------------------------ | ---------------------------------- | ------------------- |
| Domain model                         | Schema (Stage 4)                   | Schema migration    |
| API reference (REST)                 | Generated REST endpoints (Stage 7) | API rebuild         |
| API reference (GraphQL)              | Generated GraphQL schema (Stage 7) | API rebuild         |
| Components reference                 | Generated UI components (Stage 6)  | UI rebuild          |
| Webhooks                             | Webhook config                     | Webhook config save |
| Authentication                       | Auth config                        | Auth config save    |
| Changelog                            | Deployment events (Stage 9)        | Deploy event        |
| Features                             | PRD (Stage 2)                      | PRD edit            |
| Quickstart, Architecture, Operations | Human-maintained MDX               | Manual edit         |

The auto-bar at the top of every page shows what percentage of THAT page is auto-generated and which sections are human-maintained.

### Standalone export structure

```
project-docs-export-v0.1.3/
├── package.json              # Next.js + fumadocs
├── next.config.js
├── content/
│   ├── overview/
│   │   └── introduction.mdx  # snapshot of in-platform content
│   ├── domain/                # snapshot of generated entity docs
│   │   ├── contacts.mdx
│   │   ├── deals.mdx
│   │   └── call-notes.mdx
│   ├── api/                   # snapshot of generated API docs
│   │   ├── rest.mdx
│   │   └── graphql.mdx
│   └── components/            # snapshot of generated component docs
│       ├── deal-kanban.mdx
│       └── contacts-table.mdx
├── lib/
│   └── telemetry.ts          # phones home to platform
├── public/                    # snapshot of workspace assets used in docs
└── README.md
```

The `lib/telemetry.ts` file ships anonymized event data back to the platform:

```typescript
// Sample telemetry event
{
  exportVersion: 'v0.1.3',
  projectId: 'p_abc123',
  workspaceId: 'w_xyz789',
  event: 'page_view',
  page: '/api/rest',
  timestamp: '2026-05-02T14:23:11Z',
  // No PII, no identifiable visitor data
}
```

These events arrive at the platform's logs surface and feed into:

- **Logs** — raw events for audit/debug
- **Advisors** — "Your `Webhooks` page hasn't been viewed in 90 days; consider deprecating that surface"
- **Metrics** — page views, time-on-page, top docs pages

The user can disable telemetry per export. If disabled, the exported site works fully but the platform sees no return signal.

### Visual model

The docs site (both in-platform and exported) follows fumadocs' three-pane layout:

- Left: tree-of-content sidebar with auto-badges next to auto-generated entries
- Center: MDX content rendered with syntax-highlighted code, callouts, tables
- Right: meta panel with page stats, last updated timestamp, "linked surfaces" section

This is consistent with the platform's three-pane convention used by Designer, App Chrome, and the data-plane editors.

### Search

Both the in-platform and standalone docs include full-text search. In-platform uses the platform's search backend; standalone bundles a static search index built at export time.

---

## Acceptance criteria

1. Project Documentation surface exists in the platform at `/project-docs`, three-pane layout matching the platform UI design guide.
2. Documentation updates automatically when the schema, API, components, or deployment events change. Latency is under 10 seconds for typical changes.
3. Each docs page is tagged with its source (auto vs human-maintained) and shows last-updated timestamp.
4. Standalone export produces a deployable Next.js + fumadocs project; the exported zip is under 50 MB for typical projects.
5. Exported sites ship telemetry beacons to the platform; events arrive in the Logs surface with the export's version tag.
6. Telemetry can be disabled per export via a config flag; disabling does not break docs functionality.
7. Search works in both in-platform (server-backed) and standalone (static index) modes.
8. Workspace brand assets (logo, colors, fonts) are applied to the docs site automatically — no manual theming required.
9. **D6 — End-user-facing documentation for the generated app's users** (per [docs/roadmap/v2-future-scope.md](../docs/roadmap/v2-future-scope.md)). The two-surface model produces docs aimed at _the dev's customers_, not just the dev team — generated from app intent, schema, and UI surfaces with end-user voice (task-oriented "how do I…" rather than implementation-oriented). Internal-developer docs and end-user docs are distinguishable surfaces (separate navigation roots or section labels) so the dev can publish the end-user surface without leaking implementation detail.

---

## Out of scope

- Multi-language docs translations.
- Versioned docs (showing v1.x and v2.x side by side) — exports are per-version snapshots; live docs always show current version.
- Custom domain mapping for in-platform docs — the in-platform copy lives at the platform's URL.
- WYSIWYG MDX editing — human-maintained sections are edited via plain MDX in the platform's text editor.

---

## ADR refs

ADR-0232: Two-surface model (live + export)
ADR-0233: fumadocs as the visual reference model
ADR-0234: Telemetry phone-home protocol from exported sites
ADR-0235: MDX as the source format for human-maintained sections
