# Objective 1: Repository & Tooling

**Status:** Ready for development
**Prerequisites:** None — this is the first objective
**Blocks:** Every other objective depends on this being complete

---

## 1. Purpose

Establish a monorepo and toolchain where:
- Any new package, app, or service slots in without ad-hoc configuration
- Every commit is verified before it lands on `main`
- A new contributor can clone, install, and run the system within 30 minutes
- Quality gates are mechanical, not human-discretionary
- The hexagonal architecture defined in Objective 1.5 is enforced by tooling, not policy
- The repo works on Linux, macOS, and Windows from the same codebase
- Contributor License Agreements are required and verified
- Future-you in three years can find what you need without archaeology

This objective produces no user-visible features. It produces the substrate that makes every later objective faster, safer, and reviewable. Combined with Objective 1.5, this objective is the platform's foundation.

---

## 2. Scope

### In Scope
- Monorepo structure with workspace tooling
- Package manager and runtime version pinning
- TypeScript configuration, shared
- ESLint and Prettier configuration, shared
- Pre-commit hooks
- Commit message validation
- CI pipeline with required checks
- Branch protection
- Dependency update automation
- Editor configuration
- CLA Assistant integration
- Cross-platform compatibility (Linux/macOS/Windows for development; Linux/Windows for runtime)
- Workspace structure for ports, adapters, composition root
- Dependency boundary enforcement (ports do not import adapters; application code does not import adapters)
- Onboarding documentation
- ADRs documenting these choices

### Out of Scope (Belongs to Later Objectives)
- The actual port interfaces, adapter implementations, and conformance test suites (Objective 1.5)
- Database schema or migrations (Objective 4 family)
- Auth implementation (Objective 5 / Data Management Module)
- Application code beyond stub files (Objectives 8+)
- Deployment configuration (Objective 2 — environment strategy)
- Observability tooling (Objective 3)

---

## 3. Locked Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Monorepo tool | Turborepo + pnpm workspaces | Caching, parallel tasks, low overhead, scales to teams |
| Package manager | pnpm (pinned via `packageManager` field) | Fast, disk-efficient, strict by default, cross-platform |
| Node runtime | Node 22 LTS | Current LTS, native fetch, modern features, supported on Linux and Windows |
| Language | TypeScript 5.x with `strict: true` | Type safety is non-negotiable |
| Linter | ESLint 9 (flat config) | Industry standard, flat config is the future |
| Formatter | Prettier | Removes formatting from code review |
| Result handling | `neverthrow` | Result type for typed errors at port boundaries |
| Schema validation | `zod` | Runtime validation; works in Node and the browser |
| Git hooks | Husky + lint-staged | Block bad commits at the developer's machine |
| Commit format | Conventional Commits via commitlint | Enables automated changelog later |
| CI provider | GitHub Actions | Free for public repos, integrates with branch protection |
| Dependency updates | Renovate | More configurable than Dependabot |
| Editor config | `.editorconfig` + recommended VS Code extensions | Consistent across editors |
| Cross-platform shell scripts | None — use `tsx`-based Node scripts | Bash and PowerShell scripts diverge; Node runs everywhere |
| Boundary enforcement | `dependency-cruiser` | Industrial-strength boundary checks; ESLint can't reliably do cross-package |
| License | AGPL-3.0 | Locked from prior turns; protects against hyperscaler resale |
| CLA tool | CLA Assistant (https://cla-assistant.io) | Free, GitHub-native, standard practice |

---

## 4. Repository Structure

```
platform/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml              # Required PR checks
│   │   ├── pr-title.yml        # Conventional commit on PR title
│   │   ├── boundaries.yml      # dependency-cruiser checks
│   │   └── stale.yml           # Optional: stale PR/issue cleanup
│   ├── CLA.md                  # The Contributor License Agreement
│   ├── CODEOWNERS              # Empty for solo, populated later
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── ISSUE_TEMPLATE/
│       ├── bug_report.md
│       └── feature_request.md
├── .husky/
│   ├── pre-commit              # Runs lint-staged + boundary check on staged
│   ├── commit-msg              # Runs commitlint
│   └── pre-push                # Runs typecheck on workspace
├── .vscode/
│   ├── settings.json           # Format on save, ESLint integration
│   └── extensions.json         # Recommended extensions
├── apps/
│   ├── web/                    # Next.js app — placeholder for later objectives
│   │   ├── package.json
│   │   └── README.md
│   └── worker/                 # AI worker — placeholder for Objective 11
│       ├── package.json
│       └── README.md
├── packages/
│   ├── config/                 # Shared TS, ESLint, Prettier configs
│   │   ├── package.json
│   │   ├── tsconfig.base.json
│   │   ├── tsconfig.app.json
│   │   ├── tsconfig.lib.json
│   │   ├── eslint.config.mjs
│   │   ├── prettier.config.mjs
│   │   └── README.md
│   ├── shared/                 # Pure TS utilities, types, errors
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── result/         # neverthrow re-exports + helpers
│   │   │   ├── errors/         # base error classes
│   │   │   └── platform/       # cross-platform helpers (paths, etc.)
│   │   └── README.md
│   ├── ports/                  # Hexagonal ports — interfaces only (Objective 1.5)
│   │   ├── persistence/        # placeholder, populated in Objective 1.5
│   │   ├── identity/
│   │   ├── storage/
│   │   ├── communication/
│   │   ├── eventing/
│   │   ├── search/
│   │   ├── ai/
│   │   ├── jobs/
│   │   ├── observability/
│   │   ├── audit/
│   │   └── config/
│   ├── adapters/               # Port implementations (Objective 1.5+)
│   │   └── (one folder per adapter, populated incrementally)
│   ├── composition/            # DI container, wires adapters to ports
│   │   ├── package.json
│   │   └── README.md
│   ├── core/                   # Domain + service layer (later objectives)
│   │   ├── package.json
│   │   └── README.md
│   ├── ui/                     # Shared UI components (later objectives)
│   │   ├── package.json
│   │   └── README.md
│   └── observability/          # Structured logging, metrics, tracing (Objective 3)
│       ├── package.json
│       └── README.md
├── docs/
│   ├── adr/
│   │   ├── 0000-template.md
│   │   └── 0001-monorepo-and-tooling.md
│   ├── architecture/
│   │   └── README.md
│   ├── contracts/              # Port contracts from Objective 1.5
│   │   └── README.md
│   ├── runbooks/
│   │   └── README.md
│   └── glossary.md
├── scripts/
│   ├── check-workspace.mts     # Sanity checks across all packages
│   ├── check-boundaries.mts    # Wraps dependency-cruiser
│   ├── new-package.mts         # Generator for new packages
│   └── verify-clean-tree.mts   # Used by pre-push to ensure no untracked artifacts
├── .editorconfig
├── .gitignore
├── .gitattributes
├── .nvmrc                      # Node version pin
├── .npmrc                      # pnpm settings
├── .prettierignore
├── .renovaterc.json
├── .dependency-cruiser.cjs     # Boundary rules
├── commitlint.config.mjs
├── lint-staged.config.mjs
├── package.json                # Root, with shared scripts
├── pnpm-workspace.yaml
├── tsconfig.json               # Root, references all packages
├── turbo.json
├── README.md
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── LICENSE                     # AGPL-3.0
├── NOTICE                      # Attribution and copyright
└── SECURITY.md
```

---

## 5. Component Specifications

### 5.1 Root `package.json`

**Purpose:** Define workspace, scripts, and tool versions.

**Required fields:**
- `"name": "platform"` (root, private)
- `"private": true`
- `"packageManager": "pnpm@<exact-version>"` — pin the pnpm version
- `"engines": { "node": ">=22.0.0", "pnpm": ">=9.0.0" }`
- Scripts: `dev`, `build`, `lint`, `format`, `format:check`, `typecheck`, `test`, `test:watch`, `boundaries`, `clean`, `new-package`, `prepare`

**Devdependencies (root only):**
- `turbo`
- `typescript`
- `prettier`
- `husky`
- `lint-staged`
- `@commitlint/cli`, `@commitlint/config-conventional`
- `dependency-cruiser`
- `tsx` — runs Node scripts written in TypeScript without separate compilation
- `gitleaks` (via npx, not as a JS dep)

**Rule:** Application or runtime dependencies never live at the root. Only tooling.

### 5.2 `pnpm-workspace.yaml`

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "packages/ports/*"
  - "packages/adapters/*"
```

### 5.3 `.npmrc`

```
strict-peer-dependencies=true
auto-install-peers=false
shamefully-hoist=false
engine-strict=true
```

These settings catch dependency mistakes early and refuse installs on wrong Node versions.

### 5.4 `.nvmrc`

A single line with the exact Node version (e.g., `22.11.0`). Used by `nvm`, `fnm`, Volta, and CI.

### 5.5 `turbo.json`

Pipeline definition. Initial tasks:

- `build` — depends on upstream `^build`, outputs `dist/**` and `.next/**`
- `lint` — no dependencies, no outputs
- `typecheck` — depends on upstream `^build` (for declaration files)
- `test` — depends on `^build`
- `boundaries` — depends on nothing, runs dependency-cruiser
- `dev` — `cache: false`, `persistent: true`

Define `globalDependencies` for files that invalidate the cache: `tsconfig.base.json`, `eslint.config.mjs`, `pnpm-lock.yaml`, `.dependency-cruiser.cjs`.

### 5.6 `packages/config`

Shared configuration package. All other packages depend on it.

**`tsconfig.base.json` — strictness:**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "allowUnusedLabels": false,
    "allowUnreachableCode": false,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

**`tsconfig.app.json`:** extends base, adds DOM lib, JSX settings for Next.js.

**`tsconfig.lib.json`:** extends base, adds `declaration: true`, `composite: true` for project references.

**`eslint.config.mjs` — flat config with multiple layered presets:**

- `@typescript-eslint/recommended-type-checked` (the type-aware variant)
- `@typescript-eslint/strict-type-checked`
- Import sorting (`eslint-plugin-perfectionist`)
- Unused imports flagged as errors
- Promise plugin for async correctness
- Security plugin (`eslint-plugin-security`)
- Custom rules:
  - `no-console: error` (forces use of logger from Objective 3)
  - `no-restricted-imports`:
    - Block `process.env` access outside `packages/config/src/env/`
    - Block any import from `@platform/adapters/*` outside `packages/composition/`
    - Block any import of driver libraries (`pg`, `mssql`, `mongodb`, `aws-sdk`, etc.) outside the relevant adapter packages
  - `@typescript-eslint/no-floating-promises: error`
  - `@typescript-eslint/no-misused-promises: error`
  - `@typescript-eslint/consistent-type-imports: error`

**`prettier.config.mjs`:**
- 100-char line width
- Single quotes
- Trailing commas: `all`
- Semicolons
- Arrow parens: `always`
- `endOfLine: 'lf'` — even on Windows checkouts; Git's autocrlf is disabled (see `.gitattributes`)
- Override for Markdown to allow longer lines

### 5.7 `packages/shared`

Foundation utilities. Contains:

**`result/index.ts`** — re-exports from `neverthrow` plus helpers:
```typescript
export { Result, ok, err, ResultAsync } from 'neverthrow';

/** Wrap a promise that may throw into a ResultAsync. */
export function safeAsync<T, E = Error>(
  promise: Promise<T>,
  errorMapper?: (e: unknown) => E,
): ResultAsync<T, E> { /* ... */ }
```

**`errors/index.ts`** — base error classes future packages extend:
- `class AppError extends Error` (abstract base, includes `code`, `statusCode`, `cause`)
- `class ValidationError extends AppError`
- `class NotFoundError extends AppError`
- `class UnauthorizedError extends AppError`
- `class ForbiddenError extends AppError`
- `class ConflictError extends AppError`
- `class ExternalServiceError extends AppError`
- `class NotSupportedError extends AppError` — for capability mismatches
- `class TimeoutError extends AppError`

**`platform/paths.ts`** — cross-platform path utilities:
- Always use `node:path` (built-in) for joining
- `toPosix(p: string)` — normalizes Windows backslashes for storage keys, URLs, etc.
- `fromPosix(p: string)` — converts back to platform-native for filesystem operations
- `isAbsolute(p: string)` — wraps `path.isAbsolute` correctly for cross-platform behavior

**`platform/process.ts`** — cross-platform process utilities:
- `spawnCommand(cmd: string, args: string[])` — handles Windows `.cmd` shim resolution; on Windows, npm/pnpm/etc. need `shell: true` or `.cmd` extensions
- Exit code handling consistent across platforms

**`index.ts`** — re-exports

These utilities exist now even though they have few users yet — getting them right early prevents a thousand cross-platform bugs.

### 5.8 Husky Hooks

**`.husky/pre-commit`:**
```sh
pnpm lint-staged
pnpm boundaries:staged
```

**`.husky/commit-msg`:**
```sh
pnpm exec commitlint --edit "$1"
```

**`.husky/pre-push`:**
```sh
pnpm typecheck
pnpm verify-clean-tree
```

Pre-commit is fast (only changed files). Pre-push catches type errors before they reach CI.

**Cross-platform note:** Husky hooks are shell scripts. Git for Windows ships with Bash via Git Bash, so these scripts run on Windows too. Avoid GNU-specific flags (`sed -i`, etc.). Stick to POSIX shell features.

### 5.9 `lint-staged.config.mjs`

```javascript
export default {
  '*.{ts,tsx,mts,cts,mjs,cjs,js,jsx}': [
    'eslint --fix --max-warnings=0',
    'prettier --write',
  ],
  '*.{json,md,yml,yaml}': ['prettier --write'],
};
```

`--max-warnings=0` ensures warnings cannot accumulate.

### 5.10 `commitlint.config.mjs`

Use `@commitlint/config-conventional`. Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`. Subject must be present, lowercase, no period at end, max 72 chars.

### 5.11 GitHub Actions CI (`.github/workflows/ci.yml`)

Runs on every PR and on pushes to `main`.

**Jobs:**

1. **install** — single source of truth for installs, output cached
   - Checkout
   - Setup Node from `.nvmrc`
   - Setup pnpm with cache enabled
   - `pnpm install --frozen-lockfile`

2. **format-check** — `pnpm format:check`
3. **lint** — `pnpm lint`
4. **typecheck** — `pnpm typecheck`
5. **boundaries** — `pnpm boundaries` (dependency-cruiser checks)
6. **test** — `pnpm test`
7. **build** — `pnpm build`
8. **gitleaks** — secret scanning on the diff

**Matrix:** Linux only at this stage. **Windows runner added later** when first Windows-specific code appears (in Objective 2 at the latest); the architecture supports it but the cost of a 2x CI matrix isn't justified yet. Documented as a planned addition.

**Concurrency:** cancel previous runs on the same PR when new commits land.

**Caching:**
- pnpm store cache (keyed on `pnpm-lock.yaml`)
- Turbo cache directory cached between runs

**Required checks for branch protection:** `format-check`, `lint`, `typecheck`, `boundaries`, `test`, `build`, `gitleaks`.

### 5.12 PR Title Workflow (`.github/workflows/pr-title.yml`)

Validates that the PR title follows Conventional Commits using `amannn/action-semantic-pull-request`. Squash-merges then produce clean commit messages on `main`.

### 5.13 Boundaries Workflow (`.github/workflows/boundaries.yml`)

Standalone workflow that runs dependency-cruiser with detailed output. Optionally generates a dependency graph image as a PR artifact for review.

### 5.14 `.dependency-cruiser.cjs` — Boundary Rules

This is what enforces the hexagonal architecture mechanically.

```javascript
module.exports = {
  forbidden: [
    {
      name: 'no-port-imports-adapter',
      severity: 'error',
      from: { path: '^packages/ports/' },
      to: { path: '^packages/adapters/' },
      comment: 'Ports must not depend on adapters; that inverts the dependency direction',
    },
    {
      name: 'no-application-imports-adapter',
      severity: 'error',
      from: {
        path: '^(apps|packages/(core|ui|composition))/',
        pathNot: [
          '^packages/composition/',     // composition is allowed
        ],
      },
      to: { path: '^packages/adapters/' },
      comment: 'Only the composition root may import adapters',
    },
    {
      name: 'no-port-imports-driver',
      severity: 'error',
      from: { path: '^packages/ports/' },
      to: {
        dependencyTypes: ['npm'],
        path: '^(pg|mssql|mongodb|@prisma/client|drizzle-orm|aws-sdk|@aws-sdk/|@azure/storage-blob|nodemailer|@sendgrid/mail)$',
      },
      comment: 'Ports must not depend on driver libraries directly',
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      severity: 'warn',
      from: { orphan: true, pathNot: ['\\.d\\.ts$', '(^|/)\\.', '\\.config\\.(js|cjs|mjs)$'] },
      to: {},
    },
  ],
  options: {
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
    progress: { type: 'cli-feedback' },
  },
};
```

These rules are enforced in CI and pre-commit. They make accidental architecture violations impossible.

### 5.15 Branch Protection (Configured in GitHub UI, Documented Here)

On `main`:
- Require PRs (no direct pushes)
- Require approvals: 1 (or set up CODEOWNERS later)
- Dismiss stale reviews on new commits
- Require status checks: format-check, lint, typecheck, boundaries, test, build, gitleaks, CLA
- Require branches up to date before merge
- Require conversation resolution
- Require linear history (squash or rebase, no merge commits)
- Restrict force-pushes
- Restrict deletions

Document in `docs/runbooks/branch-protection.md`.

### 5.16 Renovate (`.renovaterc.json`)

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": [
    "config:recommended",
    ":semanticCommits",
    ":dependencyDashboard",
    ":maintainLockFilesWeekly"
  ],
  "schedule": ["before 9am on monday"],
  "rangeStrategy": "bump",
  "packageRules": [
    {
      "matchUpdateTypes": ["patch", "minor"],
      "matchCurrentVersion": "!/^0/",
      "automerge": false
    },
    {
      "matchPackagePatterns": ["^@types/"],
      "groupName": "type definitions"
    },
    {
      "matchDepTypes": ["devDependencies"],
      "matchUpdateTypes": ["patch", "minor"],
      "groupName": "devDependencies (non-major)"
    }
  ],
  "lockFileMaintenance": { "enabled": true, "schedule": ["before 9am on monday"] }
}
```

No automerge. Every dependency update gets reviewed.

### 5.17 Editor Config (`.editorconfig`)

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

[*.{cmd,bat,ps1}]
end_of_line = crlf

[*.md]
trim_trailing_whitespace = false
```

The exception for `.cmd`, `.bat`, and `.ps1` exists because Windows tools sometimes refuse LF line endings on those files. The platform avoids these file types entirely (cross-platform Node scripts only), but the rule is here for safety.

### 5.18 VS Code (`.vscode/settings.json`)

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "eslint.useFlatConfig": true,
  "eslint.workingDirectories": [{ "pattern": "./packages/*" }, { "pattern": "./apps/*" }],
  "files.eol": "\n"
}
```

`.vscode/extensions.json` recommends Prettier, ESLint, EditorConfig, dependency-cruiser, Turbo Console Log (optional).

### 5.19 `.gitignore`

Standard Node + Next.js + Turbo ignores. Plus:
- `.env*` (except `.env.example`)
- `.turbo/`
- `coverage/`
- `*.log`
- `.DS_Store`
- `Thumbs.db`
- `desktop.ini`

### 5.20 `.gitattributes`

Critical for cross-platform consistency.

```
* text=auto eol=lf

# Force binary handling for these
*.png binary
*.jpg binary
*.jpeg binary
*.gif binary
*.ico binary
*.pdf binary

# Lockfiles diff readably but not interactively merged
pnpm-lock.yaml -diff
package-lock.json -diff

# Keep CRLF for Windows-only files
*.cmd text eol=crlf
*.bat text eol=crlf
*.ps1 text eol=crlf
```

This forces LF line endings everywhere except where Windows requires CRLF, regardless of `core.autocrlf` settings on developer machines.

### 5.21 CLA Setup

**`.github/CLA.md`** — the agreement contributors sign. Use the [Apache Individual CLA template](https://www.apache.org/licenses/contributor-agreements.html) as a starting point, modified to:

- Reference the project name and AGPL-3.0 license
- Reserve the right to dual-license under other terms (the dual-licensing reservation)
- Include the standard warranty and non-infringement clauses

**The substantive clauses:**

```
1. Definitions. "You" (or "Your") shall mean the copyright owner ...

2. Grant of Copyright License. You hereby grant to Project Owner and to recipients of software distributed by Project Owner a perpetual, worldwide, non-exclusive, no-charge, royalty-free, irrevocable copyright license to reproduce, prepare derivative works of, publicly display, publicly perform, sublicense, and distribute Your Contributions and such derivative works.

3. Grant of Patent License. ... (standard patent grant)

4. Relicensing. You agree that Project Owner may license Your Contribution under additional terms, including but not limited to commercial licenses, in addition to the terms under which the Contribution was originally provided. This includes the right to dual-license the project as a whole.

5. You represent that you are legally entitled to grant the above license ...

6. You represent that each of Your Contributions is Your original creation ...

7. ... (warranty disclaimers, governing law, etc.)
```

**Strongly recommended:** have an open-source-aware lawyer review the final CLA text before merging it to `main`. Plenty of templates exist; the lawyer review costs little and prevents enforceability problems later.

**CLA Assistant configuration:**

Create a `.clabot` configuration file or use the GitHub App's web UI to:
- Point at the CLA document URL (raw GitHub link to `.github/CLA.md`)
- Require signatures on every PR
- Allow the project owner (you) to be auto-signed
- Block PR merges from contributors who haven't signed

**Status check:** the CLA Assistant adds a required status check called `CLA` or similar. Add it to branch protection's required checks list.

For solo development today, you're the only contributor. The CLA infrastructure exists but is invisible until someone else opens a PR.

### 5.22 Workspace Sanity Check (`scripts/check-workspace.mts`)

A TypeScript script (run via `tsx`) that verifies invariants:

- Every `package.json` has `name`, `version`, `private` (where applicable), `type: "module"`
- Every package has a `README.md`
- No package depends on another via relative path (must use workspace protocol `workspace:*`)
- TypeScript project references are consistent
- Port packages don't depend on adapter packages (cross-check with dependency-cruiser)
- Adapter packages declare which port they implement (in their package.json `keywords` or a custom field)
- Conformance test suite presence: every adapter has a test file that imports the conformance suite from its corresponding port

Add as a CI job. If violated, build fails.

### 5.23 `scripts/new-package.mts`

A generator for new packages. Prompts for:

- Package type: port, adapter, app, internal lib
- Package name (validated)
- For adapter: which port does it implement?

Creates the standard package skeleton (package.json, tsconfig, README, src/index.ts, tests directory) tailored to the package type. Updates the root tsconfig project references. Runs `pnpm install` to wire it into the workspace.

This script removes friction from following the conventions. Without it, future-you will eventually shortcut and create a malformed package.

### 5.24 Documentation Files

**`README.md`:**
- One-paragraph project description
- Status (alpha, foundation in progress)
- Quickstart: prerequisites, install, dev, test
- Links to architecture overview, ADRs, and CONTRIBUTING

**`CONTRIBUTING.md`:**
- The CLA requirement and how it's enforced
- Branching strategy: `main` is protected, work on feature branches, conventional commits, PR required
- How to run locally (Linux, macOS, Windows)
- How to add a new package (use the generator script)
- How to write an ADR
- How to add an adapter (will reference Objective 1.5's contract documents once written)
- Definition of Done checklist

**`SECURITY.md`:**
- How to report vulnerabilities
- Disclosure timeline
- PGP key (optional)

**`CODE_OF_CONDUCT.md`:**
- Standard Contributor Covenant 2.1

**`LICENSE`:** Full AGPL-3.0 text

**`NOTICE`:** Copyright notice and attributions for any incorporated third-party code

**`docs/adr/0000-template.md`:** ADR template (see Section 7).

**`docs/adr/0001-monorepo-and-tooling.md`:** Documents every locked decision from Section 3.

**`docs/glossary.md`:** Stub. Will accumulate platform terms.

---

## 6. Implementation Order

Build top-down, verifying each step:

1. Initialize empty repo, add `.gitignore`, `.gitattributes`, `.editorconfig`, `.nvmrc`, `.npmrc`, `LICENSE` (full AGPL-3.0), `NOTICE`, `CODE_OF_CONDUCT.md`, `SECURITY.md`
2. Initialize root `package.json` with `packageManager`, `engines`, basic scripts (no-ops at first)
3. Add `pnpm-workspace.yaml`
4. Create `packages/config` with TS, ESLint, Prettier configs. This is the keystone.
5. Create `packages/shared` with `Result`, error classes, platform helpers
6. Create stub `apps/web`, `apps/worker`, `packages/composition`, `packages/core`, `packages/ui`, `packages/observability` — each with package.json, README, src/index.ts
7. Create `packages/ports/` with placeholder folders for the 11 port categories from Objective 1.5 (each gets a stub package.json and README; full content comes in Objective 1.5)
8. Create `packages/adapters/` directory (empty for now)
9. Set up Turborepo (`turbo.json`)
10. Set up dependency-cruiser (`.dependency-cruiser.cjs`)
11. Wire up Husky, lint-staged, commitlint
12. Write `scripts/check-workspace.mts`, `scripts/new-package.mts`, `scripts/check-boundaries.mts`, `scripts/verify-clean-tree.mts`
13. Create CI workflows (ci, pr-title, boundaries)
14. Create PR template, issue templates, CODEOWNERS
15. Write `.github/CLA.md` (review with a lawyer before going public)
16. Configure CLA Assistant (web UI; account with admin rights to the GitHub repo needed)
17. Configure branch protection in GitHub
18. Add Renovate config and enable in GitHub
19. Run the workspace sanity script, fix any violations
20. Run dependency-cruiser, ensure baseline is clean
21. Write ADR-0001 capturing all locked decisions
22. Update README and CONTRIBUTING with current state
23. Verify Definition of Done (Section 9)

---

## 7. ADR Template (`docs/adr/0000-template.md`)

```markdown
# ADR-XXXX: [Title]

**Status:** [Proposed | Accepted | Superseded by ADR-YYYY | Deprecated]
**Date:** YYYY-MM-DD
**Deciders:** [names or "solo"]

## Context

What is the issue we're trying to solve? What constraints exist? What forces are at play?

## Decision

What is the change we're making?

## Consequences

### Positive
- ...

### Negative
- ...

### Neutral
- ...

## Alternatives Considered

### Option A: [Name]
Pros, cons, why not chosen.

### Option B: [Name]
Pros, cons, why not chosen.

## References

- Links to related ADRs, RFCs, articles, prior art.
```

---

## 8. Verification Steps

Before declaring this objective done, run through this checklist manually:

1. **Fresh clone test (Linux):** delete `node_modules`, run `pnpm install`, then `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm boundaries`. All succeed. Total time under 30 minutes from a true cold start.

2. **Fresh clone test (Windows):** same as above on Windows 10 or 11. All succeed. Document any platform-specific notes in CONTRIBUTING.md.

3. **Bad commit test:** introduce an obvious type error in `packages/shared/src/index.ts`. Try to commit. Pre-commit hook catches it. Force a bypass with `--no-verify`. Push. CI catches it. Cannot merge.

4. **Bad commit message test:** try `git commit -m "fixed it"`. commit-msg hook rejects it.

5. **Force push test:** try to force-push to `main`. Branch protection rejects it.

6. **Direct push test:** try to push to `main` without a PR. Branch protection rejects it.

7. **Boundary violation test:** in a temporary branch, add an import from `packages/ports/persistence` to `packages/adapters/anything`. Run `pnpm boundaries`. Fails. Try to commit. Pre-commit blocks. Try to push past commit. CI blocks.

8. **CLA test:** open a PR from a different GitHub account that hasn't signed the CLA. The CLA Assistant comments and blocks merge. Sign. Merge becomes possible.

9. **CI cache test:** make a no-op change, push, observe that CI uses cached installs and Turbo cache. Build time on a no-op is significantly faster.

10. **Renovate test:** wait for Renovate's first run (or trigger manually). Verify it opens PRs for outdated dependencies and the dependency dashboard issue exists.

11. **Workspace sanity test:** intentionally break an invariant (remove a README from a package). Run `pnpm check-workspace`. Fails. Restore. Passes.

12. **New package generator test:** run `pnpm new-package`, generate a port and an adapter for it. Verify the adapter package correctly references the port and runs the conformance test suite (stubbed).

13. **Onboarding test:** if possible, have someone unfamiliar try to set up the repo from the README on a fresh machine. Time how long. Note friction. Fix the README.

If all 13 pass, the objective is met.

---

## 9. Definition of Done

**Code & Configuration**
- [ ] All files in Section 4 exist and are populated correctly
- [ ] All locked decisions in Section 3 are implemented
- [ ] TypeScript strict mode is on, no exceptions, no `any`, no suppressed errors
- [ ] ESLint passes with `--max-warnings=0`
- [ ] Prettier check passes on all files
- [ ] dependency-cruiser passes with the rules in Section 5.14
- [ ] `.gitattributes` enforces LF line endings; verified by checking out on Windows and Linux

**Quality Gates**
- [ ] Husky hooks installed and verified working (manually triggered each)
- [ ] CI runs on PR, all eight jobs pass on a clean branch
- [ ] Branch protection rules are configured on `main`
- [ ] PR title validation works (test by opening a PR with a bad title)
- [ ] Workspace sanity script passes and is in CI
- [ ] Boundary check is required for merge

**Tooling**
- [ ] pnpm version is pinned and enforced
- [ ] Node version is pinned via `.nvmrc` and enforced via `engines`
- [ ] Renovate is enabled and has produced its dependency dashboard issue
- [ ] VS Code workspace settings work (format on save, ESLint integration)
- [ ] `pnpm new-package` generator works for ports, adapters, apps, libs

**Cross-Platform**
- [ ] Repo clones, installs, and runs on Linux
- [ ] Repo clones, installs, and runs on Windows (Git Bash + Node + pnpm)
- [ ] All scripts in `scripts/` are TypeScript run via `tsx`, no shell scripts beyond Husky hooks
- [ ] Husky hooks work on both platforms

**CLA**
- [ ] `.github/CLA.md` is committed (lawyer-reviewed before public release)
- [ ] CLA Assistant is configured and required for merge
- [ ] CLA status check is in branch protection's required checks
- [ ] CONTRIBUTING.md documents the CLA requirement

**Documentation**
- [ ] `README.md` is current, complete, and tested by a fresh clone
- [ ] `CONTRIBUTING.md` covers branching, commits, PRs, ADRs, DoD, CLA
- [ ] `SECURITY.md` exists with a working contact
- [ ] `LICENSE` is AGPL-3.0
- [ ] `NOTICE` exists
- [ ] `CODE_OF_CONDUCT.md` exists
- [ ] ADR template exists at `docs/adr/0000-template.md`
- [ ] ADR-0001 is written, captures all decisions in Section 3, is `Accepted`
- [ ] `docs/glossary.md` exists (can be near-empty, but exists)
- [ ] `docs/contracts/README.md` exists as a placeholder for Objective 1.5's contracts

**Verification**
- [ ] All 13 verification steps in Section 8 pass
- [ ] A fresh clone to running dev environment takes under 30 minutes
- [ ] Total CI time on a typical PR is under 7 minutes (slightly higher than original target due to boundary checks)

**Operational**
- [ ] No secrets in the repo (verified via gitleaks scan in CI)
- [ ] `.env.example` exists if any env vars are referenced (will be empty until Objective 2)
- [ ] Branch protection prevents the maintainer from accidentally pushing to main

---

## 10. Anti-Patterns to Refuse

- **Skipping the strict TS settings to get something compiling.** Fix the type or write a typed wrapper.
- **Disabling an ESLint rule globally to silence a warning.** Fix the violation, or disable per-line with a comment explaining why, or open a discussion if the rule itself is wrong for the project.
- **Adding a runtime dependency at the root.** Runtime deps belong in the package that uses them.
- **Putting application code in `packages/shared`.** `packages/shared` is for utilities and types with no business semantics.
- **Pushing directly to `main`.** Even for "trivial" changes. The discipline is the point.
- **Skipping the ADR because "it's obvious."** Future-you will thank present-you.
- **Letting CI be slow because "it works."** CI runs on every push. Slow CI poisons the development loop.
- **Allowing warnings to accumulate.** `--max-warnings=0`. Warnings are errors.
- **Writing a shell script when a Node script would do.** Shell scripts diverge across platforms; Node scripts run everywhere.
- **Bypassing dependency-cruiser to "just get this working."** The boundaries exist for a reason. If a check is failing, the architecture is being violated.
- **Skipping the CLA setup because you're solo today.** Once an outside contribution lands without a CLA, dual-licensing is permanently impossible for those lines.
- **Relying on `core.autocrlf` to fix line endings.** The `.gitattributes` file is authoritative; autocrlf is unreliable.

---

## 11. What Comes Next

Objective 1 produces the substrate. The next objective is **Objective 1.5: Abstraction Architecture** — populating the port packages with actual interfaces, contract documents, and conformance test infrastructure. After that, **Objective 2: Environment Strategy** lands — fully self-hosted on Afrihost, no Vercel, with the database driver selected via environment variable.

---

*This document is the contract. Every checkbox in Section 9 must be true before moving on.*
