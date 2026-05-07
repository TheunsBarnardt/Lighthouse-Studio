# ADR-0262: TanStack Table for the Data Browser Grid

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 18 (Data Browser & Editor)

---

## Context

The data browser grid must render workspace customer data that can have any schema: arbitrary column types, nullable fields, FK references, PII-redacted values, and row counts that could reach millions. The grid must support:

- Inline cell editing with type-specific renderers
- Multi-column sort with visible indicators
- Row selection (single, shift-range, ctrl-toggle)
- Virtualised rendering so a 1 M-row table does not freeze the browser
- Real-time highlight of rows changed by other users

We evaluated three table libraries:

| Library | Strengths | Weaknesses |
| --- | --- | --- |
| **TanStack Table v8** | Headless; composable; first-class virtualisation via `@tanstack/react-virtual`; no DOM opinion; TypeScript-native | Requires more wiring than opinionated grids |
| **AG Grid Community** | Feature-rich out of the box; built-in virtualisation | ~1 MB bundle; commercial licence required for some features; imposes CSS opinions that fight our design system |
| **Glide Data Grid** | Canvas-based; very fast at huge row counts | Canvas output is not accessible to assistive technology; custom cell renderers must be canvas-aware |

---

## Decision

Use **TanStack Table v8** (`@tanstack/react-table`) for row model and column management, paired with **TanStack Virtual** (`@tanstack/react-virtual`) for row-level virtualisation.

Cell rendering is delegated to our own typed cell components (`StringCell`, `BooleanCell`, `NumberCell`, `DateCell`, `FkCell`, `ArrayCell`, `JsonCell`, `FileCell`) that TanStack Table invokes via `flexRender`. This keeps the grid headless and lets cell components follow the platform's design system without fighting a 3rd-party grid's style layer.

---

## Consequences

**Positive:**
- Grid bundle contribution is ~30 KB (table) + ~10 KB (virtual) gzipped — well within the 350 KB route budget.
- Each cell component is independently testable and accessibly structured (renders real DOM, not canvas).
- Sorting, selection, and column definitions are plain TypeScript — no proprietary API surface.
- Virtualiser row height is configurable (`ROW_HEIGHT = 36` default) and can be measured dynamically for variable-height rows.

**Negative:**
- More wiring than AG Grid; column pinning, column resizing, and grouping require manual implementation when needed.
- No built-in Excel-style copy/paste — must be added as a keyboard handler if required.

**Neutral:**
- AG Grid and Glide Data Grid remain viable options for a future "power user" grid surface if the headless approach proves insufficient at very high column counts.
