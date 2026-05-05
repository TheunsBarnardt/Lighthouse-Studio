# ADR-0130: Per-Workspace Branding Scope

**Status:** Accepted
**Date:** 2026-05-05
**Deciders:** solo

## Context

The platform needs to support white-labelling: workspace administrators want to customise the visual appearance of the auth screens and email notifications for their workspace — replacing platform defaults with their own company name, colours, logo, and email sender name.

Decisions required:

1. At what scope is branding configured — installation-wide or per-workspace?
2. What properties can be customised?
3. How is custom CSS handled safely (no XSS or CSS injection)?
4. Where is the logo asset stored?

## Decision

**Branding is scoped per workspace.** Each workspace has an optional `workspace_branding` row. When branding is absent the platform falls back to installation defaults (configurable via environment variables, not through the UI).

**Configurable properties:**

| Property        | Type           | Purpose                                                |
| --------------- | -------------- | ------------------------------------------------------ |
| `companyName`   | `VARCHAR(255)` | Replaces "Lighthouse Studio" in UI headings and emails |
| `primaryColor`  | `VARCHAR(7)`   | Hex colour injected as `--color-primary` CSS variable  |
| `logoFileId`    | `UUID FK`      | Reference to a file in the workspace's storage bucket  |
| `emailFromName` | `VARCHAR(255)` | "From" name in outbound emails for this workspace      |
| `customCss`     | `TEXT`         | Free-form CSS variable overrides (allowlisted)         |

**Custom CSS is sanitised** before persistence and before injection into pages. The sanitiser:

- Splits the input on newlines.
- Keeps only lines that match `^\s*--[\w-]+\s*:\s*.+;?\s*$` (CSS variable declarations).
- Restricts the allowlisted variable names to: `--color-primary`, `--color-primary-foreground`, `--color-accent`, `--radius`, and their `-foreground` / `-muted` / `-border` variants.
- Strips everything else silently (no error; non-conforming lines are discarded).

The logo file is stored in the workspace's storage bucket (via the Storage service). The `logoFileId` is a reference; the UI fetches a signed URL for display. The branding API never serves the file directly.

## Consequences

### Positive

- Workspace-scoped branding allows a single installation to serve multiple brands (multi-tenant white-label deployments).
- CSS variable allowlisting prevents injection of arbitrary CSS (no `position: fixed` overlays, no `content:` tricks, no external `url()` fetches).
- Storing the logo as a first-class storage object reuses existing upload/ACL/quota infrastructure.

### Negative

- Operators who want a single brand across the entire installation must configure each workspace individually (or accept the installation defaults). An installation-wide default branding override UI is deferred.
- The CSS variable allowlist is conservative. Workspaces with more complex theming needs (e.g., custom fonts) cannot express them through this mechanism. They would need operator-level access to override the installation defaults at the theme-file level.
- Logo files are subject to workspace storage quotas, which may surprise workspace admins who didn't expect a small logo to consume quota.

### Neutral

- The `workspace_branding` table uses the standard `version` + `archived_at` pattern for soft-delete and optimistic locking.
- Branding changes take effect on the next page load; no cache invalidation is required because Next.js fetches branding per request in the workspace layout.

## Alternatives Considered

### Installation-Wide Branding Only

A single branding configuration shared across all workspaces.

**Why not chosen:** The platform's multi-tenant architecture is designed to support separate brands per workspace. Restricting to installation-wide branding would eliminate the white-label use case, which is a key differentiator for enterprise deployments.

### Unrestricted Custom CSS

Allow workspace admins to inject arbitrary CSS.

**Why not chosen:** Unrestricted CSS can be used to overlay UI elements, exfiltrate data via CSS-based font-fingerprinting, or cause layout damage that breaks the platform UI. CSS variable allowlisting achieves the legitimate use case (theme colours, border radius) without the risk surface.

## References

- ADR-0126 (per-workspace storage credentials — logo files use the same storage scope)
- Objective 16 (Auth & User Management UI)
- `packages/core/src/services/branding.service.ts`
- `packages/adapters/persistence-postgres/migrations/0010_auth_ui.sql`
