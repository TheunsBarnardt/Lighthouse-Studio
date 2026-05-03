# ADR-0089: Cross-Platform Linter Rules for Windows Compatibility

**Status:** Accepted
**Date:** 2026-05-03
**Deciders:** solo

## Context

The platform's codebase applies cross-platform discipline: `path.join` instead of `/`-concatenation, `os.tmpdir()` instead of `/tmp`, `process.on('SIGTERM')` instead of Linux-only signals. But discipline applied informally degrades over time. A contributor in a hurry writes `path.join(dir, '/', 'foo')` or reaches for `SIGUSR2` without thinking about Windows.

Existing `platform/` ESLint rules (Objective 8) focus on service-layer correctness: context-first parameters, typed errors, audit on mutation. They catch architectural mistakes but not platform compatibility mistakes.

The only current gate is "run CI on Windows" — but that requires a Windows CI job to exist, a full test run to complete, and the problem to manifest as a test failure rather than a compile error. Cross-platform bugs are often silent at test time and only manifest in production when a specific code path is exercised on a Windows server.

Linter rules provide a faster feedback loop: they catch platform bugs at code-edit time, before commit, before CI.

## Decision

Add three new ESLint rules to `packages/config/src/eslint-plugin-platform.ts` under the `platform/` namespace:

1. **`platform/no-path-concatenation`** — reports string literals that look like Unix paths used in concatenation or template literals inside path operations. Guides toward `path.join`/`path.resolve`.

2. **`platform/no-hardcoded-tmp`** — reports occurrences of `/tmp/` or `\\tmp\\` as string literals. Directs to `os.tmpdir()`.

3. **`platform/no-linux-only-signals`** — reports `process.on('SIGUSR1', ...)`, `process.on('SIGUSR2', ...)`, `process.on('SIGHUP', ...)` and other signals that don't exist on Windows, where using them would silently have no effect. `SIGTERM` and `SIGINT` are allowed (they exist on Windows via Node's emulation).

These rules are warnings (`'warn'`) in `eslint.config.mjs` for the general codebase and errors (`'error'`) in CI via the `--max-warnings 0` flag, so they fail the build without being locally disruptive.

The rules are applied to all non-test source files in `packages/` and `apps/`. Test files are excluded (it is acceptable to use platform-specific paths in tests that explicitly target one platform).

## Consequences

### Positive

- Platform bugs caught at code-edit time rather than in Windows CI or production.
- Rules document which patterns are forbidden, serving as a learning aid for contributors unfamiliar with Windows constraints.
- No runtime cost; purely static analysis.
- Reuses the existing `platform/` plugin infrastructure from Objective 8.

### Negative

- Three new rules add complexity to the ESLint plugin. Each rule requires tests and maintenance.
- False positives are possible (e.g., a URL-path string that legitimately uses `/`). Rules must be precise enough to avoid flagging valid code.
- `platform/no-path-concatenation` is the hardest to implement correctly — distinguishing file paths from URL paths in string literals requires heuristics.

### Neutral

- The rules reinforce discipline already expected by convention, rather than introducing new requirements. Code that already follows `path.join` conventions passes without changes.
- Cross-platform test suite (`tests/cross-platform/`) verifies that existing platform utilities work correctly on both Linux and Windows at test time; linter rules complement this by preventing regressions before they run.

## Alternatives Considered

### Option A: ESLint `no-restricted-syntax` with glob patterns

Use the generic `no-restricted-syntax` rule to reject specific AST patterns.

**Partially used:** `no-restricted-syntax` can handle simple cases (e.g., forbid string literals matching `/\/tmp\//`). But custom rules are more precise — they can walk the AST to determine context (is this string in a `path.join` call? Is this a URL, not a file path?) and provide a more actionable error message.

### Option B: Rely on Windows CI to catch cross-platform bugs

Don't add linter rules; trust the Windows CI matrix (Objective 9, §5.8) to catch bugs.

**Rejected as sole mechanism:** Windows CI is a safety net, not a first-line gate. It runs on every PR (focused subset) and nightly (full suite). A bug that slips past linting doesn't reach Windows CI until a PR is created, and the feedback loop is slow (CI run time vs. lint run time). Linting is 100× cheaper.

### Option C: Enforce via code review

Rely on reviewers to catch platform compatibility mistakes.

**Rejected:** The user is solo; there is no reviewer. And even with reviewers, human review misses subtle mistakes (e.g., `path.join('base/', filename)` where `'/'` is an explicit separator). Mechanical enforcement is more reliable.

## References

- Objective 09: Cross-Platform Runtime (§5.10)
- ADR-0084: Windows Server as First-Class Deployment Target
- Existing rules: `platform/service-method-context-first`, `platform/no-bare-error-throws`, `platform/audit-on-mutation`
- [ESLint custom rules documentation](https://eslint.org/docs/developer-guide/working-with-rules)
