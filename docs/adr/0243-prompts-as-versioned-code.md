# ADR-0243: Prompts as Versioned Code in packages/core

**Status:** Accepted
**Date:** 2026-05-06
**Objective:** 20 (AI Pipeline Foundation)

---

## Context

AI prompts degrade silently: a model update, a subtle wording change, or a new edge case can shift output quality without an obvious error. Treating prompts as runtime configuration (strings in a database or environment variables) makes them invisible to code review, untestable in CI, and unversioned in git history.

---

## Decision

Prompts are TypeScript files in `packages/core/src/ai/prompts/<stage>/`. Each prompt is defined using `definePrompt()` and registered via `registerPrompt()`. The `PromptDefinition` type carries:

- `id` and `version` (semver) — so generation records reference exactly which version ran
- `inputs` and `outputs` — Zod schemas; validated on every call
- `modelConfig` — model ID, temperature, max tokens; change-tracked in git
- `systemPrompt` — static string; change-tracked
- `userPromptTemplate` — function over typed inputs; change-tracked
- `tests` — array of golden input/assertion pairs; run in CI

Prompt versions follow semver: patch for wording tweaks, minor for output shape additions (backwards compatible), major for breaking output schema changes (requires migration of existing artifacts that used the prior version).

The generation record stored with every artifact includes `promptId + promptVersion`, so auditors can replay exactly which prompt generated any artifact.

---

## Consequences

**What becomes easier:**

- Prompt changes go through pull request review like any other code change.
- CI runs golden tests; regressions are caught before merge.
- Auditors can identify which prompt version produced any artifact.
- Rollback is `git revert`.

**What becomes harder:**

- Prompt iteration requires a code commit and deploy cycle. For rapid experimentation, engineers can override prompt config via an environment variable (development mode only; not surfaced in production).
- Non-engineers who want to tune prompts need a code path, not a UI. A future "prompt editor" UI could write back to the filesystem through an admin interface — deferred.

---

## Alternatives Considered

- **Prompts in the database, editable via admin UI:** Rejected — unversioned, unreviewed, untestable in CI.
- **Separate `packages/prompts/` package:** Rejected — prompts use core types (Zod schemas, domain entities); co-locating in core avoids circular dependencies.
- **LangSmith or similar prompt registry:** Rejected — external dependency with its own versioning model; the in-code approach is simpler and fully owned.
