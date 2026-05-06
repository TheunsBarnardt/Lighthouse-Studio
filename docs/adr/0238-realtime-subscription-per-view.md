# ADR-0238: Real-Time Subscription Per View

**Status:** Accepted
**Date:** 2026-05-06
**Objective:** 18 (Data Browser & Editor)

---

## Context

The data browser needs live updates so users see other people's changes without refreshing. Objective 14's realtime layer provides a change-stream subscription API. The question is how to scope subscriptions to avoid drowning the browser in irrelevant events.

---

## Decision

**One subscription per visible table-view**, scoped by:

- `schemaId` + `tableId`
- The current filter (so events for rows the user can't see aren't delivered)
- `operations: ['insert', 'update', 'delete']`

Subscriptions are managed in a `useEffect` in the main page component. When the filter changes or the user navigates to a different table, the old subscription is closed and a new one is opened.

**Editing-pause logic:** If a realtime `update` event arrives for a row the user is currently editing, the update is queued (not applied) and a subtle indicator shows "Row updated by [user]". On commit or cancel of the user's edit, the queued update is applied.

**Realtime-off toggle:** Users can disable live updates per-browser-session. The toggle is in the Toolbar. Events outside the current filter increment a counter shown in the StatusBar ("3 updates outside view").

---

## Consequences

**What becomes easier:**

- Event volume is bounded by the current filter — high-write workspaces don't flood the browser.
- Subscription churn on filter change is acceptable (a new sub every few seconds at most).

**What becomes harder:**

- Filter changes cause a brief gap where events are missed (between unsubscribing and re-subscribing). This is acceptable; a manual refresh recovers the state.
- Per-user session preference (realtime on/off) is not persisted between sessions in v1.

---

## Alternatives Considered

- **Subscription per cell:** Extreme granularity, extreme event volume. Rejected.
- **Subscription per row (only rows on screen):** Would require one subscription per visible row (up to 500). Rejected: too many subscriptions.
- **Full-table subscription (no filter):** Simple but noisy. A table with 10,000 writes/min would overwhelm the browser. Rejected for high-write workspaces.
