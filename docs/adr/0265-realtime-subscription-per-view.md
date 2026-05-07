# ADR-0265: Real-Time Subscription Per View for the Data Browser

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 18 (Data Browser & Editor)

---

## Context

The data browser shows live workspace data. Multiple users may edit the same table simultaneously. We need to decide how the data browser receives real-time updates when another user changes a row.

Three approaches:

1. **No real-time** — user manually refreshes to see others' changes. Simple, but creates a confusing UX where users overwrite each other unknowingly.

2. **Global subscription** — one connection subscribes to all row-change events across all tables in the workspace. Simple to manage but pushes every workspace event to every connected user regardless of which table they are viewing.

3. **Per-view subscription** — a subscription is opened for the active table + filter combination and closed when the user navigates away or changes the filter. Only events relevant to the current view are delivered.

---

## Decision

Use a **per-view subscription**: one WebSocket/SSE subscription per active data browser view, scoped to the currently selected table and applied filter.

- The subscription is opened when the user selects a table and `realtimeEnabled` is true.
- The subscription is torn down and re-opened when the user changes the table, changes the filter, or toggles real-time off.
- The subscription is closed on component unmount.
- While the user has a cell in local editing state (`isEditingLocally`), incoming real-time events for that row set the `hasPendingRealtime` flag on the row context rather than overwriting the draft. The pending update is applied after the user commits or cancels the edit.

### Why not global subscription?

A global subscription delivers every row-change event in the workspace to every connected browser, regardless of which table the user is viewing. For workspaces with high write throughput this is wasteful: the browser discards most events. Server-side filter pushdown (scoping events to the active table + filter) keeps event volume bounded.

### Why not polling?

Polling introduces latency proportional to the poll interval and adds steady server load even when nothing changes. WebSocket/SSE delivers changes within milliseconds and is idle when the table is quiet.

---

## Consequences

**Positive:**
- Only events for the active view are delivered; event volume is bounded by the current filter's row set.
- Users see row highlights appear immediately when a colleague edits a row they are both viewing.
- Subscription lifecycle is tied to React component lifecycle — no external cleanup bookkeeping.

**Negative:**
- Filter changes cause subscription churn (teardown + re-open). For users who rapidly adjust filters this creates a brief window without real-time updates.
- The `hasPendingRealtime` flag requires the editing-pause logic in every cell's commit flow.

**Neutral:**
- The `realtimeEnabled` toggle lets users opt out of real-time if they prefer a stable view while doing bulk review.
- Server-side filter pushdown is required to scope events correctly; the server must support predicate-aware subscription registration.

