# Development Plan

*The day-one-actionable sequencing across all 30 objectives. This document answers: "what do I do on Monday morning?" and "what comes next?" and "how do I know when I'm done with a phase?"*

**Audience:** You (the solo engineer building this) and Claude Code (your primary collaborator). Future contributors who want to understand the build sequence.

**Status:** Authoritative for sequencing. When this document and an objective disagree on what's IN the objective, the objective wins. When they disagree on WHEN to do it, this document wins.

---

## How to Read This Document

This is not a project management spreadsheet. It's a sequencing guide grounded in the realities of:

- One person doing the work, with Claude Code as collaborator
- Multi-year timeline (5 years for the full vision)
- Quality over velocity (no slop)
- Revenue-enabling milestones along the way (Phase 1 ships at month ~30)

The plan has four phases mapped to the master plan's roadmap. Each phase has milestones. Each milestone is a meaningful, demonstrable, often shippable unit of work. Most milestones span 2-6 weeks of solo work.

You will deviate from this plan. That's fine. The plan exists to:

1. Make Monday's work obvious
2. Surface dependencies so you don't paint into corners
3. Mark "ship-able" points so revenue can flow earlier
4. Prevent rabbit holes (when something takes 3x longer than planned, that's a signal, not just bad luck)

Re-read this document at the start of each phase. Update it when reality diverges.

---

## Pre-Phase 0: Setup Week

**Duration:** ~1 week
**Goal:** A repository exists. Tooling works. CI runs. You can ship a "Hello World" through the full pipeline.

This is not part of the official Phase 0; it's the prep that makes Phase 0 possible.

### Day 1: Provisioning

- Provision the Afrihost VPS (Objective 2's specs: 8GB RAM, 4 vCPU, 100GB disk, Ubuntu 24.04 LTS)
- Set up SSH access; disable password login; configure UFW firewall
- Install Coolify on the VPS
- Configure the domain DNS to point at the VPS
- Install Caddy via Coolify; verify HTTPS works

You don't deploy anything yet. You verify the platform's home is ready.

### Day 2: Repository Bootstrap

- Create the GitHub repository (private initially; AGPL public when first release ships)
- Configure CLA Assistant integration (preserves dual-licensing optionality)
- Initial commit: `LICENSE` (AGPL-3.0), `README.md`, `master-plan.md`, `objectives/` folder, `design-guides/` folder, `AGENTS.md`, `CLAUDE.md`
- Tag: `v0.0.0-prepared` (the repo exists, no code yet)

### Day 3: Tooling Bootstrap (Begin Objective 1)

- Initialize `pnpm` workspaces; configure `pnpm-workspace.yaml`
- Initialize Turborepo; configure `turbo.json`
- Install root TypeScript, ESLint, Prettier with strict configs
- Configure `dependency-cruiser` with the boundary rules from Objective 1.5
- Set up the monorepo's package layout per `AGENTS.md`'s repository structure

### Day 4-5: First CI Pipeline

- GitHub Actions workflow: typecheck, lint, test on every PR
- Branch protection: `main` requires PR review (you reviewing your own work via Claude Code's planning + your approval)
- Initial empty packages: `packages/core`, `packages/ports/persistence` (just port stubs, no implementation)
- Verify CI runs and passes on a trivial change

### Weekend: Take a break

You've just spent a week on infrastructure. Phase 0 is multi-month work. Sustainable pace from day one.

---

## Phase 0: Foundation (Months 1-15)

**Duration:** 12-18 months at solo full-time pace
**Goal:** A foundation reviewable by an enterprise security team. No customer-facing features yet.

This is the long phase. It cannot be skipped, cannot be parallelized meaningfully, cannot be hand-waved. The Quality Gates objective (10) has nine acceptance criteria including external pentest, chaos drills, and cross-platform conformance — none of which can be skipped.

The Foundation is what makes the platform credible. Everything later builds on it.

### Phase 0 Milestones

```
M0.1  Repository, tooling, abstraction architecture        (Months 1-2)
M0.2  Environment, observability                            (Month 3)
M0.3  Postgres adapter (reference implementation)           (Months 4-5)
M0.4  MSSQL adapter                                         (Month 6)
M0.5  Mongo adapter                                         (Month 7)
M0.6  Cross-database conformance + change streams           (Months 8)
M0.7  Identity, auth, user directory                        (Months 9-10)
M0.8  Multi-tenancy, RBAC, approval routing                 (Month 11)
M0.9  Audit, compliance                                     (Month 12)
M0.10 Service layer architecture (canonicalization)         (Month 13)
M0.11 Cross-platform runtime (Windows)                      (Month 14)
M0.12 Quality gates                                         (Month 15)
```

These milestones map roughly to objectives 1-10. The exact monthly mapping is aspirational; expect ±2 months variance per milestone.

### M0.1: Repository, Tooling, Abstraction Architecture (Months 1-2)

**Implements:** Objectives 1, 1.5

**What to build:**

Week 1-2:
- Complete Objective 1's tooling (Turborepo, pnpm, TypeScript strict, ESLint, Prettier)
- Set up `dependency-cruiser` rules for hexagonal boundaries
- Configure CI to enforce all of the above on every PR
- Write `docs/adr/template.md` and the first few ADRs (the decision to use Turborepo, the decision on TypeScript strict, etc.)

Week 3-6:
- Implement Objective 1.5's port definitions (no implementations yet — just `interface` files in `packages/ports/`)
- Persistence port, identity port, storage port, communication port, eventing port, search port, AI port, jobs port, observability port, audit port, config port, secret store port
- Filter AST type definitions
- `Result<T, E>` integration via `neverthrow`
- Conformance test infrastructure (the harness that future adapters will run against)

Week 7-8:
- `apps/api/` and `apps/web/` skeleton (Fastify backend, Vite + React frontend)
- Health endpoints
- Basic structured logging (Pino) wired up
- A "Hello World" deployment to the Afrihost VPS via Coolify

**Definition of Done for M0.1:**

- All 12 ports defined with TypeScript interfaces; conformance test harness exists
- `dependency-cruiser` enforces boundaries; CI fails on violations
- A trivial change can be made, tested locally, pushed to GitHub, reviewed in CI, merged, and deployed to the VPS
- ADRs 0001-0010 written and Accepted (these document foundational choices)
- The first `CLAUDE.md` files exist in each package

**What you'll learn:** how Turborepo handles dependency graphs, what the actual cost of strict TypeScript is, how Coolify's deployment flow works, where Claude Code is most useful and where it isn't.

**Common pitfalls:**

- Spending too much time on tooling before building real things. Set a timebox; if you're at week 3 and still wrestling with `dependency-cruiser`, accept the current configuration and move on.
- Writing ports that are too specific (a "PostgresPersistencePort" defeats the abstraction). Keep ports general; let adapters specialize.
- Skipping the conformance test infrastructure. It's tedious to build before you have adapters, but adding it later means retrofitting all adapters. Build it now.

### M0.2: Environment, Observability (Month 3)

**Implements:** Objectives 2, 3

**What to build:**

- Three Docker Compose stacks per Objective 2: dev (active), staging (dormant), prod (dormant)
- Coolify configuration for each stack
- Caddy reverse proxy with the right routing rules
- Restic backup setup; first backup runs to Backblaze B2; restore-from-backup verified
- OTel collector configured; Grafana + Loki + Tempo + Prometheus running on the VPS
- GlitchTip for error tracking
- Pino logger wired into the API; logs flowing to Loki via OTel
- Dashboards for: API request rate/latency, error rate, deployment events
- SLOs defined (99.5% availability, p95 < 500ms) with alerting

**Definition of Done for M0.2:**

- A request to the API is observable end-to-end (request log → trace → metrics)
- An error in the API surfaces in GlitchTip
- A Restic backup can be restored on a test VPS within 4 hours (RTO target)
- Dashboards exist for the SLOs
- Runbooks written for: backup-restore, observability outage, deployment failure
- ADRs 0011-0015 written

**What you'll learn:** OTel configuration is finicky; Grafana dashboards take longer than expected; backup-restore drills surface real bugs.

**Common pitfalls:**

- Skipping the actual restore drill. Backups that you've never restored aren't backups. Run the drill once at this milestone; once again every six months as a habit.
- Over-instrumenting. Don't add 50 metrics on day one. Add the SLO metrics; add more as needs emerge.

### M0.3: Postgres Adapter (Months 4-5)

**Implements:** Objective 4 (Postgres reference implementation)

This is the longest single objective in Phase 0. The Postgres adapter is the reference implementation; MSSQL and Mongo adapters mirror its shape. Get this right.

**What to build:**

Week 1-2:
- Drizzle integration inside the adapter package
- Connection pooling via PgBouncer
- UUID v7 generation strategy
- Optimistic locking (`_version` column convention)
- Soft delete (`deleted_at` column convention)
- Migration framework

Week 3-4:
- CRUD operations through the persistence port
- Filter AST → SQL translation
- Cursor-based pagination
- Bulk operations (insert/update/delete)
- Transaction handling

Week 5-6:
- pgvector integration for vector search
- Full-text search
- Conformance test suite passes

Week 7-8:
- Performance benchmarks via mitata
- Documentation (`packages/adapter-postgres/CLAUDE.md`)
- ADRs for non-obvious decisions

**Definition of Done for M0.3:**

- The conformance test suite passes for the Postgres adapter
- Benchmarks establish baseline performance (queries/sec, p95 latency for CRUD ops)
- Migration framework can apply and roll back schema changes
- Vector search works end-to-end
- The `packages/adapter-postgres/CLAUDE.md` documents the patterns
- ADRs 0016-0028 written

**What you'll learn:** Drizzle's API has rough edges; PgBouncer's transaction-mode pooling has surprising interactions; pgvector indexing strategies matter more than expected.

**Common pitfalls:**

- Skipping the conformance test infrastructure (which you built in M0.1). The conformance tests are the discipline that ensures MSSQL and Mongo can match Postgres's behavior.
- Optimizing performance before correctness. Get it right; benchmark it; then optimize the slow parts.

### M0.4: MSSQL Adapter (Month 6)

**Implements:** Objective 4a

**What to build:**

- node-mssql / Tedious driver integration
- T-SQL filter AST translator
- Capability flag: `arrays: false` (force junction tables instead)
- Vector search via Azure AI Search OR Qdrant sidecar (decide; document in ADR)
- All conformance tests pass

**Definition of Done for M0.4:**

- Conformance test suite passes for MSSQL adapter
- Capability matrix updated to reflect MSSQL's specific limitations and workarounds
- Performance benchmarked against Postgres baseline
- ADRs 0029-0035 written

**What you'll learn:** T-SQL has surprising differences from PostgreSQL even for "standard SQL" operations; node-mssql's connection lifecycle differs from pg's.

### M0.5: MongoDB Adapter (Month 7)

**Implements:** Objective 4b

**What to build:**

- Native MongoDB driver integration
- Filter AST → MongoDB query translation (significantly different shape than SQL)
- JSON Schema validators for collection-level constraints
- UUID v7 stored as BSON Binary subtype 4
- Advisory FKs (validated on writes by the platform; not enforced by Mongo)
- Replica set requirement documented

**Definition of Done for M0.5:**

- Conformance test suite passes for MongoDB adapter
- Capability matrix updated to reflect Mongo's document-oriented differences
- Performance benchmarked
- ADRs 0036-0041 written

**What you'll learn:** Mapping relational concepts to documents is genuinely different mental work; the test suite designed for SQL semantics needs careful adaptation for Mongo.

### M0.6: Cross-Database Conformance + Change Streams (Month 8)

**Implements:** Objectives 4c, 4d

**What to build:**

- CI matrix that runs all conformance tests against all three adapters on every PR
- Property-based tests using `fast-check` for invariants across adapters
- Capability matrix auto-generated from test results
- Change stream port (`ChangeEvent` discriminated union)
- Postgres logical replication adapter for change streams
- MSSQL CDC adapter for change streams
- Mongo `watch()` adapter for change streams

**Definition of Done for M0.6:**

- CI runs all three conformance test suites on every PR
- A change in Postgres surfaces as a `ChangeEvent`; same for MSSQL and Mongo
- The capability matrix is published as an artifact (probably JSON; rendered in docs)
- ADRs 0042-0051 written

**What you'll learn:** Change streams have very different operational characteristics across databases; logical replication is heavyweight on Postgres; CDC has setup costs on MSSQL.

**This milestone unlocks Phase 1.** Once cross-database conformance is solid, you can build features against the persistence port confident they work everywhere.

### M0.7: Identity, Auth, User Directory (Months 9-10)

**Implements:** Objective 5

**What to build:**

Week 1-3:
- `UserDirectoryPort` with built-in adapter
- Built-in auth: argon2id password hashing, TOTP MFA, magic link, OAuth providers (Google, GitHub, Microsoft, Apple)
- Session management
- API key issuance (HMAC-signed)

Week 4-5:
- `IdentityProviderPort` with adapters
- Microsoft Entra ID adapter
- Generic OIDC adapter
- SAML adapter

Week 6-8:
- Integration tests across all combinations
- Security review (internal: threat model, common vulnerabilities, defense-in-depth check)
- Documentation

**Definition of Done for M0.7:**

- A user can sign up with email + password, set up MFA, sign in
- A user can sign in via Google OAuth
- A workspace can be configured to use Entra ID; a user from that org can sign in via Entra
- Conformance tests cover all identity providers
- Security checklist completed
- ADRs 0052-0059 written

**What you'll learn:** SAML is a swamp; Entra ID's tenant model has surprising edge cases; OAuth providers have small but breaking API differences.

### M0.8: Multi-Tenancy, RBAC, Approval Routing (Month 11)

**Implements:** Objective 6

**What to build:**

- Service-layer authorization model
- Workspace-scoped query injection (services automatically scope queries)
- Permission cache with p99 < 1ms cached hit
- Configurable approval routing engine
  - Modes: `any_of`, `all_of`, `any_n` 
  - Approver types: `by_role`, `by_user`, `by_group`
- Default role definitions: workspace_owner, workspace_admin, business_analyst, architect, developer, qa, reviewer, viewer
- Audit log integration

**Definition of Done for M0.8:**

- A service method correctly authorizes via `authz.check()`
- A workspace's data is invisible to users in other workspaces (verified by tests, not just expected)
- Approval routing can be configured for arbitrary stages with arbitrary approver lists
- Permission checks are fast under load
- ADRs 0060-0067 written

### M0.9: Audit, Compliance (Month 12)

**Implements:** Objective 7

**What to build:**

- Hash-chained audit log (SHA-256, per-workspace chains)
- Append-only database permissions for the audit table
- Personal data registry as code
- GDPR access export
- GDPR erasure (with explicit handling of audit log retention vs. erasure conflict)
- SOC 2 / GDPR / HIPAA control matrices
- 7-year retention default

**Definition of Done for M0.9:**

- Every meaningful action emits an audit event
- Audit chain integrity verifiable via stored hashes
- A user can request their data export; an admin can fulfill it
- A user can request erasure; the platform handles it correctly (with audit retention exceptions documented)
- ADRs 0068-0075 written

**What you'll learn:** GDPR erasure has genuine conflicts with audit retention; the platform's policy must be explicit and defensible.

### M0.10: Service Layer Architecture (Month 13)

**Implements:** Objective 8

**What to build:**

- Refactor existing services to follow the canonical shape: validate → authorize → precondition → execute → audit → return
- `RequestContext` vs `SystemContext` distinction
- `Result<T, AppError>` pattern enforced via lint rule
- `observable()` wrapper for tracing/metrics
- Idempotency table for replayable operations

**Definition of Done for M0.10:**

- Every service method follows the canonical shape
- Lint rule catches deviations
- Idempotency works for the operations that need it (especially anything mutating)
- ADRs 0076-0082 written

**This is partly retrofit work.** Earlier milestones produced services; this milestone canonicalizes them. The cost is real; the payoff is uniformity that future work depends on.

### M0.11: Cross-Platform Runtime (Month 14)

**Implements:** Objective 9

**What to build:**

- Windows Server 2019/2022 deployment path
- `node-windows` integration for service management
- IIS via ARR + URL Rewrite (NOT iisnode)
- `identity-windows-integrated` adapter (Active Directory)
- `secret-azure-keyvault` adapter
- Azure DevOps pipeline templates
- CI matrix: Linux primary, Windows focused subset on PR, Windows nightly full

**Definition of Done for M0.11:**

- The full platform deploys to a Windows Server VM and works
- Cross-platform tests pass in CI
- Windows-specific adapters tested
- Documentation: how to deploy on Windows
- ADRs 0083-0088 written

**What you'll learn:** Windows Node.js has surprising differences (path separators, line endings, file locking, signal handling); IIS configuration is its own world.

**This is a significant cost.** Three databases × Windows support is the platform's main differentiator. Don't compromise.

### M0.12: Quality Gates (Month 15)

**Implements:** Objective 10

**What to build:**

The nine quality gates from Objective 10:

1. **Load test** (k6) — verify the platform handles target load
2. **Internal pentest** (OWASP ASVS L2) — internally driven security review
3. **Chaos drills** (13 scenarios) — kill the database, lose network, fill disk, etc.
4. **Accessibility** (WCAG 2.2 AA) — automated checks pass
5. **Backup/DR drill** — restore from backup; verify RTO < 4h, RPO < 1h
6. **Cross-DB final** — conformance suite passes consistently
7. **Cross-platform final** — Linux + Windows both work
8. **Documentation** — minimum viable docs exist
9. **Compliance posture** — control matrices reviewed

**Definition of Done for M0.12:**

- All 9 quality gates passed
- A formal "Phase 0 complete" entry in the journal
- Open issues for any deferred items
- ADRs 0089-0092 written

**This milestone closes Phase 0.** When it's done, the foundation is ready. Phase 1 work can begin.

### Phase 0 Reality Check

**At the end of Phase 0:**

- The platform has no customer-facing features
- It has a foundation a security team can review
- 92 ADRs document key decisions
- ~50,000+ lines of code (foundation is heavy)
- ~12-18 months of work
- 0 customers, 0 revenue

**Is this acceptable?** That depends on your situation. The user has agreed to this approach (the master plan acknowledges 5 years total, with revenue from Phase 1 onward).

**Warning signs that Phase 0 is going wrong:**

- A milestone takes 2x its estimated duration. Pause; figure out why; consider whether the objective itself needs revision.
- You're building things not in any objective. Stop; ask whether they're needed; consider deferring.
- You're skipping conformance tests "to move faster." This is the most expensive form of "moving faster" — you'll pay it back with interest.
- You're avoiding Windows work. Don't. Microsoft houses are the platform's main enterprise market; Windows support isn't optional.

---

## Phase 1: Data Management Module (Months 16-27)

**Duration:** 9-12 months at solo full-time pace
**Goal:** A sellable product. By the end, customers can install the platform, define schemas, get auto-generated APIs, browse data, and build apps via the SDK.

This is the first revenue-enabling phase. Even if Phase 2 and 3 take years, Phase 1 alone is a viable product.

### Phase 1 Milestones

```
M1.1  Schema Designer foundation                          (Months 16-17)
M1.2  Auto-generated REST APIs                             (Month 18)
M1.3  Auto-generated GraphQL APIs                          (Month 19)
M1.4  Real-time subscriptions                              (Month 20)
M1.5  Storage browser and file management                  (Months 21)
M1.6  Auth & user management UI                            (Month 22)
M1.7  Query console                                         (Month 23)
M1.8  Data browser and editor                              (Months 24-25)
M1.9  Public SDK                                            (Months 26-27)
```

### M1.1: Schema Designer Foundation (Months 16-17)

**Implements:** Objective 11

The Schema Designer is the core surface of the Data Management Module. Most of the rest of Phase 1 depends on it being solid.

**What to build:**

- The Schema Designer's three views: Diagram (xyflow), Table, Code (Monaco)
- Schema editing with validation
- Edit-validate-preview-apply flow
- Capability-aware UX (hide features the workspace's database doesn't support)
- PII tagging on columns
- Per-workspace database namespaces (`cust_<workspace_id>` schema in Postgres, equivalent on others)
- Five starter templates (CRM, blog, dashboard, internal tool, customer portal)

**Definition of Done for M1.1:**

- A user can design a schema visually, see it in three views, save and apply migrations
- The migration system actually creates the tables in the workspace's database
- Schema validation catches obvious errors (reserved words, length limits, type mismatches)
- Templates load correctly
- Storybook stories exist for all major components
- ADRs 0093-0097 written

### M1.2: Auto-Generated REST APIs (Month 18)

**Implements:** Objective 12

**What to build:**

- Wildcard Fastify routes that resolve schemas at request time
- Per-workspace repository factory
- CRUD + filter (Filter AST as `?filter[field][op]=value`)
- Cursor-based pagination
- Bulk operations
- RFC 7807 error format
- API key authentication (HMAC-signed)
- OpenAPI 3.1 spec generated on demand

**Definition of Done for M1.2:**

- A workspace's schema produces working REST APIs at known URLs
- The OpenAPI spec is downloadable
- API keys can be issued, scoped, revoked
- ADRs 0098-0104 written

### M1.3: Auto-Generated GraphQL APIs (Month 19)

**Implements:** Objective 13

**What to build:**

- Pothos code-first schema generation
- graphql-yoga server
- DataLoader integration (mandatory for relations)
- Tagged union mutation results
- Depth limit (10) and complexity budget (1000)
- Persisted queries (opt-in)

**Definition of Done for M1.3:**

- A workspace's schema produces a working GraphQL endpoint
- Queries with relations don't N+1
- Mutations return tagged unions for clear error handling
- ADRs 0105-0111 written

### M1.4: Real-Time Subscriptions (Month 20)

**Implements:** Objective 14

**What to build:**

- graphql-ws over WebSocket (primary transport)
- SSE over HTTP (fallback transport)
- Per-event permission checks
- Per-row permission filter
- PII redaction in events
- Bounded buffer (1000 events) with gap events
- Resume window (5 minutes)
- In-process fan-out + sticky sessions for multi-instance
- Target: 1000 concurrent connections, 100 events/second

**Definition of Done for M1.4:**

- A subscription receives events in real-time
- Connection drops are recoverable within the resume window
- Permissions are checked on every event (not just at subscribe time)
- Performance targets met under load
- ADRs 0112-0118 written

### M1.5: Storage Browser and File Management (Month 21)

**Implements:** Objective 15

**What to build:**

- Logical bucket → folder → file model over flat storage
- Two-layer metadata (file metadata + storage backend metadata)
- tus.io for resumable uploads (mandatory for files > 5MB)
- Per-workspace credentials
- Proxied revocable signed URLs (default)
- Quota with reconciliation
- B2, Azure Blob, MinIO adapters

**Definition of Done for M1.5:**

- A user can upload a 1GB file and resume after a network interruption
- File access respects workspace permissions
- Quotas are enforced; reconciliation catches drift
- ADRs 0119-0125 written

### M1.6: Auth & User Management UI (Month 22)

**Implements:** Objective 16

**What to build:**

- Customer-facing screens for Objective 5's auth (sign-in, MFA, account, workspace members)
- Per-workspace branding
- MJML email templates
- CAPTCHA via hCaptcha or Turnstile (NOT reCAPTCHA — privacy)
- Localization scaffolding (English first; structure for translations later)
- First-run setup with provisioning token

**Definition of Done for M1.6:**

- A user can sign up, configure MFA, sign in
- Workspace admins can invite members, manage roles
- Auth emails render correctly across major clients
- ADRs 0126-0131 written

### M1.7: Query Console (Month 23)

**Implements:** Objective 17

**What to build:**

- SQL/Mongo console (Monaco)
- Read-only by default
- `query.write` opt-in permission
- AST parsing (pg-query-emscripten or node-sql-parser) + per-workspace database roles
- Defense-in-depth: AST refuses dangerous queries; database roles fail dangerous queries even if AST is bypassed
- DDL hard-refused

**Definition of Done for M1.7:**

- A user can run SELECT queries against their workspace
- A user without `query.write` cannot run INSERT/UPDATE/DELETE
- DDL never works (CREATE/ALTER/DROP fail)
- ADRs 0132-0137 written

### M1.8: Data Browser and Editor (Months 24-25)

**Implements:** Objective 18

The data browser is the most-used surface in the Data Management Module. Optimize for productivity.

**What to build:**

- TanStack Table v8 + Virtual
- Spreadsheet-style grid with inline editing
- Optimistic updates with conflict resolution
- FK batched lookup (combobox in cells)
- File/image/video cells with previews
- Two-phase CSV import (preview → commit, 100k row cap)
- Saved views
- Filter and sort with URL state

**Definition of Done for M1.8:**

- A user can browse, sort, filter, and edit data in real-time
- Concurrent edits surface as conflicts; the UI handles them
- CSV import handles realistic file sizes
- Saved views persist per user
- ADRs 0138-0143 written

### M1.9: Public SDK (Months 26-27)

**Implements:** Objective 19

**What to build:**

- TypeScript-first SDK (`@platform-name/sdk`)
- Type generation via CLI: `pdm sync-types`
- Native promises (not Result types — convention for external APIs)
- Cross-runtime adapter (browser, Node, Deno, Bun, React Native, Workers)
- Tree-shakeable; <30KB core bundle
- Auto idempotency
- tus.io for storage uploads
- Multiplexed WebSocket realtime
- React integration (`@platform-name/sdk-react`)
- Vue integration (`@platform-name/sdk-vue`)
- Telemetry off by default
- CDN distribution
- CLI commands: `pdm init`, `pdm login`, `pdm sync-types`, `pdm watch`, `pdm dump-schema`, `pdm push-schema`

**Definition of Done for M1.9:**

- An external developer can `npm install @platform-name/sdk`, `pdm init`, and start building
- The SDK works in browser, Node, and Deno
- Types are generated correctly from any schema
- React hooks work with TanStack Query
- ADRs 0144-0150 written

### Phase 1 Reality Check

**At the end of Phase 1:**

- The Data Management Module is sellable
- A customer can install the platform, point it at MSSQL, and have working REST + GraphQL + Realtime APIs in under an hour
- 150 ADRs document decisions
- Total elapsed: ~24-27 months
- Time to consider: pricing, packaging, first customers

**Phase 1 enables revenue.** This is a real inflection point. You can:

1. Continue solo to Phase 2 (recommended path per master plan)
2. Hire help with the revenue from Phase 1
3. Pause Phase 2 and focus on Phase 1 customer acquisition

The master plan recommends option 1 with vigilance. Track customer feedback; let it inform Phase 2 priorities.

**Warning signs:**

- The Schema Designer is too complex for users to grok. If real customers struggle, simplify before continuing.
- Performance issues at customer scale. The conformance benchmarks established a baseline; customer load may differ.
- Cross-database parity is shakier than expected. Conformance tests pass but real workloads expose differences. Address before continuing.

---

## Phase 2: AI Pipeline Foundation + Stages 1-4 (Months 28-39)

**Duration:** 9-12 months at solo full-time pace
**Goal:** The AI build pipeline's upstream stages work. A user can describe an app and get an Intent Brief, PRD, design tokens, and schema. Schema lands in the Schema Designer from Phase 1; the two halves converge.

### Phase 2 Milestones

```
M2.1  AI Pipeline Foundation                                (Months 28-29)
M2.2  Stage 1: Intent Capture                              (Month 30)
M2.3  Stage 2: PRD Generation                              (Months 31-32)
M2.4  Stage 3: Design Tokens                                (Month 33-34)
M2.5  Stage 4: Schema Synthesis                             (Months 35-36)
M2.6  Phase 2 quality bar (cross-stage integration, regen flows, prompt quality)  (Months 37-39)
```

The "Phase 2 quality bar" milestone (M2.6) is intentional. Building stages individually is one thing; making them work together with regeneration, staleness detection, and consistent quality is another. Budget time for it.

### M2.1: AI Pipeline Foundation (Months 28-29)

**Implements:** Objective 20

**What to build:**

- `AIProviderPort` (Anthropic primary; OpenAI/Azure/Bedrock/Ollama/vLLM as adapters)
- Prompts as code via `definePrompt` (versioned, tested, reviewable)
- Artifact model with stable IDs, versioning, lifecycle (draft → awaiting_approval → approved → archived)
- Reasoning as non-optional metadata
- `defineTool` for typed, audited AI tools
- PII redaction mandatory by default
- Per-workspace token budgets ($50/month default)
- 24-hour cache TTL
- Streaming end-to-end
- Provider failover
- Quality signals tracking

**Definition of Done for M2.1:**

- A test prompt can be authored, tested, and called
- Provider failover works when primary fails
- Reasoning is captured for every artifact
- Token budgets are enforced
- ADRs 0151-0158 written

### M2.2: Stage 1 — Intent Capture (Month 30)

**Implements:** Objective 21

**What to build:**

- Intent Brief schema (locked: 10 fields)
- Orchestrator + sub-prompts (extract_goals, identify_users, clarify_scope, surface_assumptions, detect_gaps, finalize_brief)
- Brief preview panel (empty → tentative → confident states)
- Read-only AI tools (no schema changes from this stage)
- Templates as starter conversations
- Multi-session resume (auto-save, 30-day expiration)
- Reasoning visible
- Cost target: $0.10–$0.50 per brief

**Definition of Done for M2.2:**

- A user can have a 5-25 turn conversation; an Intent Brief is generated
- The brief preview updates as the conversation progresses
- Multi-session resume works
- Templates load correctly
- ADRs 0159-0164 written

### M2.3: Stage 2 — PRD Generation (Months 31-32)

**Implements:** Objective 22

**What to build:**

- 10 locked sections (per Objective 22)
- Per-section generation with dependency graph
- Section-level approval routing
- Cross-section consistency check
- Traceability (every requirement traces back to intent fields)
- Acceptance criteria in Gherkin format
- Staleness detection on intent changes
- Cost target: $1-$5 per PRD

**Definition of Done for M2.3:**

- A PRD generates from an approved Intent Brief
- Each section can be reviewed and approved independently
- Inconsistency detection catches issues
- Staleness detection works when the Intent Brief is updated
- ADRs 0165-0171 written

### M2.4: Stage 3 — Design Tokens (Months 33-34)

**Implements:** Objective 23

**What to build:**

- OKLCH color system
- Light + dark themes generated together
- WCAG AA enforced during generation (not after)
- DTCG format canonical
- System fonts default + Google Fonts opt-in
- Locked token shape (colors, typography, spacing, sizing, border-radius, shadows, motion, z-index, breakpoints)
- 4 export formats (CSS, Tailwind, JSON-DTCG, TypeScript)
- Live preview UI as primary UX
- Per-category regeneration
- Cost target: $0.50-$2.00

**Definition of Done for M2.4:**

- A user can generate design tokens from brand inputs + PRD
- Tokens pass WCAG AA in light and dark
- All four export formats produce correct output
- Live preview renders accurately
- ADRs 0172-0177 written

### M2.5: Stage 4 — Schema Synthesis (Months 35-36)

**Implements:** Objective 24

This stage is where the AI pipeline meets the Data Management Module. The output IS Objective 11's `CustomerSchema` model.

**What to build:**

- Output: `CustomerSchema` (Objective 11's model)
- Database-aware generation (Postgres arrays, MSSQL junctions, Mongo embedded)
- PII detection (heuristic + AI + user confirmation)
- FK inference
- Conservative index strategy (PKs + FKs + filterable/sortable from PRD)
- Diff-based for existing schemas (additive only by default)
- Coverage validation as warnings
- Reasoning per table/column
- Reuses Schema Designer UI surface
- Cost target: $0.50-$3.00

**Definition of Done for M2.5:**

- A schema synthesizes from a PRD; it lands in the Schema Designer
- The user reviews and approves through the existing Schema Designer UI
- Approved schemas deploy via the existing migration pipeline
- ADRs 0178-0183 written

### M2.6: Phase 2 Quality Bar (Months 37-39)

**Implements:** Quality across all of Phase 2

Three months of quality work. This is the "make it real" milestone.

**What to build:**

- Regeneration flows tested for every stage
- Staleness detection working across stage transitions
- Quality signals dashboards
- Cost tracking per workspace
- End-to-end test: a user signs up, generates intent → PRD → tokens → schema, deploys schema, the data plane works
- Documentation: customer-facing guides for each stage
- Performance optimization where measured

**Definition of Done for M2.6:**

- A complete end-to-end pipeline runs from intent to schema
- Quality signals show acceptable regeneration rates
- Cost is on target across stages
- Documentation enables a customer to use the pipeline without support

### Phase 2 Reality Check

**At the end of Phase 2:**

- The AI pipeline does upstream work
- Customers can describe an app, get a structured intent + PRD + design tokens + schema
- Schema lands in the Schema Designer (Phase 1 connects with Phase 2)
- 183 ADRs document decisions
- Total elapsed: ~36-39 months
- Phase 1 customers may upgrade; new customers attracted by the AI pipeline

**Decision point:** Phase 3 builds the actual app generation (UI, code, tests, deploy, maintain). It's the most ambitious work. Validate Phase 2 with real customers before committing.

---

## Phase 3: AI Pipeline Stages 5-10 (Months 40-57)

**Duration:** 12-18 months at solo full-time pace
**Goal:** The full pipeline. Customers describe apps; deploy them; maintain them. The platform delivers the master plan's full vision.

### Phase 3 Milestones

```
M3.1  Stage 5: Data Migration                              (Months 40-42)
M3.2  Stage 6: UI Generation                               (Months 43-46)
M3.3  Stage 7: Code Generation                             (Months 47-50)
M3.4  Stage 8: Test Generation                             (Months 51-53)
M3.5  Stage 9: Deployment                                  (Months 54-55)
M3.6  Stage 10: Maintenance & Evolution                    (Months 56-57)
```

Phase 3 milestones are larger than Phase 2 milestones. UI Generation (M3.2) and Code Generation (M3.3) are particularly heavy — months of work each.

### M3.1: Stage 5 — Data Migration (Months 40-42)

**Implements:** Objective 25

This is the optional stage. Greenfield projects skip it entirely.

**What to build:**

- 7 source types (Postgres, MSSQL, MySQL, Mongo, CSV, JSON, Excel)
- Read-only source credentials always
- Streamed extraction
- Migration plan as artifact
- 30+ built-in transformation library + sandboxed JS expressions
- Mandatory pre-migration snapshot (24-hour retention default)
- Three tolerance modes (fail-on-first, fail-on-batch, continue-with-error-log)
- Mandatory post-migration validation
- Rollback within window

**Definition of Done for M3.1:**

- A customer can migrate from Postgres → Postgres
- A customer can migrate from MSSQL → Postgres (cross-database)
- A customer can migrate from CSV → any target
- Visual mapping canvas works
- ADRs 0184-0190 written

### M3.2: Stage 6 — UI Generation (Months 43-46)

**Implements:** Objective 26

The single largest milestone in the project. Four months for UI generation is realistic; three would be aggressive; two is impossible.

**What to build:**

- React + Vite + Tailwind + shadcn/ui + TypeScript
- Per-component generation (not whole-app)
- IA extraction as separate artifact
- Standard CRUD per entity
- Workflow components for non-CRUD user stories
- Permission-aware (always check before edit/delete)
- Real-time integration where PRD specifies
- axe-core validation during generation (WCAG 2.2 AA non-negotiable)
- Live preview via sandboxed iframe with schema-aware mock data
- Storybook stories co-generated
- Cost target: $5-$30 per project

**Definition of Done for M3.2:**

- A user can review a generated UI per component
- Live preview renders correctly
- Generated code compiles, lints, passes axe-core
- Permission-aware components work
- ADRs 0191-0197 written

**This milestone is the platform's most visible work.** The customer's first reaction to a generated UI shapes their perception. Iterate on prompts aggressively; quality signals matter.

### M3.3: Stage 7 — Code Generation (Months 47-50)

**Implements:** Objective 27

Server-side code is the highest-risk surface. Sandboxing must be solid before this ships.

**What to build:**

- Function inventory FIRST (the discipline)
- Node 22 + TypeScript only
- Pure-function shape with injected context
- Sandboxed runtime (per Objective 10's security review)
- 30s timeout default, 256MB memory default, network allowlist
- Curated integration catalog (Stripe/SendGrid/Twilio/OAuth/webhook/S3)
- Static analyzer (no eval, no child_process, no raw fs/net)
- Permissions declared in manifest, verified by static analysis, enforced at invocation
- Versioning with single-action rollback
- Cost target: $1-$10

**Definition of Done for M3.3:**

- A customer can generate server functions; they deploy and run safely
- Sandbox isolation verified (cannot escape, cannot access other workspaces)
- Static analyzer catches unsafe patterns
- ADRs 0198-0204 written

### M3.4: Stage 8 — Test Generation (Months 51-53)

**Implements:** Objective 28

**What to build:**

- Vitest (unit/component) + Playwright (E2E)
- Test plan as separate artifact mapping AC → tests
- AC coverage as primary metric (line coverage secondary)
- 100% must-AC coverage required
- Schema-aware mock factories
- Mock servers for integration catalog
- Ephemeral test environments
- Coverage thresholds 80% line / 70% branch (configurable)
- Stale test detection on upstream artifact changes
- Flaky test tracking
- Cost target: $2-$15 per suite

**Definition of Done for M3.4:**

- A test suite generates from a PRD + UI + code
- Tests run in ephemeral environments
- AC coverage tracked
- Flaky tests detected and surfaced
- ADRs 0205-0211 written

### M3.5: Stage 9 — Deployment (Months 54-55)

**Implements:** Objective 29

**What to build:**

- Per-environment progression (dev → staging → prod)
- Approval gates per environment
- Tests required for staging+
- Schema migration coordinated with code (atomic where possible)
- Rolling default + blue/green opt-in per environment
- Health checks mandatory post-deploy
- One-action rollback within 7-day retention
- Notifications (Slack/Discord/email)
- Cross-platform (Linux + Windows)
- Plan generation cost: $0.50-$2.00

**Definition of Done for M3.5:**

- A customer's app deploys through environments
- Tests block production deploys when failing
- Rollback works within retention window
- Cross-platform deployment verified
- ADRs 0212-0218 written

### M3.6: Stage 10 — Maintenance & Evolution (Months 56-57)

**Implements:** Objective 30

**What to build:**

- Signal collection from production
- AI-assisted classification with human override
- Change request artifact
- Smallest-possible regeneration discipline
- Cascade detection via artifact graph
- Stage re-engagement using same patterns as initial generation
- Outcome tracking
- Dependency advisories surface but never auto-apply
- In-app bug report widget for customer apps
- Cost target: $0.10-$1.00 per change request

**Definition of Done for M3.6:**

- Production errors surface as signals; classification works
- Change requests trigger appropriate stage re-engagement
- Outcome tracking confirms whether fixes actually fix
- The pipeline closes its loop
- ADRs 0219-0225 written

### Phase 3 Reality Check

**At the end of Phase 3:**

- The full vision delivered
- 225 ADRs document decisions
- Total elapsed: ~57 months (~5 years)
- The platform is what the master plan described

**This is a long road.** Five years is the realistic outer bound. Several mitigations in the master plan: Phase 1 ships at month 27 enabling revenue; customer feedback shapes Phase 2 and 3 priorities; hiring with revenue compresses the timeline.

---

## Cross-Cutting Concerns

These don't fit neatly into a single milestone but matter throughout.

### Documentation

Document as you go. Per-package `CLAUDE.md` updates with each milestone. Customer-facing docs at the end of each milestone. Don't defer documentation to a "documentation week" — it doesn't happen.

### ADRs

Write ADRs as decisions happen, not after. The numbering is sequential across the repo (currently 92 ADRs at end of Phase 0; 150 at end of Phase 1; 183 at Phase 2; 225 at Phase 3 — these numbers come from the objectives' specifications).

### Performance

Don't optimize prematurely. Do measure. The conformance benchmarks (Objective 4c) establish baselines; subsequent work should track regressions.

The performance-sensitive surfaces (real-time, cursor pagination, permission cache) have explicit targets in their objectives. Hit those targets; ignore micro-optimization elsewhere.

### Security

Security review is part of Phase 0 (M0.12). Subsequent phases inherit the security posture but add new attack surfaces:

- Phase 1: API surface, authentication, authorization
- Phase 2: AI provider integration, prompt injection, token budgets
- Phase 3: Sandboxed code execution (the highest-risk surface)

Re-review security at the end of each phase. The first time the platform is publicly accessible (likely Phase 1), commission an external pentest.

### Customer Feedback

Phase 1 enables customers. From that point on, customer feedback should inform priorities. Track:

- Bug reports (per-objective)
- Feature requests (which objective do they extend?)
- Usage patterns (which surfaces are popular; which are ignored)
- Conversion (free → paid)
- Churn (and reasons)

Don't optimize for early customers' specific needs — that builds a product for them and not for the broader market. Do learn from patterns across customers.

### Hiring

The master plan acknowledges this is a 5-year solo project. If revenue from Phase 1 enables hiring, the natural roles to add:

1. **Frontend engineer** — to accelerate Phase 1 UI work (M1.6, M1.8) and Phase 3 UI generation (M3.2)
2. **Security engineer** — to lead Phase 0's M0.12 quality gates and Phase 3's M3.3 sandbox work
3. **Customer success / DX** — to handle Phase 1 customer onboarding and Phase 2/3 prompt iteration

Each hire compresses the timeline. The user has to decide when (and whether) to hire based on revenue runway and personal preference.

### Burnout

Five years solo on a multi-product platform is genuinely dangerous. Mitigations:

- **Sustainable pace** — 40-50 hour weeks, not 80
- **Mandatory time off** — at least one full week off per quarter; longer breaks at phase transitions
- **Phase 1 ship as inflection point** — celebrate; consider sabbatical before Phase 2; don't grind directly into the next phase
- **Customer feedback as motivation** — Phase 1 customers are real people using your work; that energy fuels Phase 2 and 3
- **The objectives are durable** — if you need to step back for months, the contracts in `objectives/` are still there when you return

---

## When to Update This Document

- **End of each milestone** — mark completion; note actual duration vs. estimated; capture learnings
- **End of each phase** — substantial review; possibly recalibrate subsequent phases
- **When an objective gets revised** — propagate the change here
- **When a new milestone emerges** — sometimes a "missing" milestone surfaces (like M2.6's "Phase 2 quality bar"); add it explicitly
- **When timeline reality diverges from estimate** — be honest; recalibrate

---

## Appendix: Daily / Weekly Patterns

**Daily:**

- Start by re-reading the current milestone's section in this document
- Check the relevant objective's Definition of Done; identify what's still open
- Plan the day's work in 2-4 hour blocks
- Push to GitHub at end of day (CI runs catches problems before tomorrow)

**Weekly:**

- Review milestone progress
- Update the milestone's "what's next" notes
- Run the full test suite (not just affected packages)
- Review open issues; close or defer

**Monthly:**

- Are you on track for the milestone? If 50% over estimate, pause and analyze.
- Are dependencies surprising you? Document them.
- Update CLAUDE.md files with patterns that have emerged
- Take a day off (intentional rest)

**Quarterly:**

- Phase-level review
- Update this development plan with reality
- Take at least a week off

---

*This plan supersedes any prior development plans. Revise as reality dictates. Trust the contract, but stay honest about what's working and what isn't.*

*Status: v1, written before Phase 0 begins. The hardest version of the plan; expect revisions as reality lands.*
