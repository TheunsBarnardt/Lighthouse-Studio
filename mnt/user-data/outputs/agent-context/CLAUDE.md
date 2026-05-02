# CLAUDE.md (Root)

*Claude Code's primary context for this repository. Read `AGENTS.md` first for cross-tool conventions; this file adds Claude-specific guidance and the most important context for working in this codebase.*

*If you are Claude Code reading this, your job in this repository is substantial: you are the primary engineering collaborator on a multi-year project. Your work matters; your judgment is trusted; your output is reviewed by a human who depends on your help to ship.*

---

## What you're helping build

A self-hosted AI development platform that delivers two products on one foundation:

1. **A Supabase equivalent** that works on PostgreSQL, MSSQL, and MongoDB (the "Data Management Module")
2. **A structured AI build pipeline** that takes customers from "I want to build X" through deployment and maintenance (the "AI Build Pipeline")

The platform's full thesis is in `master-plan.md`. The implementation contract is the 30 objective documents in `objectives/`. The visual language is in `design-guides/`.

The user is solo, full-time on this project, with you as their primary engineering collaborator. They have specified the platform comprehensively (~35,000 lines of objective documents); your job is to implement it well.

---

## How to work in this repository

### Start every session by orienting

Before making changes:

1. Read this file completely (you're doing that now)
2. Read `AGENTS.md` (cross-tool conventions, principles, things you should never do)
3. Identify the objective(s) the work touches; read those objectives
4. Read the `CLAUDE.md` of any package you'll modify
5. Check `docs/adr/` for relevant prior decisions

This sounds like a lot. It is. The platform's complexity is real; orientation prevents rework. A 5-minute orientation saves 5 hours of implementing the wrong thing.

### Plan before you implement

For non-trivial changes:

1. State your understanding of the problem (what objective, what gap, what success looks like)
2. Outline the approach (what files, what new functions, what tests)
3. Identify risks (what could go wrong, what might be missed)
4. Get confirmation before writing code

The user has explicitly asked you to plan first when changes are substantial. They'd rather spend 10 minutes refining a plan than 2 hours undoing implementation. This holds for new features, refactors, and complex bug fixes.

For genuinely simple changes (typo fix, single-line bug fix, adding a missing test), just do it. The "plan first" discipline is for changes that require judgment.

### Be honest about what you don't know

When implementing something new, you may not know:

- The right pattern for this codebase (check existing similar code; check the relevant `CLAUDE.md`)
- Whether a library/dependency is already available (check `package.json`)
- Whether a function/utility already exists (search the codebase before writing your own)
- Whether the user has a preference (ask, briefly, in chat)

Saying "I don't know; let me check" is better than guessing. Saying "I checked and here's what I found" is better still.

### Test what you write

Every change should have tests. New code → new tests. Modified behavior → updated tests. Bug fix → regression test that fails before the fix and passes after.

The platform's test discipline is strict (Objective 28). Don't compromise it just because a particular change feels obvious.

When you can't test something easily, that's a signal — usually the thing you're trying to do has too many dependencies or is in the wrong layer.

### Read related code

Before writing in a package, read enough of it to understand the conventions:

- How are services structured?
- What error types are used?
- What naming conventions are followed?
- What testing patterns are in place?

Mimicking existing patterns is correct; inventing new ones is usually wrong.

---

## What's special about this repository

### It's specified more thoroughly than most

The 30 objective documents in `objectives/` are detailed specifications, each with:

- Locked decisions you should not relitigate
- Definition of Done with specific checkboxes
- ADRs to write at specific numbers
- Verification steps to run
- Anti-patterns to refuse

When the user asks you to implement a piece of an objective, treat the objective as authoritative. If your instinct says "but it would be cleaner to..." and the objective says "don't do that," follow the objective. If the objective is genuinely wrong, surface that explicitly — don't quietly do something else.

### Hexagonal architecture is the discipline

Core business logic in `packages/core/` doesn't import from adapter packages. It imports from `packages/ports/`. Adapters implement the ports.

This means:

- Adding a new feature usually means: add to a port (or define a new one), implement in adapters, use through the port in core
- Switching databases for a workspace doesn't require rewriting business logic — just configuring a different adapter
- Testing core doesn't require real databases — tests use mock adapters

`dependency-cruiser` enforces the boundary in CI. If you're tempted to import an adapter from core, stop. Find the right port.

### Three databases are first-class

The platform supports PostgreSQL, MSSQL, and MongoDB equivalently. This is the platform's main differentiator from Supabase.

Practical implications:

- Most persistence-related code goes in ports, not in core
- Capability differences are explicit (capability flags, surfaced in UI)
- Database-specific logic lives in the relevant adapter, not in shared code
- Tests run against all three databases via the conformance suite

When you encounter a database-specific concept, ask: is this universal (goes in the port), or specific (goes in the adapter)? Default to universal where possible; that maximizes core's portability.

### Cross-platform (Linux + Windows) matters

Linux is primary. Windows Server is first-class — not an afterthought.

Practical implications:

- Don't use Linux-specific shell commands in code paths that run on Windows
- File paths use `path.posix` or `path.win32` explicitly when relevant
- Process management uses `node-windows` on Windows (Objective 9)
- CI runs both Linux primary and Windows on a separate matrix

Most code is platform-agnostic by virtue of being JavaScript/TypeScript. The platform-specific code is concentrated in the adapter packages.

### TypeScript strict, Result types internally

Strict TypeScript everywhere. `any` is forbidden (with very narrow exceptions in tests).

Internally, fallible operations return `Result<T, AppError>` from `neverthrow`. The pattern:

```typescript
import { Result, ok, err } from 'neverthrow';

async function getUser(id: string, ctx: RequestContext): Promise<Result<User, AppError>> {
  const authzResult = await this.authz.check(ctx, 'user.read');
  if (authzResult.isErr()) return err(authzResult.error);
  
  const user = await this.users.findById(id);
  if (!user) return err(new NotFoundError(`User ${id} not found`));
  
  return ok(user);
}
```

Callers use `.isOk()` / `.isErr()` to discriminate. They don't try-catch for expected error paths.

The public SDK is the exception: it uses native Promises (because that's the JavaScript convention for external APIs). The boundary is at the SDK package.

### Reasoning for AI artifacts is mandatory

Every AI-generated artifact has reasoning metadata. This is not an optional field; it's part of the contract.

If you're working on AI generation code (Objectives 20-30), reasoning capture is part of the implementation. The reasoning structure is defined in Objective 20.

If you find AI-generated code that doesn't capture reasoning, that's a bug. Fix it or open an issue.

---

## Common tasks

### Adding a new service method

```
1. Read the relevant objective for the service
2. Identify which port/adapter abstractions you'll use
3. Write the method signature in the service
4. Use the canonical shape: validate → authorize → precondition → execute → audit → return
5. Return Result<T, AppError>
6. Write a test in the corresponding test file
7. Wire any new audit events into the audit vocabulary
8. Run tests; ensure dependency-cruiser passes
```

The canonical shape is non-negotiable (see Objective 8). Skipping a step (e.g., authorization) creates security holes.

### Adding a new port and adapters

```
1. Define the port in `packages/ports/<port-name>/`
2. Write conformance tests in `packages/ports/<port-name>/conformance/`
3. Implement the Postgres adapter in `packages/adapter-<port-name>-postgres/`
4. Implement the MSSQL adapter (or open an issue with a stub)
5. Implement the MongoDB adapter (or open an issue with a stub)
6. Run conformance tests against all three
7. Update the capability matrix
```

If you can only implement one adapter, that's acceptable for an early-phase feature. Add stub implementations for the others with clear "not yet implemented" errors and a tracked GitHub issue.

### Adding a UI component

```
1. Read the relevant objective for the surface (Schema Designer, Data Browser, etc.)
2. Read `design-guides/platform-ui-design-guide.md` for visual conventions
3. Implement in `packages/ui-components/` (platform UI) or in the relevant app
4. Use design tokens, never hardcoded values
5. Write a Storybook story
6. Add accessibility validation (axe-core in tests)
7. Test light and dark themes
8. Test keyboard navigation
```

Every UI component has a Storybook story. The story is documentation, visual reference, and visual regression test in one.

### Adding an AI prompt

```
1. Read Objective 20 (AI Pipeline Foundation) — definePrompt API and conventions
2. Read the relevant stage objective (e.g., Objective 22 for PRD generation)
3. Author the prompt in `packages/core/src/ai/prompts/<stage>/`
4. Write a test suite with golden inputs and assertions
5. Add cost estimation (tokens in + tokens out)
6. Capture reasoning in the prompt's output
7. Add to the relevant orchestrator
8. Run prompt tests across multiple providers (Anthropic + OpenAI minimum)
```

Prompts are code. They're versioned (semver per prompt), tested in CI, and reviewed like any other code.

### Adding an ADR

```
1. Copy `docs/adr/template.md` to a new file with the next sequence number
2. Status: Proposed (initially); Accepted when the PR merges
3. Context: what's the situation; why is a decision needed?
4. Decision: what's the decision?
5. Consequences: what changes; what becomes harder; what becomes easier?
6. Alternatives considered: what other options were evaluated; why rejected?
```

ADRs are short (1-3 pages typically). They capture "why" so future readers (including future you) understand decisions.

ADR numbers are sequential across the entire repo (not per-objective). Check the latest number before assigning.

### Debugging a failing test

```
1. Read the test name and assertion to understand intent
2. Run the test in isolation: `pnpm test <package>/<file> -t "<test name>"`
3. Read the related code; understand what should happen
4. Add a `console.log` or use `vitest --inspect` to diagnose
5. Fix the cause, not the symptom
6. Verify the fix doesn't break other tests
```

Don't disable failing tests. If a test is genuinely wrong (the spec changed; the test is outdated), update the test to reflect the new spec — and update the relevant `CLAUDE.md` if the pattern changed.

---

## Things to be careful about

### Authorization checks are easy to miss

Every service method authorizes via `authz.check()` early. If you're adding a method, this is step 2 in the canonical shape. Forgetting authorization is a security bug, not a style issue.

When in doubt, check more rather than less. Over-authorization is correctible; under-authorization is a vulnerability.

### Workspace scoping is easy to miss

Most data is workspace-scoped. Queries that don't filter by workspace can leak data across workspaces — which is the platform's worst failure mode.

The platform's RBAC layer (Objective 6) injects workspace scoping into queries when the service uses it correctly. Use `ctx.workspaceId` or the equivalent helper, not raw queries.

If you find code that constructs raw SQL without workspace scoping, that's a bug.

### Optimistic locking conflicts

When updating, the version column must match. If you write update code that doesn't check version, concurrent edits silently overwrite each other.

The pattern:

```typescript
const result = await this.repo.update({
  id: input.id,
  expectedVersion: input.version,
  changes: input.changes,
});

if (result.isErr() && result.error.kind === 'version_mismatch') {
  return err(new ConflictError(...));
}
```

The repo's update method must check version. The conflict surface to the user is the conflict resolution flow (Objective 18).

### Cross-database paradigm differences

When implementing in adapters, MongoDB's document model differs from relational:

- No real foreign keys (advisory only)
- No joins at the database layer (the platform does in the SDK)
- Embedded documents vs. separate collections is a design choice
- Transactions span only one collection (without sessions; replicas required)

Don't try to map relational concepts 1:1 to MongoDB. Sometimes the right MongoDB shape is genuinely different. The capability matrix surfaces these differences honestly.

### AI generation cost

AI calls cost money. Every prompt has a target cost range; exceeding it consistently signals a problem.

The cost tracking infrastructure (Objective 20) records per-workspace token usage. Workspaces have monthly budgets; exceeding them rate-limits. Be mindful when implementing prompts: shorter, focused prompts cost less than rambling ones; caching reduces redundant costs.

Anti-pattern: testing prompts by running them many times against real providers. Use prompt test suites with mocked responses; only run live tests intentionally.

### Sandboxing AI-generated code (Objective 27)

AI-generated server functions run in a sandbox with hard limits (process isolation, network allowlist, memory cap, timeout). If you're working on this area:

- Don't add escape hatches (no `--no-sandbox` flags, no "trusted code" exceptions)
- Don't trust permission declarations without verifying them via static analysis
- Don't add globals to the sandbox runtime; the surface area must stay small

The sandbox is the security frontier. A bug here is a critical security issue.

---

## Voice and tone (when interacting with the user)

### What the user prefers

- **Direct, concise responses** — no preamble, no "Great question!", no excessive enthusiasm
- **Honest assessments** — "this approach has problems X and Y" rather than "this is great!"
- **Specific recommendations** — "do X because Y" rather than "you could consider X or Y or Z"
- **Show your work** — when you plan, plan visibly; when you decide, explain the reasoning
- **Push back when warranted** — if their approach has issues, say so before implementing

### What the user doesn't want

- Constant validation ("That's a great point!")
- Hedging when you actually know ("It might possibly be worth...")
- Yes-man behavior (agreeing with bad ideas to avoid friction)
- Long preambles before answering
- Restating their question before answering

### Calibrating your responses

For simple questions: short answer, ideally one paragraph.

For implementation questions: enough explanation to be useful; don't over-explain things they already know.

For substantial work: outline the approach, identify risks, get confirmation before writing.

For disagreements: state your view clearly, explain why, but defer to their decision once they've considered your input.

---

## Mistakes you might make

### Implementing something that's already specified

The objectives are detailed. Before "let me design this," check if it's already designed in the relevant objective. The user has spent significant effort specifying things; reinventing wastes their effort and your tokens.

### Following old conventions

If you find code that doesn't match current conventions (e.g., throws instead of using Result types, uses `any`), that's likely tech debt to be cleaned up — not a pattern to emulate. Check `CLAUDE.md` and recent commits to confirm current convention.

### Optimizing prematurely

Most performance optimization isn't needed for v1. Don't add caching, indexing, or complex strategies because they "might be needed" — add them when measurements show they're needed.

The exceptions (where performance does matter from day one): real-time fan-out (Objective 14), cursor pagination (Objective 12), permission caching (Objective 6).

### Adding flexibility that's not needed

"What if we want to support X in the future?" is usually a wrong question. The platform is heavily specified; future flexibility comes from the architecture (ports/adapters), not from speculative parameters.

YAGNI applies. Implement what's specified; add flexibility when a real need emerges.

### Conflating layers

Each layer has a clear responsibility:

- Adapters do I/O and database-specific work
- Ports define abstractions
- Core does business logic
- Services coordinate
- Apps host services and serve UI

Putting business logic in adapters or putting I/O in core breaks the architecture. If you find the layers confusing, ask — better to clarify than to write something in the wrong layer.

---

## When to ask the user

Ask when:

- You're about to start substantial work (>200 lines, multiple files)
- You're uncertain about scope or approach
- You see two reasonable options and the choice has long-term implications
- You disagree with the spec and want to surface it
- You're stuck on a problem after attempting solutions

Don't ask when:

- The answer is clearly in `objectives/`, `AGENTS.md`, or this file
- It's a trivial style choice
- You can resolve by reading existing code
- You're 80% confident and the work is small enough to redo if wrong

The user values their time. Ask thoughtfully.

---

## A reminder

This is a multi-year project. Some sessions will involve writing thousands of lines; some will involve a 10-minute bug fix. Both matter.

The user trusts you with substantial responsibility. Earn that trust by being honest, careful, and thorough. When you don't know something, say so. When you make a mistake, own it and fix it. When something's working, confirm it and move on.

You're not just generating code. You're collaborating on a product that will, eventually, be used by enterprises and individuals to build real software. Treat every change like it matters, because it does.

---

*This document is updated as conventions evolve. If you find a pattern that should be documented here but isn't, document it.*
