# ADR-0160: Reasoning Capture as a CI Gate

**Status:** Accepted
**Date:** 2026-05-06
**Objective:** 20 (AI Pipeline Foundation)

## Context

ADR-0153 establishes that every AI-generated artifact must include a populated `ReasoningRecord`. This is a strong invariant: reasoning is not optional commentary but a first-class part of the artifact contract. The `ReasoningRecord` is non-optional in the TypeScript output schema for all `definePrompt` definitions.

Experience with conventions-as-documentation shows that TypeScript type enforcement alone is insufficient. Developers write tests with empty objects (`reasoning: {} as ReasoningRecord`) to satisfy the type system. Fixtures and migrations can be committed with placeholder values. Over time, the convention degrades unless something automatically rejects non-conforming changes.

A CI gate is needed that makes reasoning capture not just a type requirement but a merge requirement.

## Decision

A lint/CI rule runs on every PR and rejects any change that lands a file containing an artifact fixture, database migration creating an artifact table, or prompt output test that lacks a fully populated `ReasoningRecord`. "Fully populated" means all five fields are present and non-empty:

- `rationale`: non-empty string
- `alternatives_considered`: array with at least one entry, each with non-empty `option` and `reason_rejected`
- `assumptions`: array with at least one entry
- `uncertainties`: array with at least one entry (may include `"none identified"` as a valid entry)
- `source_artifacts`: array (empty array is valid for prompts with no upstream artifact context)

The CI rule is implemented as a custom ESLint rule in `packages/eslint-config/rules/require-reasoning-record.js` and a complementary fixture validator in the test infrastructure. The ESLint rule catches in-code literal objects; the fixture validator catches JSON/YAML test fixtures.

The rule reports the file path and which fields are missing or empty. It cannot be suppressed with an ESLint disable comment; the only override path is a documented exception in the rule's configuration with a comment approved at PR review.

## Consequences

**Easier:**

- The reasoning convention established in ADR-0153 is automatically enforced; it cannot degrade over time through shortcuts in test fixtures
- New prompt authors receive immediate feedback in CI when their output schema fixture is missing reasoning fields, rather than discovering the gap at code review
- The rule is self-documenting: its error messages link to ADR-0153 and explain what each field should contain, making it a teaching tool for developers unfamiliar with the convention

**Harder:**

- Writing test fixtures for prompts requires more effort: a meaningful `ReasoningRecord` in a fixture takes 10–15 lines of JSON rather than a placeholder; this is intentional friction that promotes quality fixtures
- The no-disable-comment policy means genuinely exceptional cases (e.g., a migration that adds the reasoning column to an existing artifacts table before backfilling) require a rule configuration change, which must go through PR review; this process overhead is acceptable given the rarity of exceptions
- The custom ESLint rule must be maintained as the `ReasoningRecord` schema evolves; if new required fields are added (e.g., `confidence_level`), the rule must be updated in the same PR

**Alternatives Considered:**

- **TypeScript type enforcement only:** Non-optional field in the output schema; rejected — type satisfaction with empty objects or `as` casts circumvents the intent without triggering a type error; runtime Zod validation catches empty arrays/strings but only during test execution, not at PR time
- **Code review convention (no automated check):** Rely on reviewers to catch missing reasoning; rejected — human review at scale is inconsistent; a reviewer focused on logic correctness may overlook a shallow `alternatives_considered`; automation is more reliable than convention
- **Suppressible ESLint rule:** Allow `// eslint-disable reasoning-record` for cases where reasoning is genuinely not applicable; rejected — "not applicable" cases do not exist in the design; every AI-generated artifact has a rationale; a suppressible rule becomes routinely suppressed within months
