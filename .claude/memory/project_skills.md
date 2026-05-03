---
name: Project-level skills available
description: Three project-scoped skills live in .claude/skills/ for objective verification, canonical service shape checking, and ADR writing. Use them rather than reimplementing the same checks ad-hoc.
type: reference
originSessionId: 07882865-3e79-446d-a02b-657d6f558e5a
---

The Lighthouse Studio repo has three project-level skills in `.claude/skills/`:

1. **objective-verifier** — Reads any objective from `objectives/<NN>-*.md`, extracts locked decisions, Definition of Done checkboxes, ADRs to write, and verification steps, then cross-references against the codebase. Triggers on phrases like "implement objective N", "is objective N done", "verify objective N", or any objective number reference. Use it before starting work on an objective AND before claiming completion.

2. **service-shape-check** — Validates service methods against the canonical shape from Objective 8 (validate → authorize → precondition → execute → audit → return). Triggers when adding/modifying any `*.service.ts` file or when reviewing a service. Surfaces missing authz checks, missing workspace scoping, throws instead of Result types, missing audit emission. Treats authz/scoping gaps as critical security bugs — not style issues.

3. **adr-writer** — Auto-discovers next ADR number, copies the template at `docs/adr/0000-template.md`, and fills in Context/Decision/Consequences/Alternatives. Triggers on "write an ADR", "document this decision", or when an objective lists ADRs to write. Highest existing ADR number is in the 0080s — always Glob `docs/adr/*.md` to find the next free number, don't guess.

These skills are version-controlled in the repo (committed under `.claude/skills/`), so they apply to anyone working on the project, not just one machine. They were created 2026-05-03 to fill gaps the user identified: generic skill marketplaces don't cover this project's specialized patterns (multi-database conformance, hexagonal architecture, locked objective specs).
