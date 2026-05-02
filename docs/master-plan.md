# The Platform

## Master Plan v3

_Updated to reflect Objectives 1–30. The 30 objective documents in `/objectives/` are the implementation contract; this document is the thesis and the roadmap._

---

## Thesis

Software development has split into two failing modes:

**Enterprise** has structure (BAs, devs, testers, stakeholders, planning) but the structure doesn't connect. Each role works in their own tool, their own document, their own meeting. Information crosses silos through meetings and Slack — lossy, slow, political. The structure exists but doesn't compound.

**Vibe coding** has no structure. AI generates plausible-looking code from prompts. It ships fast, looks great, falls apart at month three because there's no spec to refer back to, no schema discipline, no tests, no traceability.

Both audiences end up in the same place: software that nobody can confidently change.

**This platform is one system that runs the same pipeline for both.** Idea → requirements → design → schema → build → test → deploy → monitor. Same artifacts produced. Same AI doing the work. What varies is how many humans show up at the approval gates between stages.

A solo dev approves every gate themselves. An enterprise routes each gate to the appropriate role. Same pipeline, configurable routing.

Every AI artifact explains itself, so the platform raises the user's skill over time. A solo dev who uses this for a year has watched a senior BA, architect, and QA lead work hundreds of times. They become the kind of person who can walk into an enterprise role — or, more likely now, build their own enterprise-grade product without one.

---

## The Two Real Markets

**Enterprises** trying to ship without drowning in process. Microsoft houses with existing MSSQL infrastructure who can't adopt Postgres-only platforms. Banks, insurance companies, governments with audit and compliance requirements that consumer SaaS can't meet. The platform replaces their silo tools with one connected substrate. Roles still exist; their work compounds instead of dying in disconnected documents.

**Displaced and independent professionals** trying to build enterprise-grade software without enterprise resources. Domain experts laid off from corporate jobs. Solo devs who want their work to last. Small teams who can't hire a full SDLC organization. The platform gives them enterprise-grade output at solo speed.

The same product serves both, and the second group becomes the first as they grow.

---

## The Two Products on One Foundation

The platform delivers **two products** that share the same substrate:

### Product 1: The Data Management Module

A self-hosted Supabase equivalent working consistently across PostgreSQL, MSSQL, and MongoDB. Schema designer, auto-generated REST and GraphQL APIs, real-time subscriptions, storage with file management, auth/user management, query console, data browser, public TypeScript SDK. **Sellable on its own** — a customer who only wants "Supabase for MSSQL" can install this and stop here.

### Product 2: The AI Build Pipeline

The structured AI-assisted development loop: intent capture → PRD generation → design tokens → schema synthesis → data migration → UI generation → code generation → test generation → deployment → maintenance. The AI does the work; humans approve at gates; reasoning attached to every artifact teaches the user over time. **Differentiated** — Supabase doesn't have this; vibe-coding tools don't have the structure.

A customer can adopt either product, both, or progress from one to the other. The two share authentication, RBAC, audit, observability, and runtime infrastructure — building one means most of the other is already built.

---

## Core Architecture Principles

### One Pipeline, Configurable Approval Routing

Every gate in the AI pipeline has a configurable approver list. Solo workflows: project owner approves everything. Enterprise workflows: route by role — BA approves requirements, designer approves design tokens, architect approves schema, dev lead approves code, QA approves tests, ops approves deploy. The pipeline doesn't know or care which configuration is running. Specified in Objective 6.

### Reasoning Attached to Every AI Artifact

Every artifact the AI produces has structured reasoning: rationale, alternatives considered, assumptions made, uncertainties flagged, source artifacts referenced. Reasoning is non-optional metadata, not an afterthought. Three purposes: auditability, teaching, prompt iteration. Specified in Objective 20.

### Universal Entity Graph (Traceability)

Every artifact links to its parents and children. Intent → PRD section → user story → schema table → API endpoint → UI component → test case → deploy → incident. Trivially answerable: "why does this button exist?" or "what breaks if I change this column?" Specified across Objectives 11, 22 (PRD traceability fields), and 24 (schema traceability).

### Three Databases First-Class From Day One

The platform supports PostgreSQL, MSSQL, and MongoDB equivalently. Same APIs, same tools, same UI work for all three. Capability matrix surfaces honestly where databases differ (no array columns on MSSQL, advisory FKs on Mongo, etc.). Specified in Objectives 4, 4a, 4b, 4c. **The tradeoff is conscious**: roughly 3x the engineering cost of Postgres-only, but addresses a market segment Supabase fundamentally cannot.

### Cross-Platform Runtime (Linux + Windows)

Linux is primary; Windows Server is first-class, not an afterthought. Microsoft houses can deploy on the infrastructure they already operate. Specified in Objective 9.

### Self-Hosted by Default; No Vendor Lock-In

The platform installs on customer infrastructure. No SaaS dependency. AGPL-3.0 license; CLA Assistant preserves dual-licensing optionality. Customers own their data and their deployment.

### Skill Growth Layer (Cross-Cutting)

The platform tracks user behavior over time: which artifacts approved without modification, which modified, which rejected. Surfaces patterns. Becomes a teacher without being a tutor. Quality signals collected per stage feed prompt iteration. Specified across Objectives 20, 21, 22, etc.

---

## The 33 Objectives

The platform's specification is divided into 33 objectives (30 original + 3 added: 15.5, 26.5, 31), organized in three pillars.

> **About the additions.** As the prototype matured, three legitimate gaps surfaced that the original 30 objectives didn't cover: workspace-level brand assets and reference documents (15.5), app chrome configuration separated from per-page editing (26.5), and an auto-generated documentation site that exports standalone (31). They are additive — they do not contradict any existing objective.

### Foundation (Objectives 1–10) — 15 documents

Built first. Substrate everything else depends on. Each objective ends with a Definition of Done; foundation isn't "complete" until all 10 pass their gates.

| #    | Objective                      | What It Locks In                                                                                                                                                                  |
| ---- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01   | Repository & Tooling           | Turborepo + pnpm + TypeScript strict + dependency-cruiser boundary enforcement + AGPL-3.0 + CLA Assistant                                                                         |
| 01.5 | Abstraction Architecture       | All ports defined: persistence, identity, storage, communication, eventing, search, AI, jobs, observability, audit, config; Filter AST; neverthrow Result types                   |
| 02   | Environment Strategy           | Self-hosted on Afrihost (Linux Ubuntu 24.04); Coolify orchestrator; Caddy reverse proxy; three Docker Compose stacks; Restic→Backblaze B2 backups                                 |
| 03   | Observability Foundation       | OTel + Grafana/Loki/Tempo/Prometheus + GlitchTip self-hosted; Pino logger; tail-sampled traces; SLOs (99.5% avail, p95 <500ms)                                                    |
| 04   | Database — Postgres            | Drizzle inside adapter; PgBouncer; UUID v7; pgvector; optimistic locking; soft delete; reference implementation                                                                   |
| 04a  | Database — MSSQL               | node mssql/Tedious; T-SQL filter translator; capability flag for arrays; vector search via Azure AI Search/Qdrant                                                                 |
| 04b  | Database — MongoDB             | Native driver; JSON Schema validators; UUID v7 as BSON Binary subtype 4; advisory FKs; replica set required                                                                       |
| 04c  | Cross-Database Conformance     | CI matrix; fast-check property tests across adapters; mitata benchmarks with regression detection; capability matrix auto-generation                                              |
| 04d  | Change Streams                 | Postgres logical replication; MSSQL CDC; Mongo native watch(); ChangeEvent discriminated union                                                                                    |
| 05   | Identity, Auth, User Directory | UserDirectoryPort + IdentityProviderPort; built-in auth (argon2id, TOTP MFA, magic link, OAuth) + Entra ID + OIDC + SAML                                                          |
| 06   | Multi-Tenancy & RBAC           | Service-layer authorization; workspace-scoped query injection; configurable approval routing engine; permission cache p99 <1ms cached                                             |
| 07   | Audit & Compliance             | Hash-chained audit log (SHA-256, per-workspace chains); append-only DB permissions; personal data registry as code; GDPR access/erasure                                           |
| 08   | Service Layer Architecture     | Canonical method shape; RequestContext vs SystemContext; Result<T,AppError> never throws; observable() wrapper; idempotency table                                                 |
| 09   | Cross-Platform Runtime         | Windows Server 2019/2022; node-windows; IIS via ARR + URL Rewrite; identity-windows-integrated; secret-azure-keyvault; CI matrix                                                  |
| 10   | Quality Gates Before Stage One | Nine gates: load test, internal pentest (OWASP ASVS L2), chaos drills, accessibility WCAG 2.2 AA, backup/DR drill, cross-DB conformance, cross-platform, docs, compliance posture |

### Data Management Module (Objectives 11–19, including 15.5) — 10 documents

The Supabase-equivalent product. Sellable on its own.

| #        | Objective                                    | What It Delivers                                                                                                                                                                                                                 |
| -------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 11       | Data Management Foundation & Schema Designer | Visual schema designer (xyflow diagram + table + Monaco code views); edit-validate-preview-apply flow; capability-aware UX; PII tagging; per-workspace database namespaces                                                       |
| 12       | Auto-Generated REST APIs                     | Wildcard Fastify routes resolve schema at request time; CRUD + filter + cursor pagination + bulk ops; OpenAPI 3.1 generated on demand; API keys (HMAC); RFC 7807 errors                                                          |
| 13       | Auto-Generated GraphQL APIs                  | Pothos code-first schema; graphql-yoga; DataLoader mandatory; tagged union mutation results; depth limit + complexity budget; persisted queries opt-in                                                                           |
| 14       | Real-Time Subscriptions                      | Two transports: graphql-ws over WebSocket + SSE over HTTP; per-event permission checks; per-row permission filter; bounded buffer with gap events; resume window                                                                 |
| 15       | Storage Browser & File Management            | Logical bucket→folder→file model over flat storage; tus.io for resumable uploads; per-workspace credentials; revocable signed URLs; quota enforcement; PII tagging on files                                                      |
| **15.5** | **Workspace Assets and Documents**           | **Workspace-level brand assets (logos, colors, fonts, images, icons) + reference documents (voice, strategy, compliance, specs); declarative stage-to-asset bindings feed AI Pipeline; provenance tracking on every generation** |
| 16       | Auth & User Management UI                    | Customer-facing screens for Objective 5's auth (sign-in, MFA, account, workspace members); per-workspace branding; MJML email templates; CAPTCHA via hCaptcha/Turnstile                                                          |
| 17       | Query Console                                | SQL/Mongo console with safety rails; read-only by default; AST parsing + per-workspace database roles for defense-in-depth; DDL hard-refused                                                                                     |
| 18       | Data Browser & Editor                        | TanStack Table v8 + Virtual; spreadsheet-style grid with inline editing; optimistic updates with conflict resolution; FK batched lookup; CSV import/export; saved views                                                          |
| 19       | Public SDK                                   | TypeScript-first SDK (@platform-name/sdk); type generation via CLI sync-types; cross-runtime (browser/Node/Deno/Bun/RN/Workers); tree-shakeable; <30KB core; React + Vue integrations                                            |

### AI Build Pipeline (Objectives 20–31, including 26.5) — 13 documents

The differentiated product. The thing Supabase doesn't have.

| #        | Objective                                                | What It Delivers                                                                                                                                                                                                                                                                                                                         |
| -------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 20       | AI Pipeline Foundation                                   | AIProviderPort abstracting Anthropic/OpenAI/Azure/Bedrock/Ollama/vLLM; prompts as code (definePrompt); artifact model with stable IDs and versioning; reasoning as non-optional metadata; tool registry; PII redaction mandatory; per-workspace token budgets                                                                            |
| 21       | Stage 1: Intent Capture                                  | Bounded conversation (5-25 turns) producing structured Intent Brief; orchestrator + sub-prompts; templates as starter conversations; multi-session resume                                                                                                                                                                                |
| 22       | Stage 2: PRD Generation                                  | 10 locked sections; per-section generation; section-level approval; cross-section consistency check; traceability to intent; acceptance criteria in Gherkin format; consumes workspace voice/strategy docs (15.5)                                                                                                                        |
| 23       | Stage 3: Design Tokens                                   | OKLCH color system; light + dark themes generated together; WCAG AA enforced; DTCG format; live preview; export to CSS / Tailwind / JSON / TypeScript; consumes workspace logos/colors/fonts (15.5)                                                                                                                                      |
| 24       | Stage 4: Schema Synthesis                                | Database-aware generation; lands in Objective 11's Schema Designer; PII detection with user confirmation; FK inference; index recommendations; diff-based for existing schemas                                                                                                                                                           |
| 25       | Stage 5: Data Migration                                  | Optional stage; sources: Postgres/MSSQL/MySQL/Mongo/CSV/JSON/Excel; AI-assisted mapping with visual canvas; sandboxed JS for custom transforms; pre-migration snapshot; rollback                                                                                                                                                         |
| 26       | Stage 6: UI Generation                                   | React + Vite + Tailwind + shadcn/ui; per-component generation; **same canvas as Page Designer** (Stage 6 generates v1; Designer maintains thereafter with persistent ✦ Ask AI); permission-aware components; real-time integration; FK combobox; storage for file/image columns; accessibility validated; Storybook stories co-generated |
| **26.5** | **App Chrome (Header / Footer / Side Nav / Breadcrumb)** | **Configure chrome once per app, applied to every page; chrome blocks as a Blocks Library category; sidenav vs topnav-only layout; page-level overrides (no-chrome for /sign-in, /embed/\*); Designer renders chrome as locked regions**                                                                                                 |
| 27       | Stage 7: Code Generation                                 | Edge functions + scheduled jobs + event handlers + integration adapters; sandboxed Node runtime; static analysis; curated integration catalog (Stripe/SendGrid/Twilio/etc.); permission declarations enforced; consumes workspace compliance/specs docs (15.5)                                                                           |
| 28       | Stage 8: Test Generation                                 | Vitest + Playwright; test plan as separate artifact mapping AC → tests; AC coverage as primary metric; schema-aware mock factories; ephemeral test environments                                                                                                                                                                          |
| 29       | Stage 9: Deployment                                      | Per-environment progression (dev → staging → prod); approval gates; tests required for staging+; rolling default + blue/green opt-in; one-click rollback; health checks mandatory                                                                                                                                                        |
| 30       | Stage 10: Maintenance & Evolution                        | Signal collection from production; AI-assisted classification; change request artifacts; smallest-possible regeneration; cascade detection; outcome tracking; dependency advisories; **Designer is the maintenance editor** with same-canvas continuity from Stage 6                                                                     |
| **31**   | **Auto-Generated Documentation Site**                    | **fumadocs-style two-surface model: in-platform live (continuously updated) + standalone export (point-in-time Next.js + fumadocs project); auto-generated from PRD/schema/REST/GraphQL/components/deploys; standalone exports phone home telemetry to platform logs/advisors/metrics; brand-styled from workspace assets (15.5)**       |

---

## Tech Stack (Locked)

The stack is intentionally more complex than v1's "start simple" approach. The complexity buys market reach (three databases × two operating systems = customer segments other platforms can't address).

### Core

- **Language**: TypeScript strict everywhere
- **Build**: Turborepo + pnpm
- **Architecture**: Hexagonal (ports + adapters); dependency-cruiser enforces boundaries
- **Result handling**: neverthrow `Result<T, E>` internally; native Promises in the public SDK

### Databases (Three Adapters)

- **Postgres**: Drizzle ORM inside the adapter (not exposed); PgBouncer; pgvector
- **MSSQL**: node mssql/Tedious; vector search via Azure AI Search or Qdrant sidecar
- **MongoDB**: native driver; replica set required even in dev

### Frontend (Platform UI + Generated Apps)

- **React 19 + Vite + TypeScript**
- **shadcn/ui as base components**
- **Tailwind CSS** configured with design tokens
- **TanStack Query** for server state; **TanStack Table v8 + Virtual** for grids
- **Monaco** for code editors; **xyflow** for diagrams
- **react-hook-form + zod** for forms

### Backend

- **Fastify** as the HTTP server
- **graphql-yoga + Pothos** for GraphQL
- **graphql-ws** for WebSocket subscriptions
- **tus.io** for resumable uploads
- **Pino** for logging

### Identity

- **Built-in auth** (argon2id, TOTP, magic link, OAuth)
- **Entra ID, OIDC, SAML** adapters
- **WebAuthn/Passkeys** deferred

### AI

- **Anthropic Claude** primary; OpenAI/Azure/Bedrock/Ollama/vLLM as adapters
- **Prompts as code** in `packages/core/src/ai/prompts/` with semver per prompt and CI test suites
- **vm2-style sandbox** for AI-generated server code (specific isolation library determined by Objective 10's security review)

### Infrastructure

- **Self-hosted on Afrihost VPS** (Johannesburg; 8GB/4vCPU/100GB Ubuntu 24.04)
- **Coolify** as the orchestrator (no Vercel)
- **Caddy** reverse proxy
- **Docker Compose** for three stacks (dev active; staging/prod dormant initially)
- **Restic → Backblaze B2** for backups
- **OpenTelemetry** + Grafana + Loki + Tempo + Prometheus + GlitchTip (all self-hosted)

### Cross-Platform

- **Linux primary** (Ubuntu 24.04 LTS)
- **Windows Server 2019/2022 first-class** via node-windows + IIS ARR
- **CI matrix**: Linux-primary + Windows focused subset on PR + Windows nightly full

### Storage

- **Backblaze B2** (Linux/general)
- **Azure Blob Storage** (Microsoft houses)
- **MinIO/S3-compatible** (on-premise)

### Licensing

- **AGPL-3.0** for the entire platform
- **CLA Assistant** preserves dual-licensing optionality
- Customer apps generated by the platform are NOT AGPL-encumbered (the customer owns their generated code)

---

## Build Roadmap (Realistic)

The previous roadmap (~12 months solo) was unrealistic given the locked-in scope. Below is calibrated to actual scope: three databases, two operating systems, two products, full-time solo work with Claude Code as collaborator.

### Phase 0 — Foundation (Objectives 1–10)

**~12–18 months** at solo full-time pace.

This is the long phase. Cannot be skipped. Cannot be parallelized meaningfully (later objectives depend on earlier ones). The Quality Gates objective (10) has nine acceptance criteria including external pentest, chaos drills, and cross-platform conformance — none of which can be hand-waved.

End of Phase 0: the platform has a foundation reviewable by an enterprise security team. No customer-facing features yet.

### Phase 1 — Data Management Module (Objectives 11–19, including 15.5)

**~9–12 months** at solo full-time pace.

The first sellable product. By the end:

- A customer can install the platform, define a schema, get auto-generated APIs (REST + GraphQL + Realtime), browse and edit data, manage files, run queries, build their own apps via the SDK
- **Workspace Assets and Documents** (Objective 15.5) — workspace-level brand assets and reference documents, scaffolded here so they're ready to feed Phase 2 and Phase 3 AI generation
- Sellable as "self-hosted Supabase that works on MSSQL and MongoDB"
- Revenue path opens here

End of Phase 1: the platform is a complete, sellable product. Total elapsed: ~21–30 months.

### Phase 2 — AI Pipeline Foundation + Stages 1–4 (Objectives 20–24)

**~9–12 months** at solo full-time pace.

The differentiator begins to emerge. By the end:

- AI provider abstraction in place
- Customer can capture intent, generate PRDs, generate design tokens, synthesize schemas
- PRD and Design Tokens generation consume **Workspace Assets** (Obj 15.5) so output reflects company brand and voice from day one
- Schemas land in the Schema Designer from Phase 1 — the two halves converge
- Each stage's prompts have CI test suites

End of Phase 2: the AI pipeline does the upstream work; downstream stages (UI, code, tests, deploy) still TBD. Total elapsed: ~30–42 months.

### Phase 3 — AI Pipeline Stages 5–10 (Objectives 25–30, plus 26.5 and 31)

**~12–18 months** at solo full-time pace.

The generative product completes. By the end:

- Data migration handles existing-data scenarios
- UI generation produces React apps from tokens + schema
- **App Chrome** (Objective 26.5) — header / footer / side nav / breadcrumb configured once per app, rendered around every page; Designer canvas mirrors this with locked chrome regions
- **Same-canvas Designer** — Stage 6 generates v1 into the Designer canvas; all subsequent editing happens there with persistent ✦ Ask AI; the Designer is the maintenance surface (clarification added to Obj 26 Section 13)
- Code generation produces server-side functions in the sandbox
- Test generation produces Vitest + Playwright suites
- Deployment ships through environments
- **Auto-generated Documentation** (Objective 31) — fumadocs.dev-style site, in-platform live + standalone export with telemetry phone-home
- Maintenance closes the loop

End of Phase 3: the full platform vision delivered. Total elapsed: ~42–60 months.

### Honest Assessment of the Timeline

Five years solo full-time is the realistic outer bound for the full vision. Several mitigations:

1. **Phase 1 is shippable** — at month 30, a sellable product exists. Revenue can support the rest of the build.
2. **Customer feedback shapes priorities** — Phase 2 and 3 sequence may shift based on what customers actually pay for.
3. **The pipeline order is flexible after foundation** — could ship Stage 1+2+3 (intent → PRD → tokens) as a "design assistant" product before Stage 4's schema work, depending on demand.
4. **Hiring shifts the math** — even one additional engineer cuts timeline meaningfully, especially for Phase 2 and 3 which have more parallelizable work.

The previous "12 months to enterprise-ready" estimate was wrong. The honest answer is "2.5 years to first sellable product; 5 years to full vision; ship as-you-go in between."

---

## Critical Risks

1. **Foundation overruns.** Three databases × two operating systems × full audit/compliance is genuinely 3-5x the engineering cost of a Postgres-on-Linux MVP. **Mitigation:** Don't compromise on the foundation. The cost is already locked; cutting corners produces a foundation that fails enterprise review. Trust the timeline.

2. **Reasoning quality on AI artifacts.** If the AI's reasoning is shallow or wrong, the "raises the floor" thesis collapses. **Mitigation:** prompt engineering as a first-class discipline; CI test suites per prompt; quality signals tracked aggressively; iterate.

3. **Cross-database paradigm mismatch.** Mongo's document model genuinely differs from relational; AI generation must shift conceptually based on target. **Mitigation:** database-specific prompt variants; capability matrix surfaces honestly; test conformance aggressively.

4. **Sandboxing AI-generated code.** Generated code that runs server-side is the highest-risk surface. **Mitigation:** sandbox + static analysis + curated integration catalog + permission declarations + audit. Defense in depth. Specific isolation library chosen during Objective 10's security review.

5. **Approval fatigue at gates.** If every gate feels bureaucratic, users hate it. **Mitigation:** solo workflows have one approver everywhere; one-click approval; reasoning visible but never forced.

6. **The build is too long for solo.** 5 years is real time. **Mitigation:** Phase 1 is independently shippable. Don't wait for Phase 3 to launch. Revenue from Phase 1 funds the rest.

7. **Burnout.** Solo on a 5-year project is genuinely dangerous. **Mitigation:** sustainable pace; revenue from Phase 1 enables hiring; the documents in `/objectives/` are a contract that survives any period of step-back.

---

## Success Criteria

The platform is working when:

**Phase 1 success (Data Management Module sellable):**

- A customer installs the platform, points it at MSSQL, and has working REST + GraphQL + Realtime APIs in under an hour
- A workspace admin can configure approval routing for schema changes; deploy proceeds through the same migration pipeline whether AI-generated or hand-authored
- A schema change automatically lights up affected auto-generated API endpoints, real-time subscriptions, and (if Phase 2+) UI components

**Phase 2 success (AI generation upstream):**

- A user describes an app and gets a structured Intent Brief in 15 minutes
- A PRD generates from intent with section-level approval; sections trace back to intent fields
- Design tokens generate light + dark themes that pass WCAG AA
- A schema synthesizes from the PRD, lands in the Schema Designer, and the user reviews/approves through the same UI they'd use for hand-authored schemas

**Phase 3 success (full pipeline):**

- A user can describe an app and have a working version with PRD, schema, UI, tests, and deploy in under a day
- A user can ask "why does this exist?" of any artifact and get a real answer that traces back to original intent
- An enterprise can route requirements approvals to BAs and deploy approvals to ops without writing a single line of integration code
- A user who has used the platform for six months produces better artifacts when they bypass the AI than when they started
- A schema change automatically lights up every UI component, function, and test affected, before the change is approved

---

## What Supersedes This Document

The 30 objective documents in `/objectives/` are the implementation contract. When this document and an objective disagree, **the objective wins**. Each objective has:

- A locked-decisions table (Section 3 in each document)
- A Definition of Done checklist (Section 10)
- ADRs to write (Section 8)
- Verification steps (Section 9)
- Anti-patterns to refuse (Section 11)

The objectives are how the platform is built. This document explains why.

---

## Document Index

```
/mnt/user-data/outputs/
├── master-plan.md                                          (this document)
├── objectives/
│   ├── 01-repository-and-tooling.md
│   ├── 01.5-abstraction-architecture.md
│   ├── 02-environment-strategy.md
│   ├── 03-observability-foundation.md
│   ├── 04-database-postgres.md
│   ├── 04a-database-mssql.md
│   ├── 04b-database-mongo.md
│   ├── 04c-cross-database-conformance.md
│   ├── 04d-change-streams.md
│   ├── 05-identity-auth-user-directory.md
│   ├── 06-multi-tenancy-rbac.md
│   ├── 07-audit-and-compliance.md
│   ├── 08-service-layer-architecture.md
│   ├── 09-cross-platform-runtime.md
│   ├── 10-quality-gates-before-stage-one.md
│   ├── 11-data-management-foundation-and-schema-designer.md
│   ├── 12-auto-generated-rest-apis.md
│   ├── 13-auto-generated-graphql-apis.md
│   ├── 14-real-time-subscriptions.md
│   ├── 15-storage-browser-and-file-management.md
│   ├── 16-auth-and-user-management-ui.md
│   ├── 17-query-console.md
│   ├── 18-data-browser-and-editor.md
│   ├── 19-public-sdk.md
│   ├── 20-ai-pipeline-foundation.md
│   ├── 21-stage-1-intent-capture.md
│   ├── 22-stage-2-prd-generation.md
│   ├── 23-stage-3-design-tokens.md
│   ├── 24-stage-4-schema-synthesis.md
│   ├── 25-stage-5-data-migration.md
│   ├── 26-stage-6-ui-generation.md
│   ├── 27-stage-7-code-generation.md
│   ├── 28-stage-8-test-generation.md
│   ├── 29-stage-9-deployment.md
│   └── 30-stage-10-maintenance-and-evolution.md
├── foundation-build-plan.md                                (early sketch; superseded by Objectives 1-10)
└── invoice-receipt-module-plan.md                          (separate module spec)
```

---

_Master plan v3 — supersedes v1 (deleted 2026-05-01) and v2. Update when a Phase completes; rewrite if the thesis shifts._
