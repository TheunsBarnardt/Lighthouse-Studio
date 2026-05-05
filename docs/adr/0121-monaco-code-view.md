# ADR-0121: Monaco Editor for Schema Code View

**Status:** Accepted  
**Date:** 2026-05-03

## Context

The schema designer's Code view needs a text editor that can show and edit the schema as JSON. The requirements are:

- Syntax highlighting for JSON
- Inline error markers (squiggles) for invalid JSON
- Large schemas (100+ tables, 1000+ columns) must not lag
- Familiar keyboard shortcuts (VS Code-compatible)
- Minimal bundle impact (we have a 350 KB gzipped target per route)

## Decision

Use **Monaco Editor** (the editor that powers VS Code) via `@monaco-editor/react`.

Monaco is **lazy-loaded** using Next.js `dynamic()` with `{ ssr: false }`. It only loads when the user first switches to the Code view — not on initial page load. This keeps the schema designer route at ~164 KB first-load JS, with Monaco loaded on-demand only when needed.

The editor is configured with:

- `language: "json"` — built-in JSON syntax highlighting and validation
- `automaticLayout: true` — resizes with the container
- `minimap: { enabled: false }` — saves horizontal space
- `scrollbar: { alwaysConsumeMouseWheel: false }` — allows the page to scroll when the editor is at the top/bottom

Changes are debounced 600ms before updating the Zustand store. Invalid JSON sets a parse error indicator in the toolbar but does not clear the previous valid schema from the store — preserving undo safety.

## Consequences

**Benefits:**

- Monaco's JSON language service provides squiggles, bracket matching, and folding out of the box
- VS Code keyboard shortcuts are familiar to developers
- Performance is excellent for large files (virtual rendering)
- Lazy loading keeps the initial bundle within budget

**Drawbacks:**

- Monaco is ~2 MB uncompressed. Even lazy-loaded, it adds to the Code view's first-open cost (~1-2s on slow connections). Acceptable for an advanced feature.
- Monaco does not support mobile touch input well. The Code view is de-emphasized for mobile; the Diagram and Table views are primary on small screens.
- `@monaco-editor/react` wraps Monaco in a React component with some overhead; updates from outside React (store changes) must be careful not to reset the cursor position. The implementation handles this by only updating the editor value when the external schema differs from the last-parsed value.

## Alternatives Considered

**CodeMirror 6:** Lighter (~200 KB), more mobile-friendly. Rejected: less VS Code familiarity; the JSON schema validation plugin is less mature than Monaco's built-in language service.

**Plain `<textarea>`:** Zero bundle cost. Rejected: no syntax highlighting, error markers, or keyboard shortcuts. Poor experience for large schemas.

**Ace Editor:** Mature, smaller than Monaco. Rejected: declining maintenance; Monaco is now the industry standard for browser-based code editing.

## Note

Originally numbered ADR-0107; renumbered to avoid conflict with ADR-0107 (dataloader-for-n-plus-1-prevention, Objective 13).
