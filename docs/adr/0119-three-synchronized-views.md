# ADR-0119: Three Synchronized Views over One Schema Model

**Status:** Accepted  
**Date:** 2026-05-03

## Context

The schema designer needs to support multiple editing modalities for different user preferences and workflows:

- **Visual users** want a diagram/ERD view showing tables as nodes and foreign keys as edges.
- **Power users** want a spreadsheet-like table editor for bulk column editing.
- **Developer users** want a JSON code editor (Monaco) for precise schema definition.

All three views must reflect the same schema state at all times. If the user edits a column name in the table view, it must immediately appear in the code view and diagram view without a manual sync step.

The challenge is: how to keep three different UI representations of the same model in sync without complex event-passing or bidirectional binding.

## Decision

All three views read from and write to **a single Zustand store** (`designer-store.ts`). The store holds one canonical `CustomerSchema` object. Views never communicate with each other directly.

Write path: every mutation in any view calls `updateSchema(draft => { ... })` (Immer-backed). This produces a new immutable schema reference, triggering React re-renders in all views that subscribe to the store.

Read path: each view subscribes to the relevant slice of the store. They re-render automatically when the schema changes.

```
DiagramView ──────┐
TableView   ──────┼── updateSchema() ──► Zustand store ──► subscribed views re-render
CodeView    ──────┘
```

The invariant: **no view has local state that diverges from the store**. The only exception is Monaco's debounced text buffer (600ms), which is an input buffer — not state — and syncs on valid JSON parse.

## Consequences

**Benefits:**

- No sync logic needed — React re-render handles it
- Trivially testable: mutate the store, assert all three views reflect changes
- Adding a fourth view requires only: read from store, write via `updateSchema()`
- Single source of truth for validation, deployment, and persistence

**Drawbacks:**

- All views must re-render on every schema change, even if they're not visible. Mitigated by the `hidden` class pattern (views are hidden, not unmounted) and React's reconciliation.
- Monaco's large serialized JSON can trigger expensive re-serializations on every keystroke if not debounced. Mitigated by the 600ms debounce on the code view's change handler.

## Alternatives Considered

**Event bus / pub-sub:** Each view publishes schema changes to a bus; other views subscribe. Rejected: two-way bindings create infinite loops and require careful de-duplication. Harder to test.

**URL state / query params:** Schema state encoded in the URL. Rejected: schema JSON is too large for URLs; causes navigation side effects.

**Server-authoritative sync (CRDT/OT):** Schema is always fetched from the server. Rejected: creates latency on every keystroke; overkill for a single-user editor.

## Note

Originally numbered ADR-0105; renumbered to avoid conflict with ADR-0105 (raw-graphql-js-for-dynamic-schema-generation, Objective 13).
