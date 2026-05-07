# ADR-0231: Page-Level Chrome Override Semantics

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 26.5 — App Chrome

## Context

Most pages use the app-wide chrome. Some pages (auth pages, embedded widgets, full-screen editors) need different chrome or no chrome. The override system must be expressive but not so complex that it creates unpredictable rendering.

## Decision

Page-level overrides support two levels of granularity:

1. **Layout override** — changes the entire layout variant: `sidenav-with-topbar`, `topnov-only`, or `full-page` (no chrome). A `full-page` override suppresses all regions regardless of region-level overrides.

2. **Per-region override** — sets a specific region to `'none'` (hidden) or to a specific block ID. Region overrides only take effect when layout override is not `full-page`.

Overrides are declared in page metadata and are applied at build time. The `AppChromeConfig.pageOverrides` array stores them; the generated root layout component evaluates them per route.

Auth pages (sign-in, sign-up, forgot-password, reset-password) receive a default proposal: `layout: 'topnov-only', sidenav: 'none', breadcrumb: 'none'`. Users can change these defaults.

## Consequences

- Auth and embed pages are handled declaratively without custom layout components
- The AI proposal step automatically suggests appropriate overrides for known page types
- Overrides are visible in the App Chrome surface's "Page Overrides" tab
- Complex per-section chrome (different chrome for /admin vs /app) is out of scope — use separate projects or environments

## Alternatives considered

- **Route-segment chrome config (Next.js style)** — too tightly coupled to the router; the platform supports multiple router configurations
- **Inline chrome control per page component** — breaks the separation; AI would need to regenerate chrome logic on every page change
