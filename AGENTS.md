# AGENTS.md

_Repository-level instructions for AI coding agents. This file follows the [agents.md](https://agents.md/) convention and is honored by Claude Code, Cursor, Aider, Continue, Codex, and other AI coding tools that respect the convention._

_If you are an AI agent reading this file, these instructions are authoritative. Read this file completely before making changes. Read `CLAUDE.md` next for Claude-specific guidance._

---

## What this repository is

This is a self-hosted, AGPL-licensed AI development platform. Two products on one foundation:

1. **Data Management Module** — a Supabase equivalent that works on PostgreSQL, MSSQL, and MongoDB
2. **AI Build Pipeline** — a structured AI-assisted development pipeline (intent → PRD → schema → UI → code → tests → deploy → maintain)

The platform's full thesis, market positioning, and architectural decisions are in `master-plan.md`. The implementation contract is the 30 objective documents in `objectives/`. **Read those before planning substantial work.**

This is a multi-year, solo-with-AI-collaborator project. Code quality matters more than velocity. The platform is intended for enterprise security review eventually; corners cut now produce reviews failed later.

---

## Operating principles

### 1. Read the contract before you write code

Every change touches one or more of the 30 objectives in `objectives/`. Before making non-trivial changes, read:

1. The relevant objective document (it has a Definition of Done you must not break)
2. The relevant ADRs (`docs/adr/`)
3. The relevant `CLAUDE.md` in the package(s) you're touching

If the objective and the code disagree, **the objective wins**. If you find a genuine conflict that can't be resolved by code change, surface it; don't paper over it.

### 2. Hexagonal architecture is non-negotiable

The codebase is organized around ports (interfaces) and adapters (implementations). Core business logic lives in `packages/core/`; it imports from ports, never from adapter packages. Adapters live in `packages/adapter-*` packages.

`dependency-cruiser` enforces these boundaries in CI. If your change introduces a forbidden import, CI will fail. **Don't try to silence dependency-cruiser; respect the boundary.**

The boundary exists because the platform supports three databases (Postgres, MSSQL, MongoDB) and two operating systems (Linux, Windows Server) from day one. Breaking the boundary makes cross-database/cross-platform support harder, not easier.

### 3. Three databases, always

When implementing a feature that touches persistence, you implement it for **all three databases** (Postgres, MSSQL, MongoDB) — or you implement it as a port that has a Postgres adapter and explicit "not yet implemented" stubs for MSSQL/MongoDB with a tracked GitHub issue.

There is no "we'll add MSSQL support later" path. The capability matrix (auto-generated from `packages/adapter-*-conformance` test results) tracks what works where; it must stay honest. If a feature only works on one database, the platform UI shows that explicitly.

### 4. TypeScript strict, neverthrow Result types internally

The codebase uses TypeScript strict mode everywhere. `any` is forbidden except in specific test fixtures (and even there, prefer typed mocks).

Internally, fallible operations return `Result<T, AppError>` from `neverthrow`. Functions don't throw for expected error paths. Throws are reserved for genuinely unexpected conditions (invariant violations, programmer errors).

The public SDK (`packages/sdk/`) uses native Promises that reject — JavaScript convention for external APIs. The boundary between Result-based internal and Promise-based external is at the SDK package.

### 5. Reasoning attached to AI artifacts

Every AI-generated artifact in this platform carries reasoning metadata. Reasoning is non-optional. If you're working on AI generation code (Objectives 20–30), reasoning capture is part of the implementation, not an afterthought.

If you find AI-generated code paths that don't capture reasoning, that's a bug. Open an issue or fix it.

### 6. Tests are the spec

Each package has a test suite. Conformance tests verify that all adapters of a port behave equivalently. Property-based tests (using `fast-check`) verify invariants across input spaces.

When changing behavior, **change the tests first** to express the new expected behavior, then change the implementation until the tests pass. This is the test-driven discipline the platform commits to.

When tests fail, don't disable them. Fix the cause.

### 7. Explicit over implicit

The platform's design favors explicit configuration, explicit declarations, explicit decisions. Examples:

- Permissions are declared per function and verified by static analysis
- Capability flags are explicit per database adapter
- AI tool authorization is explicit per workspace
- Approval routing is explicit per workspace and stage

If you find yourself adding "magic" behavior (auto-discovery, auto-configuration, implicit defaults that hide consequences), reconsider. The platform is consumed by enterprises that audit everything; magic confuses audits.

---

## Repository layout

```
/
├── README.md                          Project overview
├── AGENTS.md                          This file
├── CLAUDE.md                          Claude-specific instructions
├── master-plan.md                     Thesis and roadmap
├── package.json                       Workspace root
├── pnpm-workspace.yaml                Workspace config
├── turbo.json                         Turborepo pipeline
├── tsconfig.base.json                 Base TypeScript config
├── .dependency-cruiser.cjs            Boundary enforcement rules
├── .github/workflows/                 CI pipelines
│
├── apps/                              Deployable applications
│   ├── web/                           Platform admin UI (React + Vite)
│   ├── api/                           Platform HTTP API (Fastify)
│   └── worker/                        Background jobs worker
│
├── packages/                          Shared packages
│   ├── core/                          Domain logic, services, ports
│   ├── ports/                         Port interfaces (no implementations)
│   ├── adapter-postgres/              Postgres adapter
│   ├── adapter-mssql/                 MSSQL adapter
│   ├── adapter-mongo/                 MongoDB adapter
│   ├── adapter-storage-b2/            Backblaze B2 storage
│   ├── adapter-storage-azure/         Azure Blob Storage
│   ├── adapter-identity-builtin/      Built-in auth
│   ├── adapter-identity-entra/        Microsoft Entra ID
│   ├── adapter-identity-oidc/         Generic OIDC
│   ├── adapter-identity-saml/         SAML
│   ├── adapter-ai-anthropic/          Anthropic Claude
│   ├── adapter-ai-openai/             OpenAI / Azure OpenAI
│   ├── adapter-ai-bedrock/            AWS Bedrock
│   ├── adapter-ai-ollama/             Ollama (local models)
│   ├── adapter-ai-vllm/               vLLM (self-hosted)
│   ├── ui-tokens/                     Platform UI design tokens
│   ├── ui-components/                 Platform UI component library
│   ├── sdk/                           Public TypeScript SDK
│   ├── sdk-react/                     React integration for SDK
│   ├── sdk-vue/                       Vue integration for SDK
│   └── test-utils/                    Shared test utilities, mock factories
│
├── objectives/                        Implementation contracts (READ FIRST)
│   ├── 01-repository-and-tooling.md
│   ├── 01.5-abstraction-architecture.md
│   ├── 02-environment-strategy.md
│   ├── ...
│   └── 30-stage-10-maintenance-and-evolution.md
│
├── design-guides/                     Visual design contracts
│   ├── platform-ui-design-guide.md   The admin UI's design language
│   └── generated-apps-design-guide.md What Stage 6 produces
│
├── docs/
│   ├── adr/                           Architecture Decision Records
│   ├── runbooks/                      Operational runbooks
│   └── developer/                     Developer documentation
│
└── infra/                             Infrastructure as code
    ├── docker/                        Docker Compose stacks
    ├── caddy/                         Caddy reverse proxy config
    └── coolify/                       Coolify configuration
```

This layout is locked by Objective 1. Don't reorganize without an ADR.

---

## How to make changes

### Before you start

1. **Identify the objective(s) the change touches.** Search `objectives/` for relevant terms. Read those objectives' Section 3 (Locked Decisions) and Section 10 (Definition of Done).
2. **Read the relevant `CLAUDE.md` files** in the packages you'll touch.
3. **Check for existing ADRs** that constrain the area: `ls docs/adr/ | grep -i <topic>`.
4. **If you're unsure about scope or approach, ask.** Better to clarify upfront than to write a large change that gets rejected.

### While you work

1. **Make focused changes.** One concern per PR. If you're touching multiple objectives, that's usually a sign the work should be split.
2. **Write tests as part of the change**, not after. Conformance tests for ports; unit tests for services; integration tests for end-to-end flows.
3. **Update the relevant `CLAUDE.md`** if your change introduces patterns future agents should follow.
4. **Add an ADR** for any non-trivial design decision. ADRs follow the format in `docs/adr/template.md`.
5. **Keep dependency-cruiser passing.** Run `pnpm depcruise` before committing.

### Before you commit

```bash
pnpm typecheck         # All packages compile under strict TypeScript
pnpm lint              # ESLint + Prettier check
pnpm test              # All test suites pass
pnpm depcruise         # No boundary violations
pnpm build             # All packages build
```

CI runs the same checks plus the cross-database conformance suite (Postgres + MSSQL + MongoDB) and the cross-platform check (Linux + Windows). Don't push if local checks fail; you'll just bounce off CI.

### Commit messages

Conventional commits format:

```
type(scope): subject

body explaining the why if non-obvious

Closes: #123
ADR: docs/adr/0042-thing.md
Objective: objectives/04-database-postgres.md
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`, `ci`.

Reference relevant objective(s) in the footer when the change implements an objective requirement.

---

## Things you should never do

### Don't introduce new dependencies without justification

Every dependency is a maintenance burden, a security surface, and a build-time cost. Before adding a new dependency:

1. Can you do it with what's already in the codebase?
2. Is the new dependency well-maintained, recently updated, broadly used?
3. Does it have a clean license (MIT/BSD/Apache; not GPL because the platform is AGPL)?
4. Has it been through security review for similar projects?

Add `dependency-justification:` to the commit message explaining why.

### Don't bypass the SDK

Generated apps and the platform's own UI use the SDK for data access. Don't write raw `fetch` calls to the platform's API in code that should use the SDK. The SDK provides typing, auth handling, retries, error normalization, and instrumentation; bypassing it loses all of that.

### Don't disable lint or type errors

If a lint rule is wrong, disable it for the file with a comment explaining why and open an issue to fix it properly. Don't add `// eslint-disable` casually. Don't add `@ts-ignore` or `@ts-expect-error` without a comment explaining the specific reason.

### Don't add `any` types

`any` defeats the type system. If TypeScript is fighting you, you usually want `unknown` and a type guard, or you want to fix the upstream type. If neither works, document why with a comment.

### Don't write to sources during data migration

Objective 25's data migration adapter ports are read-only against source databases. The platform never writes to source databases under any circumstance. If you find code path that violates this, that's a critical bug.

### Don't trust AI-generated code at face value

Including AI-generated code from yourself. The platform applies static analysis to AI-generated functions (Objective 27, Section 5.7) for a reason: even good prompts produce code with subtle issues. Review carefully. The customer's app — and eventually their production data — depends on this code working.

### Don't auto-rollback on metrics

Rollback is a human decision. If you're working on Stage 9 (Deployment, Objective 29), don't add automatic rollback on metric thresholds; surface the alert and let humans decide. Auto-rollback on metric breaches is risky and out of scope until explicitly added in a future objective.

### Don't store secrets in source

API keys, credentials, OAuth secrets — never in source files, never in `.env` files committed to the repo, never in test fixtures. They go through `SecretStorePort` (Objective 1.5). Tests use a mock SecretStorePort with fake values.

### Don't skip approval routing

The platform has configurable approval routing (Objective 6). If you're building a feature that requires user action, the approval routing is the mechanism. Don't add side-channels (direct API calls that bypass approval) for "convenience" — they break the audit trail and undermine the platform's value proposition.

---

## Things you should always do

### Always update the relevant CLAUDE.md

When you introduce a pattern that future agents should follow, document it in the relevant `CLAUDE.md`. The CLAUDE.md files are the on-ramp for future work; they should reflect current reality.

### Always make commit messages explain the why

The diff shows what changed. The commit message explains why. "Fixed bug" is not a commit message. "Fixed bug where workspace deletion didn't cascade to projects because the cascade was defined on the FK but Mongo doesn't enforce FKs; added explicit cascade in the service layer" is a commit message.

### Always check for cross-cutting impact

Touching one package often affects others. After making a change, run the full test suite (`pnpm test`) — not just the package's tests. If you broke something elsewhere, you want to know now.

### Always preserve audit trail

Audit events (Objective 7) capture every meaningful action. If you're adding a new action, add the corresponding audit event. The hash chain depends on every action being captured; gaps break compliance.

### Always use the canonical service shape

Service methods follow the canonical shape from Objective 8: validate → authorize → precondition → execute → audit → return. Don't invent variant shapes. If a service method is missing a step, fix it; don't add a new method that omits the step.

### Always handle the optimistic locking case

The platform uses optimistic locking for most writes. When implementing an update, return a clear error when the version doesn't match — don't silently overwrite. The UI handles the conflict via the conflict resolution flow (Objective 18).

---

## Tool-specific guidance

This repository is designed for AI agent work. Different tools have slightly different conventions; respect them.

### Claude Code

Claude Code reads `CLAUDE.md` files for context. The root `CLAUDE.md` is the entry point; per-package `CLAUDE.md` files provide local context. When working in a package, read its `CLAUDE.md` first.

When proposing large changes, use the planning mode to outline approach before writing code. The objectives in `objectives/` are long; planning helps Claude Code avoid rework.

### Cursor / Continue

These tools respect `.cursorrules` (and similar) for conventions. The repository includes a top-level `.cursorrules` that points to this `AGENTS.md` and the relevant `CLAUDE.md` files.

### Aider

Aider works well with the per-package `CLAUDE.md` pattern. Specify the relevant package's `CLAUDE.md` as context when starting an Aider session.

### Generic agents (Codex, custom)

This file (`AGENTS.md`) is the canonical entry point. Read it; read `CLAUDE.md`; read the relevant objective; then begin work.

---

## When in doubt

The order of authority is:

1. **Security and compliance requirements** (Objective 7's hash chain, Objective 27's sandbox, Objective 5's auth) — never compromise these
2. **Objective documents** in `objectives/` — they're the contract
3. **ADRs** in `docs/adr/` — they record specific decisions
4. **`CLAUDE.md` files** — they record current patterns
5. **Existing code patterns** — emulate what's already there
6. **General principles** in this file

If your change conflicts with a higher-priority item, surface the conflict. Don't quietly violate.

---

## A note on completeness

This repository implements a multi-year vision. Most of the 30 objectives are not yet implemented. When you encounter a gap (a port without adapters, a service without callers, a stub function), check the relevant objective's status. Some gaps are intentional (we haven't shipped that objective yet); some are bugs.

The journey from "fully specified" to "fully shipped" is years of work. The contracts in `objectives/` are designed to survive that journey — to keep the destination clear even when individual implementations evolve.

Be patient with the gaps. Fill them in order. Trust the contract.

---

_Last updated: when Objective 1 ships (which is when the repo first exists)._
