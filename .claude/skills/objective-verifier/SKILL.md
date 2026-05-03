---
name: objective-verifier
description: Use this skill whenever the user is implementing, verifying, completing, or checking progress on any objective from objectives/. Trigger on phrases like "implement objective N", "is objective N done", "what's left on objective N", "verify objective N", "check Definition of Done", "next steps for objective N", "what does objective N require", or when the user references an objective number (e.g. "objective 8", "obj 14", "04c"). Also trigger before starting work on any non-trivial task — orient against the relevant objective first. Reads the objective document, extracts locked decisions, Definition of Done checkboxes, ADRs to write, and verification steps, then produces a structured completion report against the current codebase state.
---

# Objective Verifier

Lighthouse Studio's 36 objective documents are the implementation contract. They contain locked decisions, Definition of Done checklists, ADRs to write at specific numbers, and verification steps. This skill ensures objectives are fully delivered — not just "mostly done" — by mechanically checking implementation against the spec.

## When to use

- Starting work on an objective: produce the full implementation checklist
- Mid-implementation: report what's done, what's outstanding, what's at risk
- Claiming completion: verify every Definition of Done checkbox before declaring done
- Reviewing a PR that touches an objective: spot-check spec compliance

## How to use

### Step 1: Locate the objective

Objectives live in `objectives/<NN>-<name>.md` (some have suffixes like `04a`, `04c`, `15.5`). If the user references an objective by number, find the file via Glob: `objectives/<NN>-*.md`.

If the user describes a feature without naming an objective, scan the objective titles to identify the right one. Don't guess — confirm with the user before proceeding.

### Step 2: Extract the structure

Every objective document has a consistent shape. Extract:

1. **Status & Prerequisites** — header lines indicating readiness and dependencies
2. **Locked Decisions** — typically a markdown table; these are non-negotiable
3. **Scope (In/Out)** — what belongs vs. what defers to later objectives
4. **Definition of Done** — explicit checkboxes; the completion contract
5. **ADRs to write** — usually a list of ADR numbers and titles
6. **Verification steps** — commands to run, tests to pass, behaviors to observe
7. **Anti-patterns to refuse** — things the implementer must NOT do

If a section is missing or unclear, flag it explicitly. Don't fabricate criteria.

### Step 3: Cross-reference against the codebase

For each Definition of Done item, check the current repo state:

- **Files exist?** Use Glob/Read against the paths the objective mentions
- **ADRs written?** Check `docs/adr/<NNNN>-<slug>.md` exists for each required number
- **Tests pass?** If the objective specifies test commands, note them (don't run unless asked)
- **Conformance covered?** For port/adapter work, check `packages/ports/<port>/conformance/`
- **Documentation updated?** Check `docs/`, package-level `CLAUDE.md`, or guides referenced

For each locked decision, scan for violations:

- The decision says "use zod at boundary"? Look for any service method without zod validation.
- The decision says "Result types only"? Look for `throw` in service methods (excluding test code).
- The decision says "first step is authz"? Look for service methods that don't call `authz.check()` early.

### Step 4: Produce the report

Use this exact structure:

```markdown
# Objective <N>: <Title> — Verification Report

**Status:** <derived from checks: Not started / In progress (X%) / Complete / Blocked>
**Prerequisites:** <list, with status of each>

## Locked Decisions Compliance

| Decision   | Status       | Evidence                   |
| ---------- | ------------ | -------------------------- |
| <decision> | ✅ / ⚠️ / ❌ | <file:line or "not found"> |

## Definition of Done

- [x] <item> — <evidence>
- [ ] <item> — <what's missing>

## ADRs Required

| ADR  | Title   | Status                            |
| ---- | ------- | --------------------------------- |
| 0NNN | <title> | ✅ written / ❌ missing / ⚠️ stub |

## Verification Steps

<list each step from the objective with current status; do not run commands unless asked>

## Risks & Gaps

<things that look done but might not satisfy the spirit of the spec — e.g., authz check exists but doesn't cover a specific case>

## Recommended Next Actions

<ordered list of what to do next, with priorities>
```

### Step 5: When implementation is requested

If the user asks "implement objective N", don't dive into code. First produce the verification report so the gap is clear, then propose a plan with discrete tasks. Get confirmation before writing code (per CLAUDE.md's "plan before you implement" guidance).

## What this skill does NOT do

- It does not run tests or commands (read-only by default)
- It does not modify objective documents (those are spec; treat as read-only)
- It does not relitigate locked decisions (if the objective says X, X is the answer)
- It does not invent Definition of Done items (only what the objective contains)

If a Definition of Done item is genuinely ambiguous, surface it and ask — don't guess.

## Anti-patterns to refuse

- **Cherry-picking checkboxes.** Every Definition of Done item matters. Don't skip "boring" ones (docs, ADRs, conformance) to declare done faster.
- **Conflating "code exists" with "done".** A service method existing isn't the same as it following the canonical shape, having tests, having an audit event wired in, and having an ADR if required.
- **Treating locked decisions as suggestions.** If the objective says "use zod" and the implementer used Joi instead, that's a violation, not an acceptable variation.
- **Stopping at "looks fine".** When in doubt, check more rather than less. Under-verification is worse than over-verification.
