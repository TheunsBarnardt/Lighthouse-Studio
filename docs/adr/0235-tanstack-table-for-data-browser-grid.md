# ADR-0235: TanStack Table for the Data Browser Grid

**Status:** Accepted
**Date:** 2026-05-06
**Objective:** 18 (Data Browser & Editor)

---

## Context

The data browser needs a performant, keyboard-navigable, accessible grid that can handle tens of thousands of rows, complex column types, inline editing, multi-column sort, and row selection patterns (click, shift-click, ctrl-click). The component must be headless (so we can apply our own design tokens) and must integrate with TanStack Virtual for row virtualization.

---

## Decision

Use **TanStack Table v8** (formerly react-table) as the headless grid engine, paired with **TanStack Virtual** for row virtualization.

TanStack Virtual was already a dependency (from prior work). Adding TanStack Table completes the pairing.

---

## Consequences

**What becomes easier:**

- Virtualized rendering of millions of rows without DOM explosion.
- Multi-column sorting with `manualSorting: true` — sorting is server-side via the REST API.
- Headless model: we render our own `<table>` with Tailwind; no style conflicts.
- `getRowId` ensures stable row identity across page refreshes and realtime updates.
- Column resize is available as an opt-in future enhancement.

**What becomes harder:**

- No built-in pagination UI (intentional — we use our own StatusBar).
- No built-in server-side data fetching — we manage fetch lifecycle ourselves.

---

## Alternatives Considered

- **AG-Grid Community**: feature-rich but opinionated styling; dual-license means enterprise features require a commercial license. Rejected: license complexity and styling friction.
- **Glide Data Grid**: canvas-based; extremely fast but accessibility is limited (no native ARIA roles). Rejected: WCAG 2.2 AA is a requirement.
- **Material Table / MUI DataGrid**: tied to MUI design system. Rejected: we use Tailwind/shadcn; importing MUI adds bundle weight and conflicting styles.
