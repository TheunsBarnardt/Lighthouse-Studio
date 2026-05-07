# ADR-0230: Chrome Blocks as Blocks Library Category

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 26.5 — App Chrome

## Context

The platform has a Blocks Library for reusable UI components. Chrome regions (header, sidenav, etc.) are a category of UI component. The question is whether chrome should use the existing Blocks Library infrastructure or be a separate, bespoke registry.

## Decision

Chrome blocks are a category of the Blocks Library, distinguished by:
- `category: 'Chrome'` field on the block definition
- A required `chrome` field declaring the region: `'header' | 'sidenav' | 'breadcrumb' | 'footer'`
- Versioning, sharing, and registry workflows identical to any other block

The platform ships 9 starter chrome blocks (3 headers, 2 sidenavs, 2 breadcrumbs, 2 footers). Workspace admins can add custom chrome blocks following the same authoring process as any other block.

## Consequences

- Customers who have already built custom blocks can apply the same workflow to chrome blocks
- Chrome blocks appear in the Blocks Library browsing UI under a "Chrome" filter
- Block versioning and workspace sharing apply to chrome blocks automatically
- No separate chrome-block registry to maintain

## Alternatives considered

- **Bespoke chrome registry** — simpler for v1 but splits the block ecosystem; customers would need to learn two systems
- **Hardcoded chrome choices** — fast but inflexible; customers cannot add custom chrome
