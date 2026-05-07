# Auto-Generated Documentation Guide

Objective 31 delivers a documentation site that keeps itself current as the application evolves.
Every schema migration, API rebuild, and UI regeneration triggers automatic updates to the relevant
documentation pages — no manual re-writing required.

---

## Two surfaces

| Surface | Where | Freshness | Purpose |
|---|---|---|---|
| **In-platform docs** | `/project-docs` | Live (< 10s lag) | Team reference during development |
| **Standalone export** | Deployed ZIP | Point-in-time snapshot | Distribution to external consumers |

These operate independently. The in-platform docs continue evolving after an export is made.

---

## How pages stay current

Each documentation page records the source artifact it was generated from (schema entity,
API spec, component source, etc.). When that source changes, a sync trigger fires and the
platform regenerates the affected sections using the page-regeneration prompt.

Human-maintained sections are preserved unless they directly contradict the new source content.
When a conflict is detected, the section is updated and a review callout is added for the author
to inspect.

### Sync latency

Typical sync latency is under 10 seconds for schema and component changes. API spec changes
may take up to 30 seconds if the spec is large.

---

## Source attribution

The auto-generation bar at the top of every page shows the percentage of content that is
auto-generated. Each section shows a ⚡ icon if it is auto-generated. Human-maintained sections
show an Edit button on hover.

| Section type | Source | Auto-updates? |
|---|---|---|
| Domain model | Schema (Stage 4) | Yes — on migration |
| REST API reference | Generated endpoints (Stage 7) | Yes — on API rebuild |
| GraphQL reference | Generated SDL (Stage 7) | Yes — on API rebuild |
| Components | Generated UI (Stage 6) | Yes — on UI rebuild |
| Changelog | Deployment events (Stage 9) | Yes — on deploy |
| Features | PRD (Stage 2) | Yes — on PRD edit |
| Quickstart, Architecture | Human-maintained MDX | No — manual edit only |

---

## Exporting a standalone site

1. Open **Project Docs** → click **Export Site**
2. Set the version tag (should match the current deployment version)
3. Choose whether to include telemetry (recommended — see below)
4. Click **Export** — generation takes 10–60 seconds depending on page count
5. Download the ZIP and deploy to any static host (Vercel, Netlify, Coolify, Nginx)

### Export structure

```
project-docs-export-v0.1.3/
├── package.json              # Next.js + fumadocs
├── next.config.js
├── content/                  # MDX pages snapshot
│   ├── domain/
│   ├── api/
│   └── components/
├── lib/
│   └── telemetry.ts          # phones home to platform (optional)
└── public/                   # brand assets
```

### Search in exports

Exports include a static search index built at export time. The index covers all page titles
and section headings. Full-text content search is not included in the static index — use the
in-platform docs for full-text search.

---

## Telemetry

When telemetry is enabled, the exported site fires anonymised events back to the platform:

- `page_view` — which pages are read, and for how long
- `search` — what users search for
- `link_click` — which external links are followed

No personally identifiable information is collected. Events appear in the **Logs** surface
tagged with the export version. Telemetry tokens expire after 90 days; re-exporting
generates a new token.

To disable telemetry after export, edit `lib/telemetry.ts` and replace the implementation
with a no-op:
```typescript
export const trackEvent = () => {};
```

---

## Architecture

```
Source change (schema / API / component / deploy)
     │
     ▼ SyncTrigger event
DocsService.syncFromSource()
     │
     ▼ async: find affected pages
pageRegenerationPrompt (claude-opus-4-7)
     │
     ▼ updated sections (human edits preserved)
DocPage updated in storage
     │
     ▼ in-platform viewer reflects changes immediately
```

---

## Runbooks

- [Documentation page stale after schema change](../runbooks/docs-stale-page-after-schema-change.md)
- [Export too large](../runbooks/docs-export-too-large.md)
- [Telemetry events not arriving from exported site](../runbooks/docs-telemetry-events-not-arriving.md)
