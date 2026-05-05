# V2 Future Scope — Competitive Gaps & VS Code Worked Example

**Status:** Roadmap planning artifact (not committed scope). V2 begins when V1 (Obj 1–31) is verifiably complete and the dev-grade thesis is proven on a real customer app.

**Audience:** Maintainer + future Claude sessions. This document is read alongside `master-plan.md` and the 30 objective documents to understand what's deliberately deferred to V2 and why.

**Companion docs:**

- `master-plan.md` — V1 thesis and scope
- `objectives/` — V1 implementation contract (Obj 1–31)
- `docs/adr/` — architectural decisions

This document has two parts:

1. **VS Code worked example** — a thinking artifact testing how a future idea-scout would decompose a vague feature prompt ("add VS Code") into ranked options. Demonstrates the pattern V2 planning should follow.
2. **V2 competitive gap inventory** — concrete goals missing from the V1 plan that are needed to credibly _replace_ the competitor set (FlutterFlow, Lovable, Bolt, Puck, Budibase, Claude design tools).

---

# Part 1: Worked Example — How the Idea-Scout Would Handle "Add VS Code to the Platform"

## Context

This is a **discussion plan**, not an implementation plan. It probes how the proposed auto-evolution system (idea-scout + dep-bump-bot + capability-review) would generate genuinely new feature ideas — not just track upgrades. We use "add VS Code as part of the system" as a worked example to test the system's idea-generation surface.

The platform is a full lifecycle product (ideation → docs → schema → codegen → test → deploy → observe → maintain → support). The scout's value is catching opportunities anywhere along that lifecycle.

## Current State

- **Monaco is already chosen** (ADR-0121) for narrow surfaces: schema code view, query console, page designer canvas
- **No VS Code product**, vscode.dev, code-server, or openvscode-server mentioned anywhere
- **No general-purpose IDE** in scope — the platform generates code but doesn't provide an editing environment beyond Monaco-on-specific-surfaces
- Current Monaco usage is in `apps/web/src/components/schema-designer/` with `@monaco-editor/react`

## What the scout would actually produce for "VS Code"

The first useful thing the scout does is **decompose the vague prompt into concrete options**. "Add VS Code" is not one idea — it's at least three, each with a different lifecycle stage, effort, and thesis-fit:

### Option A — Embed `code-server` / `openvscode-server` as a full in-browser IDE

- **Lifecycle stage:** 4 (Codegen) + 8 (Maintenance)
- **Why now:** Users currently see AI-generated code in Monaco read-mostly. A full IDE would let them edit, run terminals, debug.
- **Thesis fit:** Strong — both projects are open-source, self-hostable, fit the self-hosted thesis.
- **Effort:** Medium-large. New port (`workspace-ide`), iframe sandbox, auth bridge, file-sync to generated repo.
- **Risk:** Footprint (Docker image, RAM), security boundary with sandbox (Obj 27), conflict with the Designer canvas (Obj 26/30).

### Option B — Ship a VS Code extension that connects to the platform

- **Lifecycle stage:** Cross-cutting (touches every stage)
- **Why now:** Users with existing VS Code workflows could author objectives, trigger AI pipeline runs, view logs, deploy — without leaving their editor.
- **Thesis fit:** Strong — meets users where they are; doesn't compromise self-hosted backend.
- **Effort:** Medium. Extension talks to platform API; auth via device flow.
- **Risk:** Maintenance burden (VS Code API churn, marketplace policies), feature parity drift with web UI.

### Option C — Upgrade Monaco surfaces with real Language Server Protocol

- **Lifecycle stage:** 3 (Schema), 4 (Codegen), 8 (Maintenance)
- **Why now:** Monaco today has limited intelligence on schema/query surfaces. LSP would give real autocomplete, diagnostics, refactors for SQL/Mongo/TypeScript.
- **Thesis fit:** Strong — incremental improvement to existing surfaces, no new architecture.
- **Effort:** Small-medium per language server.
- **Risk:** Low.

## Parking lot — maybe later, just ideas, don't implement

Small/speculative tail ideas the scout would surface alongside the main options. They go in a parking lot, not the roadmap. The scout should _always_ produce a section like this — many ideas it finds will be too small or too speculative to be options on their own, but worth keeping as a record so they're not re-discovered cold every time.

- **"Open in VS Code" handoff** — generated apps expose a `vscode://` URL or `.code-workspace` download as a one-click jump from the Designer to the user's local VS Code. Tiny effort, neutral fit, no hurry.
- **`.devcontainer.json` emission** — every generated app ships with a devcontainer so VS Code (or any container-aware IDE) gets a consistent dev environment for free.
- **GitHub Codespaces template** — a one-click "open this generated app in Codespaces" button. Vendor-locked, but trivial to add and removable.
- **VS Code Web Preview integration** — when the user runs the generated app in the platform's sandbox, expose a Simple Browser-compatible preview URL.
- **Schema export to Prisma/Drizzle for VS Code users** — if the user prefers their local IDE, export the canonical schema in a format their TypeScript ORM understands.
- **Pattern scout for block-library categories** — _promoted to B11 in Part 2 once IP scope clarified (ideas, not code)._

The pattern: capture, tag as `parking-lot`, don't elevate to an objective unless it gets cross-referenced by another scout finding later (e.g., devcontainers become relevant when Stage 6/Deploy gets an objective).

## What the scout catches vs. misses

**Catches reliably:**

- Vendor-published changes to code-server, openvscode-server, Monaco, VS Code extension API → triggers re-evaluation of A/B/C
- New LSPs for SQL/Mongo/TypeScript that would slot into Option C
- Microsoft licensing changes that affect any of the above
- Cross-references against `objectives/` (e.g., spots that Obj 26 already has a "Page Designer canvas" that may overlap with Option A)

**Misses:**

- The **initial decision** that VS Code is worth considering at all — unless the user has seeded "code-editing surfaces" as a watched category in the adjacency map
- The **synthesis** that Option B + a parking-lot item could combine into a single workflow ("local VS Code with platform extension that hot-syncs to deployed env")
- Whether any option fits the **product vision** — that's a thesis judgment

## How this generalizes the auto-evolution proposal

The VS Code example surfaces refinements to the earlier scout design:

1. The adjacency map needs a category called something like **"developer surfaces" / "code-editing UX"** in the watch list, alongside the lifecycle-stage categories. Otherwise the scout can't catch any of A/B/C.
2. The scout's output should always **decompose vague ideas into concrete options**, each tagged with lifecycle stage, effort, thesis fit, and risk. A flat "consider VS Code" entry is useless; the three-option breakdown above is actionable.
3. The scout should **cross-reference existing objectives** for overlap — Option A overlaps with Obj 26's Page Designer canvas; the scout flagging that is high-value.
4. The scout's output must **always include a parking-lot section** for small/speculative tail ideas. Don't lose them; don't elevate them. Re-evaluate when later findings cross-reference them.

## What stays a human-judgment call

For each of A/B/C, the question _"does this actually fit our product?"_ is unanswerable by the scout. The scout's job ends at "here are concrete shapes; here's the evidence each is viable; here's the lifecycle stage and overlap with existing objectives." The maintainer decides which (if any) becomes an objective.

---

# Part 2: V2 Competitive Gap Inventory

## Context for V2

This section captures **goals missing from the current 30-objective plan** that are needed to credibly _replace_ the competitor set per the dev-grade-alternative thesis. They are explicitly **not for V1**. V1 finishes the foundation, the Data Management Module, and the AI Build Pipeline (Obj 1–31) and proves the dev-grade output thesis on a single web-app target.

V2 is where the platform expands from "AI generates a web app from intent" into a full competitive product surface: the generated apps gain primitives the market expects (auth, billing, workflows, integrations), the generation UX gains the polish competitors have iterated on (templates, multimodal, iterative chat), and the platform itself becomes sellable (billing, self-service, ecosystem).

The VS Code worked example in Part 1 is **part of V2** — adding code-editing surfaces (Options A/B/C) is one of many V2 goals. It sits alongside the gaps below as part of the same wave.

## Why these are V2 not V1

- V1's job is **proving the thesis** (dev-grade output that survives second-mile use) on a narrow surface. Adding breadth before that's proven dilutes focus and risks shipping a wide-but-shallow product that fails the same way Lovable/Bolt do.
- The 30 objectives are already substantial; adding 20+ more before any output exists guarantees nothing ships.
- Several V2 goals (e.g., end-user auth in generated apps, custom domains, billing) only become _meaningful_ once V1 generates working apps to attach them to.
- The scout's parking-lot pattern applies: capture, don't elevate, re-evaluate when V1 closes.

## V2 goals — competitive gap inventory

Organized by layer. Each item is a candidate objective; numbering is provisional.

### Layer A — primitives the _generated app_ needs

(Without these, generated apps look thin next to Lovable/Bolt/Budibase output.)

- **A1. End-user auth in generated apps.** Customer-facing login/signup/social/SSO/MFA/password reset for the dev's users. Distinct from platform auth (Obj 5/6). Generated apps need this on day one of being a SaaS.
- **A2. Workflow / automation builder.** Visual triggers→actions over the schema. Budibase Automate / Zapier-class. Their flagship. Operates on the platform's data model.
- **A3. Third-party integration library as primitives.** Stripe, SendGrid, Twilio, Slack, OAuth providers, analytics — discoverable, configurable, generated into apps as code. Distinct from platform-level ports/adapters.
- **A4. Email / SMS / push as generated-app primitives.** Transactional + marketing.
- **A5. Billing primitives in generated apps.** Stripe paywalls, subscriptions, metered billing, customer portal. Every Lovable/Bolt SaaS demo has this.
- **A6. Multi-tenancy as a generation pattern.** Generated SaaS apps that are tenant-aware by default (with explicit opt-out). The platform is multi-tenant; generated apps should know how to be too.
- **A7. Custom domain management.** DNS provisioning, SSL/cert lifecycle, vanity domains. Goes beyond Obj 29 deploy.
- **A8. Mobile / PWA / native target.** Strategic decision required: web-only? PWA? React Native? Capacitor? Rules out or rules in FlutterFlow's audience.
- **A9. i18n / localization** in generated apps. Strings, locales, RTL, date/number formatting.
- **A10. Product analytics for the generated app's users.** Distinct from Obj 3 (platform observability) — this is the dev's customers' usage data.
- **A11. Feature flags / A/B testing** in generated apps.
- **A12. Embedding / white-labeling.** Generated apps embedded in other sites; running under the dev's brand.
- **A13. CMS-lite content surface.** Marketing copy, images, landing-page content editing on top of generated apps. Explicitly not schema-as-CMS — content layer above schema layer.
- **A14. Marketing site / landing page generation.** Distinct from app generation. Lovable/Bolt do this implicitly.
- **A15. Forms & surveys** as a generation primitive. Budibase staple.

### Layer B — the generation experience itself

(Polish on the generation UX that competitors have iterated on.)

- **B1. Templates / starter gallery.** Lovable's home page is templates. Top-of-funnel for adoption.
- **B2. Multimodal input.** Image → component, screenshot → page, Figma import, URL → brand. Obj 21 covers intent capture but multimodal is a separate goal.
- **B3. Iterative chat-with-running-app refinement.** "Change the button to red and add a column" loop, post-generation, against the deployed app. Distinct from Obj 30 maintenance.
- **B4. Migration importers.** Bubble, Webflow, Airtable, Notion, Supabase, Retool. Adoption blocker — users have apps elsewhere.
- **B5. Brand / design system extraction from a URL.** URL → tokens. Obj 23 covers tokens but not extraction-from-existing.
- **B6. Collaborative editing of generation inputs.** Multi-user real-time PRD/design editing. Obj 14 is realtime for data, not for the generation pipeline.
- **B7. Visible cost meter to the user during generation.** Surface Obj 20's internal cost tracking as UX.
- **B8. Time-travel / undo / branch a generation.** Compare AI runs, revert, fork. Distinct from git versioning of output.
- **B9. Safety / security / IP review of generated code before merge.** Static scan, dep license check, secret scan, AND **substantial-similarity scan** for AI-generated UI artifacts against a corpus of known copyrighted blocks (commercial libraries, popular templates, the pattern-scout's provenance database). Output that exceeds a similarity threshold is flagged or refused, with a UX path to "regenerate with more variation" or "import this legitimately via the curated lane (C4)." Pairs with a user-facing warranty in the prompt UX: by submitting a generation prompt, the user warrants their inputs are theirs to use and accepts responsibility for shipped output. Should be in Obj 27 but isn't called out today; promoted to V2 explicitly because it's the platform's primary IP-liability defense.
- **B10. VS Code surfaces.** Per Part 1 — Option A (code-server embed), Option B (VS Code extension), Option C (LSP upgrade for Monaco). Treat the three as separate V2 candidates ranked by thesis-fit and effort.
- **B11. Pattern scout for marketplace block coverage.** A watcher (architecturally similar to the idea-scout in Part 1) that monitors block libraries broadly — _any_ source, paid or free, since the scout only extracts patterns — for _pattern categories and design trends_ the first-party marketplace doesn't yet cover. Reasonable starting watch list: shadcnblocks, Aceternity, Magic UI, Tailwind UI catalogs, awwwards, dribbble; expand as needed. Two output modes:

  - **Issue mode:** files a marketplace gap issue — "no pricing-table-with-comparison block; observed 5 variants in the wild; here are 3 reference _shapes_ (textual description, not code)" — for a human or the AI pipeline to implement clean-room.
  - **Generate mode:** feeds a textual pattern description directly to the Stage 4 codegen pipeline, which produces a fresh first-party block on platform tokens, routed through the same review gates as any other generated artifact.

  Hard rule: the scout's _stored output_ is text descriptions only. It never persists, ships, or republishes third-party code, markup, CSS, images, or copy. Provenance metadata (which libraries informed a description) is recorded for transparency. Source paywalls, where they exist, are respected operationally (the scout uses publicly accessible pages or documented API access; it is not a paywall-bypass tool).

  Effort: medium. Risk: low if the hard rule is enforced (output is text, not scraped assets). Requires careful prompt engineering for the description-extraction step. Pairs with C4's pattern-scout-fed lane.

### Layer C — platform GTM & ecosystem

(How the platform makes money and grows. Required for "actually sell it.")

- **C1. Workspace-level billing & usage metering.** Stripe, invoices, plan tiers, usage-based. Obj 6 has budgets but not commercial billing.
- **C2. Self-service customer portal.** Signup, plan upgrade, team invites, payment methods.
- **C3. Plugin / extension model.** Third-party adapters, prompts, UI components. Without this the ecosystem is closed.
- **C4. Marketplace.** Components, templates, prompts — the ecosystem surface. Composed of four lanes:

  - **First-party blocks.** ~50–100 blocks built on shadcn/ui (MIT) + platform design tokens. Each ships with a Storybook story, a11y validation, and an AI-composable variant so the generation pipeline can use it. Free to draw inspiration from any block library on the web — copying _patterns and ideas_ is fine; what gets shipped is fresh code on platform tokens.
  - **Pattern-scout-fed blocks.** Output of the pattern scout (B11) — first-party blocks built clean-room from textual descriptions of patterns observed on third-party libraries. Same standards as the first-party lane; tracked separately for provenance.
  - **Curated upstream imports.** A small allowlist of explicitly-permissive sources (shadcn examples, OSS Magic UI, etc.). Each import is a deliberate PR — license preserved, attribution intact, tokens reconciled. **Not** an automated crawl.
  - **Community contributions under a CLA.** Submission flow with automated checks (license header, a11y, design-token compliance, no secrets, dep allowlist). Rejected on any failure.

  **The rule (one line):** ideas are free, expression is licensed. The scout and the team can observe _any_ library — paid, free, restrictive, permissive — and learn from it. What can be _stored and shipped_ in the marketplace is (a) fresh first-party code on platform tokens (any inspiration source), or (b) verbatim imports only from explicitly-permissive sources. Auto-crawling and republishing third-party code/assets is infringement regardless of the source's price tag.

- **C5. Public app sharing & community.** "Look what I built." Top-of-funnel.
- **C6. Forking / cloning a public generated app.** Adoption accelerator.

### Layer D — dev-grade thesis goals (currently _implicit_, must become _explicit_)

These are the most important V2 additions because they're what makes the platform the _dev-grade_ alternative. Today they're assumed properties; in V2 (or earlier — see note) they need to be declared success criteria with verification.

- **D1. Generated app runs standalone, off-platform.** `git clone && npm install && npm run dev` works on the dev's laptop without Lighthouse Studio running. This _is_ the code-as-truth promise; it must be an explicit verification.
- **D2. Round-trip durability proof.** Dev edits generated code by hand → AI re-runs → edits preserved or surfaced as a real merge conflict, never silently overwritten. Obj 30 hints at it; V2 should pin it as a measurable goal with regression tests.
- **D3. Generated app ships with its own CI/CD config.** GitHub Actions / GitLab CI / etc. so the dev's team runs their pipeline on the output without re-binding to the platform.
- **D4. Secrets management for generated apps.** DB creds, API keys, env vars — clean flow from platform → deployed app → local dev, without coupling to the platform.
- **D5. Local dev experience for generated apps.** Hot reload, seed data, fixtures, devcontainer (cross-references VS Code parking-lot item).
- **D6. End-user-facing documentation generated _for the app's users_.** Distinct from Obj 31 (platform docs). The dev's customers' help docs.

## Critical note on Layer D

**Layers A/B/C are V2 features. Layer D is V1 _property_.** D1–D6 are V1 success criteria attached to existing objectives, not deferred to V2. Reason: if V1 ships generated output that _doesn't_ run standalone, doesn't round-trip, doesn't have CI, doesn't manage secrets cleanly — then V1 has shipped Lovable-with-self-hosting, not the dev-grade alternative. The thesis fails before V2 starts.

**Status (2026-05-05):** Promoted into V1. D1–D6 are now Definition-of-Done items on the relevant objectives:

- **Obj 27 (Code Generation):** D1 standalone runnable, D4 secrets management, D5 local dev experience
- **Obj 29 (Deployment):** D3 generated CI/CD config, D4 secrets boundary at deploy time
- **Obj 30 (Maintenance & Evolution):** D2 round-trip durability proof (with regression tests)
- **Obj 31 (Auto-Generated Documentation):** D6 end-user-facing docs as a distinct surface

V2 inherits no Layer D items. If a Layer D goal is later found to need work the V1 DoD didn't cover, that's a V1 amendment, not a V2 candidate.

See also Layer E below — a parallel category of implicit-but-undeclared properties of _the platform itself_ (rather than the generated app), awaiting the same kind of promotion decision.

### Layer E — platform operability (currently _implicit_, must become _explicit_)

These are properties of _the self-hosted platform itself_ that the thesis assumes but no V1 objective declares. Layer D covers the _generated app's_ dev-grade properties; Layer E covers what self-hosted operators need from the platform.

- **E1. Self-hosted upgrade procedure.** Documented, tested upgrade path across platform versions: migration ordering on PostgreSQL/MSSQL/MongoDB, downtime expectations, rollback steps, cross-version compatibility window, version-skew handling for HA deployments. Without this, "self-hostable" customers cannot safely move from v1.0 to v1.1, and the thesis pillar collapses on the second release.

  **Status (2026-05-05): Promoted to V1 as [Objective 9.5: Platform Upgrade & Versioning](../../objectives/9.5-platform-upgrade-and-versioning.md).** Foundational scaffolding (the `platform_versions` table on all three databases) was backfilled into Obj 4 / 4a / 4b as migrations `0009_platform_versions` (Postgres) and `0007_platform_versions` (MSSQL, Mongo). The full orchestrator, CLI, operator UI, runbooks, and ADRs land when Obj 9.5 is implemented.

## V2 prioritization (when V1 closes)

Three tiers:

- **Tier 1 — block first revenue:** A1 (end-user auth), C1 (platform billing), C2 (self-service portal). _(Layer D was promoted into V1 — see Status note above. If any Layer D item slips out of V1, it returns to this tier.)_
- **Tier 2 — block "we replace Lovable/Bolt" claims:** B1 (templates), B2 (multimodal), A5 (Stripe), A7 (custom domains), B3 (iterative chat), A14 (marketing sites). And A2 (workflow builder) if pursuing Budibase users.
- **Tier 3 — ecosystem flywheel:** C3 (plugin model), C4 (marketplace), C5 (public sharing), B4 (migration importers).

Strategic decisions to make explicit _before_ V2 (not building, just committing):

- Mobile target (A8): web-only / PWA / native?
- Open vs. closed ecosystem (C3): plugins or no plugins?
- Layer A vs. Layer B emphasis: do we win on app capability or on generation UX?

## Verification (V2 stays a planning artifact for now)

Not applicable yet. V2 starts when V1's success criteria are met — specifically, when:

1. Obj 27 (codegen) produces output that demonstrably satisfies D1–D6
2. The Foundation Review's PARTIAL gates have closed
3. At least one real customer has shipped a non-trivial app on V1 and exercised the second-mile loop

Until then this section is a watch list. The idea-scout (when it exists) cross-references items here against vendor announcements, e.g., "new Stripe SDK release → flag against A5"; "Anthropic ships multimodal SDK update → flag against B2"; "VS Code extension API change → flag against B10."
