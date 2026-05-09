# Objective 34: AI PR Review Surface

**Status:** Ready for development
**Prerequisites:** Objectives 20 (AI Pipeline Foundation), 27 (Code Generation), 28 (Test Generation), 33 (Skill Promotion & Trajectory Library) complete; Objective 7 (Audit) for review-finding audit trail
**Blocks:** None directly; meaningfully complements Objectives 29 (Deployment) and 32 (Automated Pentest) by adding a pre-deploy human-review layer

---

## 1. Purpose

The AI Build Pipeline generates code (Obj 27), generates tests (Obj 28), runs pentest (Obj 32), and deploys (Obj 29). What it does _not_ do today is review human-edited diffs against the generated baselines, nor review human PRs against each app's specific PRD, schema, and conventions. The risk this leaves: a developer takes generated code, edits it, and submits a PR; the review burden falls entirely on humans, with no contextual help, no consistency, and no learning from prior reviews.

CodeRabbit demonstrates that AI PR review provides genuine value at scale, but most of its product is bundled value (40+ third-party linters, hosted SaaS, social features) that doesn't fit a self-hosted platform. The load-bearing ideas are: **codegraph context** (the AI sees the whole codebase, not just the diff), **learnings** (workspace-tunable feedback that improves subsequent reviews), and **inline findings with suggested fixes**. This objective produces those three, disciplined to the platform's conventions.

The platform has an unfair advantage CodeRabbit doesn't: it already knows the app's PRD, schema, design tokens, generated baseline, and test coverage. That **is** the codegraph — no separate index needed. Review prompts consume those artifacts directly, producing reviews tuned to each app's actual specification rather than generic best practices.

The other thing this objective produces is the **VCS port boundary**. v1 ships with a GitHub adapter; the port is designed for GitLab/Azure DevOps/Bitbucket adapters as post-v1 work. Customer choice in version control should not be locked at design time.

---

## 2. Scope

### In Scope

- **VCS port abstraction**: a port supporting GitHub at v1; designed for GitLab, Azure DevOps, Bitbucket
- **PR webhook reception**: the platform receives PR-opened, push, comment-resolved events from the configured VCS
- **Review pipeline**: triggered by PR events; produces a structured review against the app's specification and conventions
- **Codegraph context assembly**: the platform's existing artifacts (PRD, schema, tokens, generated code baseline, test coverage report) are assembled per-app as the review context — no separate indexing
- **Inline findings**: review produces zero or more findings, each with file/line, severity, category, rationale, and (where safe) a suggested fix
- **Suggested-fix application**: where the platform is highly confident, a 1-click "apply suggestion" action posts the patch as a commit on the PR branch
- **Learnings**: when a reviewer dismisses a finding with a reason, the dismissal becomes a workspace-scoped Skill (using the Skill mechanism from Objective 33), tuning future reviews of the same prompt
- **Pre-merge natural-language checks**: a workspace can author free-text checks ("must include a Storybook story for new components"); the platform compiles them to prompt fragments at review time
- **Review state per PR**: each PR has a review record; subsequent pushes incrementally re-review changed files
- **Per-finding lifecycle**: finding → posted → acknowledged | dismissed | applied; lifecycle audited
- **Severity taxonomy**: blocker, major, minor, nit, info; configurable per workspace whether blocker findings block merge
- **Generated-vs-edited diff detection**: when a human edits AI-generated code, the review knows the baseline and can flag drift from PRD intent
- **Review prompt versioning**: review prompts are code (Obj 20 discipline); semver per prompt; eval suite per prompt
- **Cost tracking integration**: PR review consumes the same cost tracking as Obj 20
- **VCS-side identity mapping**: GitHub user ↔ workspace user, audited
- **Authorization**: who in a workspace can configure VCS, who can dismiss findings, who can author pre-merge checks
- ADRs

### Out of Scope (Belongs to Later Objectives or Explicitly Refused)

- **GitLab / Azure DevOps / Bitbucket adapters at v1.** Stubs exist with "not yet implemented" errors; tracked GitHub issues. Adapters follow post-v1 demand.
- **Hosted SaaS deployment.** The platform is self-hosted; this objective ships as part of the self-hosted offering.
- **40+ bundled third-party linters.** Existing repo tooling (dependency-cruiser, ESLint, etc.) handles deterministic checks. This objective's findings are AI-derived, not lint-derived.
- **Daily standup / sprint review automation.** Different surface.
- **Cross-PR pattern detection ("you keep making this mistake").** Out of scope at v1; relies on cross-PR analytics infrastructure not yet built.
- **Review of non-platform-generated repositories.** v1 reviews PRs against apps the platform generated. Reviewing arbitrary external repos requires a different ingestion model and is deferred.
- **Auto-merging on green review.** Findings inform humans; humans merge.
- **Comment threads / conversational follow-ups on findings.** v1: post once, lifecycle (acknowledge / dismiss / apply); v2 may add threading.
- **AI-generated docstrings or unit tests via PR review.** Those belong to Objectives 31 and 28 respectively, generated upstream of review.
- **Compliance-framework mapping (SOC 2, ISO 27001, etc.).** Per the addon plan, this is an Objective 31 extension, not part of review.

---

## 3. Locked Decisions

| Decision                           | Choice                                                                                                                    | Rationale                                                    |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| VCS abstraction                    | A `VcsPort` hides provider differences (GitHub at v1; GitLab/Azure DevOps/Bitbucket as post-v1)                           | Standard hexagonal pattern; ADR-driven adapter additions     |
| v1 VCS adapter                     | GitHub via the official Octokit SDK + webhooks                                                                            | Largest user base; most mature SDK                           |
| Webhook delivery                   | Inbound HTTPS webhooks; signature verification mandatory                                                                  | Security baseline                                            |
| Webhook authentication             | GitHub App installation per workspace; not OAuth                                                                          | Per-workspace credential boundary; finer permissions         |
| Review trigger events              | `pull_request.opened`, `pull_request.synchronize`, `pull_request.reopened`, `pull_request.ready_for_review`               | Standard set; configurable per workspace                     |
| Review prompts location            | `packages/core/src/ai/prompts/code-review/`                                                                               | Same as all other prompts                                    |
| Codegraph                          | Assembled at review time from existing artifacts; no separate index, no embedding store                                   | Platform already has authoritative artifacts; no duplication |
| Codegraph staleness                | Refused — review consumes the artifacts as-of-PR-merge-base; staleness is bounded by the artifact lifecycle               | Determinism over freshness                                   |
| Finding severity                   | `blocker`, `major`, `minor`, `nit`, `info`; workspace can configure which severities block merge (default: blockers only) | Standard taxonomy; workspace control                         |
| Suggested-fix safety threshold     | Confidence ≥ 0.85 from the review prompt; below threshold, finding is informational only                                  | High bar; humans verify; conservative default                |
| Suggested-fix application          | New commit on PR branch authored by a platform-controlled bot user; never force-push; never amend                         | Auditable; reversible                                        |
| Learnings storage                  | Workspace-scoped Skill (per Objective 33); dismissal-with-reason → skill candidate → admin promotes                       | One mechanism, not two                                       |
| Pre-merge custom checks            | Authored as natural language by workspace admins; compiled to prompt fragments at review time; versioned                  | Same code-as-data discipline as prompts                      |
| Pre-merge check enforcement        | Workspace chooses: advisory (informational findings) or blocking (severity = blocker)                                     | Not all checks are merge-gate-worthy                         |
| Review state                       | Per PR + per merge-base; incremental re-review on push                                                                    | Re-reviewing the entire PR on every push wastes tokens       |
| Re-review scope on push            | Files changed since prior review + files transitively dependent on changed exports (per dependency-cruiser graph)         | Bounded scope; catches knock-on regressions                  |
| Review concurrency per workspace   | At most one active review per PR; new push during in-flight review enqueues a re-review                                   | Prevents thrash; deterministic ordering                      |
| Generated-vs-edited diff detection | The platform stores the AI-generated baseline of every code artifact; PR diff is computed against (baseline → current)    | Surfaces drift from PRD intent                               |
| Review prompt model temperature    | 0 by default; reasoning quality is paramount; non-determinism in review is unacceptable                                   | Consistent reviews                                           |
| Cost attribution                   | Review consumes against the workspace AI budget under stage `code_review`                                                 | Reuses Objective 20 cost tracking                            |
| Identity mapping                   | GitHub user → workspace user via OAuth-style consent flow during VCS configuration; mapping stored per workspace          | Audited authorship; permission checks against the right user |
| Bot account                        | One platform-controlled bot identity per VCS installation; commits authored as the bot; comments authored as the bot      | Clear attribution; audit boundary                            |
| Authorization                      | New permissions: `vcs.configure`, `review.dismiss`, `review.author_check`, `review.suggest_apply`                         | Per Objective 6 RBAC                                         |
| Stale review behavior              | Closed/merged PR's review is archived; trajectories preserved                                                             | Auditable forever                                            |

---

## 4. Architectural Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                        GitHub (or other VCS)                          │
│  PR opened / pushed → webhook → Platform                              │
└─────────────────────────────────┬────────────────────────────────────┘
                                  │
                                  ▼
        ┌──────────────────────────────────────────────────┐
        │       Code Review Pipeline (this objective)       │
        │                                                    │
        │   Services:                                        │
        │   - VcsWebhookService (verify, normalize, enqueue) │
        │   - ReviewOrchestratorService (assemble + run)     │
        │   - FindingService (post, lifecycle, learnings)    │
        │   - PreMergeCheckService (compile, evaluate)       │
        │                                                    │
        │   Ports:                                            │
        │   - VcsPort                                        │
        │   - ReviewRepositoryPort                           │
        │                                                    │
        │   Adapters:                                         │
        │   - vcs-github (v1)                                │
        │   - vcs-gitlab / vcs-azure / vcs-bitbucket (stubs) │
        │   - reviewrepo-postgres / mssql / mongo            │
        └─────────────────────────────────┬────────────────┘
                                          │
                                          ▼
        ┌──────────────────────────────────────────────────┐
        │   Foundation services (already complete):          │
        │   - GenerationService (Obj 20)                      │
        │   - SkillService (Obj 33) — learnings as skills    │
        │   - TrajectoryService (Obj 33) — review trajectories │
        │   - ArtifactService (Obj 20) — codegraph source    │
        │   - AuthorizationPort (Obj 6)                       │
        │   - AuditPort (Obj 7)                               │
        │   - JobQueuePort (Obj 1.5)                          │
        └──────────────────────────────────────────────────┘
```

A review is a generation. It uses the same `GenerationService`, the same prompt system, the same trajectory recording, the same skill ranking. The new layer is everything around it: VCS I/O, finding lifecycle, codegraph assembly.

---

## 5. The Hard Parts

**5.1 The codegraph is artifacts, not an index**

CodeRabbit builds a "Codegraph" by indexing the customer's repository. The platform doesn't need to: it already has authoritative artifacts for every generated app — PRD, schema, design tokens, generated code baseline (with content-addressed refs), test coverage report. Assembling the review context is a query against existing artifact storage, not an indexing pipeline.

```
ReviewContext for a PR:
- App identifier (resolved from VCS repo → app mapping)
- App's current PRD (artifact)
- App's current schema (artifact)
- App's current design tokens (artifact)
- App's generated code baseline (artifact set, pinned to merge-base)
- App's test coverage report (artifact, latest)
- Workspace conventions (workspace settings + per-app overrides)
- Workspace's active code-review skills (Obj 33 ranking)
- Workspace's pre-merge checks (compiled prompt fragments)
- The PR diff (from VcsPort)
- The generated-vs-edited diff (baseline → PR head)
```

This context is large. Token cost matters. Mitigations:

- **Diff-scoped artifact slicing**: the PRD section relevant to the changed files is included; unrelated PRD sections are summarized to one-line headings.
- **Schema scoping**: only tables/collections referenced by changed code are included in full; the rest is a list-of-names.
- **Caching**: the assembled context per (app, merge-base) is cached for 24 hours (per Objective 20's caching discipline).

The slicing rules are deterministic and themselves prompt-tested — a review whose context is sliced wrong is a worse review.

**5.2 Generated-vs-edited diff detection**

The platform's edge over generic AI review is knowing what the code _was supposed to be_. Every AI-generated artifact has a content hash (per Objective 33's trajectory refs). When a PR touches a file with an AI-generated baseline, the platform computes:

```
baseline_diff = diff(generated_baseline, pr_head)
human_authored_lines = baseline_diff.added ∪ baseline_diff.modified
```

The review prompt receives both the PRD's relevant section _and_ the human-authored lines. This lets the review surface findings like:

> "This handler diverges from PRD §4.2 (`audit on every write`) — the generated baseline included an audit emit on line 47 that this PR removes. If this is intentional, please update the PRD."

That's the kind of finding generic AI review can't produce. The platform produces it because it knows both sides.

For files with no generated baseline (human-authored from scratch), the review falls back to PRD-aware generic review — still better than generic, because it has the PRD.

**5.3 Findings as a lifecycle, not a one-shot**

A finding's life:

```
posted (the platform posts an inline comment on the PR)
  ↓
  ├── acknowledged → reviewer indicated they saw it
  ├── dismissed (with reason) → reviewer rejected the finding
  └── applied (if suggested fix existed) → suggested patch committed
```

The lifecycle is captured as audit events. Dismissal is the interesting one: a reviewer says "this finding is wrong because X." The reason is captured against the finding, and per the locked decision the dismissal becomes a Skill candidate — the workspace can promote it, and future reviews from the same prompt see the dismissal as a learning.

Subsequent pushes to the same PR don't re-post acknowledged or dismissed findings _for the same code locations and the same reason_. The review-state tracking is keyed on (file, line range, finding category, prompt version). When the prompt is bumped to a new major version, prior dismissals are not automatically inherited — major version means the finding semantics may have changed.

**5.4 Suggested fixes — confidence and safety**

Suggesting a fix is harder than spotting a problem. The review prompt produces, alongside each finding, an optional `suggestedFix` with:

```typescript
interface SuggestedFix {
  patch: UnifiedDiff; // standard unified diff format
  confidence: number; // 0.0–1.0
  rationale: string; // why this fix
  affectedFiles: string[]; // limit-of-blast-radius declaration
}
```

Threshold rule: if `confidence < 0.85`, the fix is shown as a _suggested_ patch in the PR comment but the 1-click "Apply" action is not offered. This is conservative on purpose. False applications are worse than missing fixes — the developer can always copy the suggestion manually.

When a developer clicks "Apply":

1. Verify the patch still applies cleanly to the current PR head (the developer may have pushed since).
2. If clean: bot user creates a new commit on the PR branch with the patch and a commit message referencing the finding.
3. If not clean: surface "patch no longer applies; review the suggestion manually."
4. Audit `review.suggestion_applied` with patch and finding id.

Never force-push, never amend, never rewrite history. Every applied suggestion is a normal commit in the PR's history.

**5.5 Learnings as Skills (the Objective 33 reuse)**

CodeRabbit's "Learnings" are workspace-tunable instructions that ride along with future reviews. Objective 33 already produces a disciplined mechanism for this: workspace-scoped, versioned, audited, deterministically ranked. Learnings don't need a separate system.

The integration:

```
1. Reviewer dismisses a finding with reason: "We don't require Storybook stories
   for components in /admin/ — they're internal-only."
2. The dismissal creates a SkillCandidate of kind 'few_shot_exemplar' applicable to
   the code-review prompt that produced the finding.
3. The candidate's proposed template is generated from the finding + dismissal reason
   (the same proposed-template generation prompt from Obj 33).
4. The workspace admin reviews the candidate and promotes it (or dismisses).
5. Future code-review generations include the promoted skill in their top-K.
6. The next time the prompt would generate the same finding, the skill input nudges
   it not to.
```

This is reuse, not duplication. Every disciplined property of skills (workspace-scoping, deterministic ranking, sanitization on publish, retraction with grace period) applies for free. The only piece this objective adds is the _automatic candidate creation_ on dismissal-with-reason — a small SkillCandidate creation in the FindingService.

Edge cases:

- Empty dismissal reason: no skill candidate created. (We need the reason for the template.)
- Dismissal reason of "wrong" or "no" (uninformative): the candidate is created but flagged as low-quality; admin will likely dismiss the candidate. Not a problem — the candidate flow handles it.
- Many dismissals of the same finding category over time: each creates a candidate. The workspace admin sees a cluster and promotes the most representative one. Or: a future `de-duplicate candidates` heuristic, deferred.

**5.6 Pre-merge custom checks**

Workspaces author free-text checks: "Every new server function must declare its idempotency stance in a header comment." The platform compiles these to prompt fragments at review time.

Compilation pipeline:

1. **Syntax-validate**: the check passes through a small grammar (subject + condition + obligation).
2. **Render to prompt fragment**: a deterministic template renders the check as a section in the review prompt's user message.
3. **Cache the compiled fragment** keyed on (check id, check version, prompt version). Recompile only on edit.
4. **Eval before activation**: when authoring a new check, the workspace can run it against recent PR diffs in a dry-run mode to see what findings it would produce. This catches checks that are too vague or too aggressive.

Checks are versioned (semver). Activation is a deliberate workspace-admin action.

If a check is marked blocking, findings of severity = blocker emitted by it gate merge per workspace policy. Otherwise findings are advisory.

**5.7 Webhook reliability and ordering**

Webhooks are unreliable in the small. Mitigations:

- **Signature verification**: GitHub webhooks signed with a secret per installation; signature mismatch = drop + warn.
- **Idempotency**: each webhook delivery has a unique id; processing is idempotent on the delivery id.
- **Replay endpoint**: an admin endpoint can replay missed webhooks given a delivery id range — for the rare case where webhook delivery failed and recovery is needed.
- **Ordering**: a PR's events processed in arrival order via a per-PR FIFO queue. Out-of-order events (push before opened, observed in the wild for PRs created via API) are reconciled — the platform queries VCS for current PR state when uncertain.
- **Catch-up scan**: nightly job lists open PRs across configured repos and verifies the platform has a review for each; missing reviews are enqueued.

**5.8 Per-PR review state and incremental re-review**

A PR sees multiple pushes. Re-reviewing the entire diff every time is wasteful. The state machine:

```
Review for PR #123:
- merge_base_at_first_review: <sha>
- last_reviewed_head: <sha>
- findings: [...]                    # active findings keyed on (file, line range, prompt version)
- dismissed_findings: [...]          # respected on re-review
- acknowledged_findings: [...]       # respected on re-review
```

On push:

1. Compute changed files since `last_reviewed_head`.
2. Compute transitive deps via dependency-cruiser graph (files whose exports the changed files import or that import the changed files' exports).
3. Re-review only the union of changed + transitively-dependent files.
4. Reconcile findings: existing findings still applicable (same location + same category) are kept; resolved findings (location no longer exists or category no longer triggers) are marked resolved; new findings posted.

When the merge-base changes (rebase / force-push of the base branch — not the PR branch), full re-review runs. Force-push of the PR branch itself is also full re-review (the diff identity changed).

**5.9 The bot identity and audit attribution**

Every comment, applied suggestion, and status check the platform posts is authored as a platform-controlled bot user installed via the GitHub App. This is the right boundary:

- **Audit clarity**: every reviewer sees clearly what the AI said vs. what humans said.
- **Permissions**: the bot's GitHub App scopes are minimal (read PRs, write PR comments, create commits on PR branches).
- **Revocation**: workspace admin uninstalls the GitHub App → all platform write access revoked atomically.
- **No impersonation**: the platform never authors as a human user, even if the human triggered the action.

Identity mapping: when `review.suggest_apply` is invoked by a workspace user, the audit record captures both the workspace user (who triggered it) and the bot (who actually wrote the commit). On the GitHub side, the commit's `Co-authored-by` trailer credits the workspace user.

**5.10 Cost containment**

Review can be expensive. A 500-file PR could blow a workspace's monthly AI budget if naïvely processed. Mitigations:

- **Per-PR cost cap**: workspace-configurable, defaulting to `monthly_budget_usd / 100`. Exceeded → review halts with a `cost_cap_exceeded` finding; reviewer can manually request continuation.
- **File prioritization**: changed files are sorted by (changed-line-count, then critical-path-flag) and reviewed in that order. If the cap is hit partway through, the most-impactful files are reviewed.
- **Skip rules**: vendored directories (`node_modules`, `dist`, `*.lock`), generated files (matching workspace-configured patterns), and binary files are skipped without prompt invocation.
- **Token-budget pre-flight**: for each file the platform estimates token cost from file size + context size before sending. Files exceeding 80% of the per-file token budget skip with a `file_too_large_for_review` informational finding.

Costs surface live in the PR's review status: "Reviewed 47 of 312 changed files; cost cap reached. Configure higher cap or reduce diff size."

**5.11 Determinism and replay**

Code review prompts run at `temperature: 0` (locked decision). Combined with deterministic skill ranking from Objective 33, two reviews of the same PR head with the same prompt versions and same active skills produce identical findings.

Replay: every review run produces a trajectory (Objective 33 substrate). When a finding is later disputed ("the AI was wrong here"), the trajectory hydrates to the exact context that produced it. Cross-provider replay (Objective 35) lets a platform engineer verify whether the issue was provider-specific.

This determinism is a _property_, not aspirational. The CI gate around it lives in the eval framework (Objective 35).

---

## 6. Component Specifications

### 6.1 VcsPort

```typescript
// packages/ports/vcs/src/vcs.port.ts

export interface VcsPort {
  readonly id: string;
  readonly capabilities: VcsCapabilities;

  /** Verify a webhook signature. */
  verifyWebhookSignature(input: WebhookVerifyInput): Result<VerifiedWebhook, AppError>;

  /** Get a PR's metadata + current head. */
  getPullRequest(installationId: string, repoId: string, prNumber: number): Promise<Result<PullRequest, AppError>>;

  /** Get the PR's diff against its merge-base. */
  getPullRequestDiff(installationId: string, repoId: string, prNumber: number): Promise<Result<UnifiedDiff, AppError>>;

  /** Post an inline review comment. */
  postReviewComment(installationId: string, input: PostReviewCommentInput): Promise<Result<PostedComment, AppError>>;

  /** Update an existing review comment (e.g., on lifecycle transition). */
  updateReviewComment(installationId: string, commentId: string, body: string): Promise<Result<void, AppError>>;

  /** Resolve / hide an existing review comment. */
  resolveReviewComment(installationId: string, commentId: string): Promise<Result<void, AppError>>;

  /** Apply a patch as a new commit on the PR's head ref. */
  applyPatchAsCommit(installationId: string, input: ApplyPatchInput): Promise<Result<CommitRef, AppError>>;

  /** Set a PR status check. */
  setStatusCheck(installationId: string, input: StatusCheckInput): Promise<Result<void, AppError>>;

  /** List open PRs for catch-up scanning. */
  listOpenPullRequests(installationId: string, repoId: string): Promise<Result<PullRequest[], AppError>>;
}
```

Adapters:

- **vcs-github** (v1): full implementation via Octokit + GitHub App.
- **vcs-gitlab**, **vcs-azure**, **vcs-bitbucket**: stub adapters that return `NotImplementedError` for all methods; tracked GitHub issues for completion.

### 6.2 VcsWebhookService

```typescript
export class VcsWebhookService {
  /** Receive an inbound webhook; verify, normalize, enqueue review. */
  async receive(input: WebhookReceiveInput): Promise<Result<WebhookReceived, AppError>>;

  /** Replay a webhook delivery id range (admin only). */
  async replayDeliveries(ctx: RequestContext, range: DeliveryRange): Promise<Result<ReplayReport, AppError>>;

  /** Catch-up scan: list open PRs and ensure each has a review record. */
  async catchUpScan(ctx: SystemContext): Promise<Result<CatchUpReport, AppError>>;
}
```

### 6.3 ReviewOrchestratorService

```typescript
export class ReviewOrchestratorService {
  /** Run (or re-run) a review for a PR. */
  async runReview(ctx: RequestContext, input: RunReviewInput): Promise<Result<ReviewRun, AppError>>;

  /** Get a review's current state. */
  async getReview(ctx: RequestContext, reviewId: string): Promise<Result<Review, AppError>>;

  /** List reviews for a PR. */
  async listReviewsForPr(ctx: RequestContext, repoId: string, prNumber: number): Promise<Result<Review[], AppError>>;
}
```

The orchestrator's per-review work:

```
1. Authorize (`review.run` permission for the workspace).
2. Resolve app identity from (repo, branch) → app mapping.
3. Load codegraph context: PRD, schema, tokens, generated baseline, coverage, conventions.
4. Slice context for the diff (Section 5.1).
5. Compute generated-vs-edited diff (Section 5.2).
6. Load active code-review skills via SkillService.getTopK (Section 5.5).
7. Load active pre-merge checks; render to prompt fragments (Section 5.6).
8. Run review prompt(s) via GenerationService (records trajectory automatically).
9. Reconcile findings against existing review state (Section 5.8).
10. Post / update / resolve comments via VcsPort.
11. Set status check (passing if no blockers; failing if blockers + workspace blocks-on-blocker).
12. Audit ai.review.completed with finding counts by severity.
13. Update review record with new state.
```

### 6.4 FindingService

```typescript
export class FindingService {
  async listForReview(ctx: RequestContext, reviewId: string): Promise<Result<Finding[], AppError>>;
  async acknowledge(ctx: RequestContext, findingId: string): Promise<Result<void, AppError>>;
  async dismiss(ctx: RequestContext, findingId: string, reason: string): Promise<Result<void, AppError>>;
  async applySuggestedFix(ctx: RequestContext, findingId: string): Promise<Result<CommitRef, AppError>>;
}
```

`dismiss` with a non-empty reason invokes `SkillCandidateService.createCandidateFromDismissal` (a new SkillCandidateService method added in Objective 33's implementation, or here if not present — coordinate at implementation time).

### 6.5 PreMergeCheckService

```typescript
export class PreMergeCheckService {
  async create(ctx: RequestContext, input: CreatePreMergeCheckInput): Promise<Result<PreMergeCheck, AppError>>;
  async listForWorkspace(ctx: RequestContext): Promise<Result<PreMergeCheck[], AppError>>;
  async update(ctx: RequestContext, checkId: string, changes: PreMergeCheckUpdate): Promise<Result<PreMergeCheck, AppError>>;
  async activate(ctx: RequestContext, checkId: string): Promise<Result<void, AppError>>;
  async deactivate(ctx: RequestContext, checkId: string): Promise<Result<void, AppError>>;

  /** Dry-run: render this check against recent PRs and report what findings it would have produced. */
  async dryRun(ctx: RequestContext, checkId: string, opts: DryRunOptions): Promise<Result<DryRunReport, AppError>>;

  /** Compile a check's natural-language body to a prompt fragment (cached). */
  async compile(checkId: string, version: string): Promise<Result<CompiledCheckFragment, AppError>>;
}
```

### 6.6 Database Schema

```typescript
vcs_installations: {
  ...standardColumns,
  workspace_id: uuid,
  vcs_provider: enum('github', 'gitlab', 'azure_devops', 'bitbucket'),
  installation_id: string,                     // provider-side id
  installed_by_user_id: uuid,
  webhook_secret_ref: string,                  // SecretStorePort reference
  status: enum('active', 'suspended', 'uninstalled'),
}
unique: [vcs_provider, installation_id]
indexes: [workspace_id, status]

vcs_repo_app_mappings: {
  ...standardColumns,
  workspace_id: uuid,
  installation_id: uuid,                       // FK to vcs_installations
  repo_provider_id: string,                    // provider-side repo id
  repo_full_name: string,                      // e.g. "owner/repo"
  app_id: uuid,                                 // platform's app identifier
  primary_branch: string,
}
unique: [installation_id, repo_provider_id]
indexes: [workspace_id, app_id]

vcs_user_mappings: {
  ...standardColumns,
  workspace_id: uuid,
  user_id: uuid,                                // platform user
  vcs_provider: enum,
  vcs_user_id: string,
  vcs_username: string,
}
unique: [vcs_provider, vcs_user_id]
indexes: [workspace_id, user_id]

reviews: {
  ...standardColumns,
  workspace_id: uuid,
  app_id: uuid,
  repo_full_name: string,
  pr_number: int,
  pr_provider_id: string,
  merge_base_sha: char(40),
  last_reviewed_head_sha: char(40),
  status: enum('queued', 'running', 'completed', 'failed', 'cost_capped'),
  review_prompt_version: string,
  cost_usd: decimal,
  duration_ms: int,
  finding_counts: json,                         // { blocker, major, minor, nit, info }
  trajectory_id: uuid?,                         // FK to trajectories (Obj 33)
  completed_at: timestamp?,
}
indexes: [workspace_id, app_id, _created_at DESC], [repo_full_name, pr_number]

findings: {
  ...standardColumns,
  review_id: uuid,                              // FK to reviews
  workspace_id: uuid,
  prompt_id: string,
  prompt_version: string,
  category: string,
  severity: enum('blocker', 'major', 'minor', 'nit', 'info'),
  file_path: string,
  start_line: int,
  end_line: int,
  rationale: text,
  suggested_fix_patch: text?,
  suggested_fix_confidence: decimal?,
  status: enum('posted', 'acknowledged', 'dismissed', 'applied', 'resolved'),
  vcs_comment_id: string?,
  dismissed_with_reason: text?,
  dismissed_at: timestamp?,
  dismissed_by_user_id: uuid?,
  applied_at: timestamp?,
  applied_by_user_id: uuid?,
  resulting_commit_sha: char(40)?,
}
indexes: [review_id, status], [workspace_id, severity, status, _created_at DESC]

pre_merge_checks: {
  ...standardColumns,
  workspace_id: uuid,
  name: string,
  body: text,                                   // natural-language check
  current_version: string,                      // semver
  enforcement: enum('advisory', 'blocking'),
  status: enum('draft', 'active', 'inactive'),
  authored_by_user_id: uuid,
}
indexes: [workspace_id, status]

pre_merge_check_versions: {
  ...standardColumns,
  check_id: uuid,
  version: string,
  body: text,
  compiled_fragment: text,
  rationale: text,
}
unique: [check_id, version]

webhook_deliveries: {
  ...standardColumns,
  vcs_provider: enum,
  installation_id: string,
  delivery_id: string,
  event_type: string,
  signature_valid: boolean,
  body_hash: char(64),
  processed_at: timestamp?,
  outcome: enum('pending', 'processed', 'ignored', 'failed'),
  error: text?,
}
unique: [vcs_provider, delivery_id]
indexes: [outcome, _created_at]
```

### 6.7 Audit Events

```
vcs.installation_added
vcs.installation_suspended
vcs.installation_uninstalled
vcs.repo_mapped_to_app
vcs.user_mapped

review.queued
review.started
review.completed
review.failed
review.cost_capped

review.finding_posted
review.finding_acknowledged
review.finding_dismissed
review.finding_applied
review.finding_resolved

review.suggestion_applied (with patch + finding id)

pre_merge_check.created
pre_merge_check.activated
pre_merge_check.deactivated
pre_merge_check.dry_run

webhook.received
webhook.signature_invalid
webhook.replay_requested
```

### 6.8 Observability

```
platform_review_runs_total{workspace, app, status}                  — counter
platform_review_duration_seconds{stage}                              — histogram
platform_review_findings_total{workspace, severity, prompt}         — counter
platform_review_finding_lifecycle_total{transition}                 — counter
platform_review_suggestion_applied_total                             — counter
platform_review_cost_usd_total{workspace, app}                       — counter
platform_review_cost_capped_total{workspace}                         — counter
platform_review_files_skipped_total{reason}                          — counter
platform_review_skill_consumption_total{prompt}                      — counter

platform_premerge_check_dry_runs_total                               — counter
platform_premerge_check_compilations_total                           — counter

platform_vcs_webhook_received_total{provider, event}                 — counter
platform_vcs_webhook_signature_invalid_total                         — counter
platform_vcs_api_calls_total{provider, endpoint, status}             — counter
platform_vcs_api_duration_seconds                                    — histogram
```

Slow review (> 5min for under-100-file PRs) emits warnings. High signature-invalid rates emit alerts.

### 6.9 Operational Runbooks

New files in `docs/runbooks/`:

- `review-stuck-running.md` — review stuck in `running`; how to abort + requeue.
- `vcs-webhook-failure.md` — webhook delivery failures; replay procedure.
- `review-cost-cap-tuning.md` — workspace hitting cost cap repeatedly; tuning options.
- `false-positive-storm.md` — review prompt regression producing many false positives; rollback procedure.
- `vcs-installation-revoked.md` — workspace lost VCS access; reinstallation steps.
- `bot-commit-failed.md` — bot's apply-patch commit failed; diagnostics + escalation.

---

## 7. Implementation Order

1. **VcsPort interface and conformance tests.**
2. **vcs-github adapter** — webhook verification, PR + diff fetch, comment post/update/resolve, patch-as-commit, status check, list-open-PRs.
3. **vcs-gitlab / vcs-azure / vcs-bitbucket stub adapters** with tracked issues.
4. **VcsWebhookService** — receive, verify, normalize, enqueue.
5. **Database migrations** — installations, mappings, reviews, findings, checks, webhook deliveries.
6. **ReviewRepositoryPort + Postgres adapter**; stub MSSQL/Mongo with tracked issues.
7. **Codegraph context assembler** — artifact slicing, generated-vs-edited diff.
8. **Review prompts** — initial set in `packages/core/src/ai/prompts/code-review/` (orchestrator, plus per-language/per-stage review prompts).
9. **Prompt eval suites** for review prompts (golden inputs, golden outputs).
10. **ReviewOrchestratorService** — wire prompts, skill ranking (Obj 33), trajectory recording (Obj 33).
11. **FindingService** — lifecycle, dismissal-to-skill-candidate.
12. **PreMergeCheckService** — authoring, compilation, dry-run, activation.
13. **Suggested-fix application** — confidence threshold, patch validation, bot commit.
14. **Per-PR review state** — incremental re-review on push, finding reconciliation.
15. **Cost containment** — per-PR cap, file prioritization, skip rules.
16. **Catch-up scan job** for open-PR drift.
17. **Authorization** — new permissions wired into AuthorizationPort.
18. **VCS configuration UI** — install GitHub App, map repos to apps, map users.
19. **Review UI** — review status per PR, finding browser, dry-run results for pre-merge checks.
20. **MSSQL + Mongo adapter implementations**; cross-database conformance.
21. **Observability** — metrics, dashboards, runbooks.
22. **Documentation** — ADRs, runbooks, review prompt authoring guide.
23. **Verify Definition of Done.**

---

## 8. ADRs to Write

- **ADR-0289: VcsPort Boundary** — what GitHub-specific concepts the port hides; what it preserves.
- **ADR-0290: Codegraph as Existing Artifacts, Not a Separate Index** — why no embedding store; staleness model.
- **ADR-0291: Generated-vs-Edited Diff Detection** — leveraging the platform's baseline knowledge as a review advantage.
- **ADR-0292: Suggested-Fix Confidence Threshold (0.85)** — why the bar is high; the cost of false applications.
- **ADR-0293: Learnings as Workspace Skills (Reuse of Objective 33)** — why one mechanism, not two.
- **ADR-0294: Pre-Merge Checks as Compiled Prompt Fragments** — why natural language with versioned compilation.
- **ADR-0295: Review Prompts at temperature=0** — determinism over creativity in code review.
- **ADR-0296: Bot User Authoring Boundary** — the platform never impersonates humans; co-authored-by trailers credit triggers.
- **ADR-0297: Per-PR Cost Cap and File Prioritization** — runaway-cost prevention; how files are ranked.
- **ADR-0298: GitHub-First, VCS-Agnostic Port** — why one adapter at v1 with the others as stubs.

---

## 9. Verification Steps

1. **GitHub App installation** — workspace admin installs the app; `vcs_installations` record created; signature secret stored via SecretStorePort.
2. **Webhook signature verification** — valid signature accepted; invalid rejected; metrics increment.
3. **PR opened** — webhook received; review enqueued; status check posted as `in_progress`.
4. **Codegraph assembly** — review context contains the app's PRD, schema, tokens, baseline, coverage, conventions.
5. **Generated-vs-edited diff** — file with AI baseline produces a diff against baseline; file without baseline produces standard PR diff.
6. **Review run produces trajectory** — `trajectory_id` populated on the review; trajectory hydrates correctly.
7. **Findings posted** — review produces findings; each posted as inline comment via VcsPort.
8. **Status check transitions** — review with no blockers → `success`; review with blockers (and workspace blocks-on-blocker) → `failure`.
9. **Acknowledge finding** — workspace user acknowledges; lifecycle transitions; audit event fires.
10. **Dismiss finding with reason** — dismissal → SkillCandidate created in workspace; admin can promote.
11. **Dismiss finding without reason** — empty reason: no SkillCandidate created.
12. **Apply suggested fix (high confidence)** — confidence ≥ 0.85; "Apply" available; clicking creates a bot commit on PR branch; co-authored-by trailer credits triggering user.
13. **Apply suggested fix (low confidence)** — confidence < 0.85; "Apply" not available; suggestion shown as text only.
14. **Apply when patch no longer applies** — PR pushed since suggestion; apply attempt fails with clear error.
15. **Pre-merge check authoring** — workspace admin creates a check; status `draft`; can dry-run.
16. **Pre-merge check dry-run** — runs check against recent PRs; reports findings without posting.
17. **Pre-merge check activation** — admin activates; subsequent reviews include the compiled fragment.
18. **Pre-merge check enforcement (blocking)** — blocking check + violating PR → status check fails; merge gated per workspace policy.
19. **Incremental re-review on push** — pushing a single file: only that file + transitive deps reviewed; cost lower than initial review.
20. **Force-push triggers full re-review** — PR head force-pushed; full re-review runs; prior findings reconciled correctly.
21. **Acknowledged findings persist across re-review** — acknowledged on first review; same finding identity present on re-review → not re-posted.
22. **Cost cap reached** — synthetic large PR exceeds workspace cost cap; review halts; `cost_capped` finding posted; partial findings preserved.
23. **Skill consumed in review** — workspace has an active code-review skill; review trajectory's `skillsConsumed` includes it; finding output reflects the learning.
24. **Determinism** — same PR head, same skill set, same prompt version: two consecutive review runs produce identical findings.
25. **Catch-up scan recovers missed review** — open PR with no review record → scan enqueues review.
26. **Webhook replay** — admin replays a delivery id; review re-runs idempotently.
27. **VCS user mapping** — GitHub user maps to platform user; finding dismissals attribute to platform user.
28. **Authorization** — `review.dismiss` permission required to dismiss; absent permission returns Forbidden.
29. **GitHub App uninstall** — installation status → `uninstalled`; subsequent webhook deliveries dropped; existing review records preserved as historical.
30. **Cross-database conformance** — reviews, findings, pre_merge_checks, webhook_deliveries work identically on Postgres, MSSQL, Mongo.

If all 30 pass, the objective is met.

---

## 10. Definition of Done

**Ports & Adapters**

- [ ] VcsPort defined with conformance tests
- [ ] vcs-github adapter (full)
- [ ] vcs-gitlab / vcs-azure / vcs-bitbucket stub adapters with tracked issues
- [ ] ReviewRepositoryPort defined with conformance tests
- [ ] reviewrepo-postgres / mssql / mongo

**Services**

- [ ] VcsWebhookService (receive, verify, replay, catch-up)
- [ ] ReviewOrchestratorService (run, get, list)
- [ ] FindingService (list, acknowledge, dismiss, apply)
- [ ] PreMergeCheckService (CRUD, compile, dry-run, activate)

**Database Schema**

- [ ] All tables migrated on all three databases
- [ ] Indexes verified

**Codegraph & Review**

- [ ] Codegraph context assembly with diff-scoped slicing
- [ ] Generated-vs-edited diff detection
- [ ] Review prompt set authored with eval suites
- [ ] Review prompts at temperature=0
- [ ] Per-PR review state with incremental re-review
- [ ] Force-push triggers full re-review

**Findings & Suggestions**

- [ ] Inline comment posting via VcsPort
- [ ] Lifecycle (acknowledge / dismiss / apply / resolved)
- [ ] Suggested-fix confidence threshold (0.85)
- [ ] 1-click apply with patch validation
- [ ] Bot commit authoring with co-authored-by trailer
- [ ] Status check setting

**Learnings via Skills**

- [ ] Dismissal-with-reason creates SkillCandidate
- [ ] Empty reason: no candidate created
- [ ] Skill consumption recorded in review trajectory

**Pre-Merge Checks**

- [ ] Natural-language authoring
- [ ] Compilation to prompt fragments (cached)
- [ ] Dry-run mode
- [ ] Activation / deactivation
- [ ] Advisory + blocking enforcement modes

**Cost Containment**

- [ ] Per-PR cost cap
- [ ] File prioritization on cap
- [ ] Skip rules for vendored / generated / binary
- [ ] Token-budget pre-flight

**Reliability**

- [ ] Webhook signature verification
- [ ] Idempotent delivery processing
- [ ] Replay endpoint
- [ ] Catch-up scan job
- [ ] Per-PR FIFO ordering

**Authorization**

- [ ] `vcs.configure`, `review.dismiss`, `review.author_check`, `review.suggest_apply` permissions
- [ ] All service methods authorize early

**UI**

- [ ] VCS configuration (install, map repos, map users)
- [ ] Review status per PR
- [ ] Finding browser
- [ ] Pre-merge check authoring + dry-run

**Audit & Observability**

- [ ] All audit events emitted
- [ ] All metrics emitted
- [ ] Grafana dashboards for review activity

**CI Gates (per Objective 20 discipline)**

- [ ] **Review-prompt eval suite** runs in CI; regressions block merge.
- [ ] **Determinism test** — golden review against fixed PR head produces identical findings across runs.
- [ ] **Per-prompt cost-regression budget** (per ADR-0161 from Obj 20) applies to review prompts.

**Documentation**

- [ ] ADRs 0289–0298 written and Accepted
- [ ] All runbooks in Section 6.9 written
- [ ] Review prompt authoring guide
- [ ] Pre-merge check authoring guide
- [ ] VCS configuration guide

**Verification**

- [ ] All 30 verification steps in Section 9 pass

---

## 11. Anti-Patterns to Refuse

- **Building a separate codebase index.** The platform's artifacts are the codegraph. No embedding store, no separate ingestion pipeline.
- **Auto-applying suggested fixes without confidence threshold.** 0.85 minimum. False applications are worse than missing ones.
- **Force-pushing or amending PR commits when applying suggestions.** Always a new commit.
- **Impersonating human users.** The bot authors; humans get co-authored-by attribution.
- **Reviewing the entire PR on every push.** Incremental re-review; full re-review only on force-push or merge-base change.
- **Letting one PR consume an entire workspace's monthly budget.** Per-PR cost cap with workspace override.
- **Posting the same finding repeatedly across pushes.** Reconciliation respects acknowledged + dismissed.
- **Running review prompts at temperature > 0.** Determinism is non-negotiable for review.
- **Treating learnings as opaque tuning state.** Learnings are workspace skills (Obj 33) — versioned, audited, reviewed.
- **Compiling pre-merge checks once and never re-validating.** Cache by check version + prompt version; recompile on either change.
- **Skipping signature verification "just for development."** No exemptions; mandatory always.
- **Building cross-PR pattern detection at v1.** Out of scope; revisit when the data substrate exists.
- **Reviewing arbitrary external repos at v1.** Only platform-generated apps; reviewing arbitrary repos requires a different ingestion model.

---

## 12. Open Questions for Confirmation Before Starting

1. **GitHub-only at v1** — confirmed (per plan). Stub adapters with tracked issues.
2. **Suggested-fix confidence threshold (0.85)** — calibrated by gut. Should we tune based on early production data?
3. **Per-PR cost cap default** — proposing `monthly_budget_usd / 100`. For a $50/month workspace that's $0.50/PR — may be too low for large PRs. Acceptable starting default with workspace override?
4. **Default severity that blocks merge** — proposing `blocker` only. Some workspaces may want `major` to block. Workspace setting confirms control.
5. **Dismissal-with-reason → SkillCandidate** — automatic candidate creation? Or require an explicit "create skill from this dismissal" action? Proposing automatic; admin can dismiss the candidate cheaply.
6. **Pre-merge check default enforcement** — proposing `advisory` (informational) by default. Workspace admin opts into `blocking`. Acceptable?
7. **Review of human-authored-from-scratch files** — we review them with PRD context but no baseline. Worth shipping at v1, or scope to AI-generated files only at v1?

---

## 13. What Comes Next

With Objective 34 complete, every PR against a platform-generated app receives AI review tuned to that app's specification, with workspace-tunable learnings, cost-bounded, deterministic, and audited. The platform's edge over generic AI review is the codegraph it already has.

**Objective 35 (Eval & Replay Harness)** consumes review trajectories the same way it consumes generation trajectories — replay across providers, regression-test review prompts, grade reasoning quality.

**Objective 36 (IDE & CLI)** can expose review run + finding management to a developer's local environment: trigger review locally, browse findings without leaving the editor, dismiss with reason.

The Obj 30 (Maintenance & Evolution) AutoFix loop noted in the addon plan picks up here too: a production signal becomes a maintenance task, a generation produces a fix, the fix lands as a PR, and Obj 34 reviews that PR — closing the loop with human review at the only point that needs it.

---

_This document is the contract. Every checkbox in Section 10 must be true before any review prompt ships to production._
