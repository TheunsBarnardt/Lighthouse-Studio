# Objective 33: Skill Promotion & Trajectory Library

**Status:** Ready for development
**Prerequisites:** Objective 20 (AI Pipeline Foundation) complete; Objectives 21–30 (all pipeline stages) complete; Objective 7 (Audit & Compliance) for the publish-flow audit trail
**Blocks:** Objective 35 (Eval & Replay Harness — needs trajectory storage); meaningfully extends Objectives 22–28 (every stage that produces artifacts becomes capable of contributing skills)

---

## 1. Purpose

The AI Build Pipeline (Objectives 20–30) generates every artifact from scratch on every run: PRD prompts run as if no PRD has ever been written; schema synthesis prompts run as if no schema has ever been generated. The reasoning, the few-shot examples, and the prompt are static; the workspace's accumulated experience — the things its team has approved, edited heavily, or rejected — does not feed back into future generations.

The risk this leaves on the table is real: every workspace pays full token cost forever, the platform never learns from what's actually approved, and "this PRD pattern has worked for us before" is a thing humans remember but the platform does not. Hermes Agent's pattern of skill-as-procedural-memory addresses this; CodeRabbit's "Learnings" pattern (Objective 34) is the same idea applied to review. This objective produces the **disciplined version**: skills are not auto-mutated in production, are explicitly promoted by humans, are versioned like code, and are scoped two-tier (workspace-private by default, platform-wide only via deliberate publication).

The other thing this objective produces is the **trajectory library** — a compressed, queryable record of every approved generation's full input → reasoning → output chain. This unblocks Objective 35 (replay across providers, regression testing on real history) and creates the substrate for future fine-tuning datasets without committing to any specific training pipeline now.

---

## 2. Scope

### In Scope

- **Skill artifact type**: a first-class artifact with stable identity, version history, scope, and lifecycle, sitting alongside existing artifact types from Objective 20
- **Workspace-scoped skills**: created from within a workspace; visible only to that workspace
- **Platform-wide skills**: published from a workspace skill via explicit platform-admin approval; visible to all workspaces; opt-in per workspace
- **Promotion candidates**: the platform surfaces high-quality artifacts (low rejection count, approved first submit, low edits-after-generation) as _candidate skills_ for a workspace admin to review
- **Explicit promotion flow**: a workspace admin reviews the candidate, edits its template if needed, and promotes it; this is a deliberate human action, never automatic
- **Skill versioning**: semver per skill, like prompts; bumping the version is a deliberate act
- **Skill referencing in prompts**: prompt orchestrators opt-in per-prompt to consume skills as few-shot exemplars or as templates to specialize
- **Skill scoping in generation**: when a generation runs, the orchestrator queries skills relevant to the (stage, type, workspace) and includes the top-K
- **Trajectory storage**: every generation that produces an approved artifact records a compressed trajectory (input, redacted prompt, response, reasoning, tool calls)
- **Trajectory compression**: structured deduplication of repeated upstream artifact content; references over copies
- **Publish flow**: an explicit action that takes a workspace skill, strips workspace-specific data (names, IDs, PII residue, custom domain language), submits it for platform-admin review, and on approval publishes as platform-wide
- **Skill audit**: every promotion, version bump, publish, retraction, and consumption is audited
- **Skill UI**: a skill library inside the AI pipeline app — list, view, edit template, version history, promote/retract, publish-request
- **Cross-workspace consumption**: a workspace can opt in to platform-wide skills per-prompt-orchestrator, defaulting off
- **Skill retraction**: a workspace can retract a skill (no future references); a platform admin can retract a published skill (propagates to consumers as a non-breaking soft-deprecation)
- ADRs

### Out of Scope (Belongs to Later Objectives or Explicitly Refused)

- **Autonomous skill creation or mutation in production.** Skills change only via deliberate human promotion, version bumps, or retractions. (Refusing the Hermes self-improvement default.)
- **Cross-workspace skill leakage by default.** Without explicit publication, a workspace skill stays in the workspace.
- **Fine-tuning pipeline.** Trajectories are stored in a form that _could_ feed fine-tuning later, but training is deferred. (Objective 20 already excluded fine-tuning.)
- **Replaying trajectories.** Storage only; replay belongs to Objective 35.
- **Skill marketplace, skill ratings, social features.** Out of product scope.
- **Skill recommendations across workspaces.** A workspace's skills inform that workspace's generations. Cross-pollination happens only via the publish flow.
- **Auto-tuning of prompt few-shot selection beyond top-K relevance.** No learned ranker, no embedding retrieval, no RL. Top-K is deterministic given (stage, type, recency, quality outcome). Smarter retrieval is a future revision, not v1.
- **Skill diff/merge tooling.** Skills are versioned, not merged; competing edits resolve via the existing artifact lifecycle.

---

## 3. Locked Decisions

| Decision                                      | Choice                                                                                                                                                           | Rationale                                                                |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Skill is a first-class artifact               | Skills extend the artifact model from Objective 20; same lifecycle, same reasoning capture, same audit                                                           | One noun for everything AI-touched; reuses every existing system         |
| Skill scope                                   | Two-tier: workspace-scoped (default) and platform-wide (via publish flow)                                                                                        | Workspace privacy by default; platform-wide value when explicitly chosen |
| Cross-workspace publication                   | Platform-admin approval only; explicit `publish` action from a workspace admin; sanitization step required                                                       | Privacy + quality control                                                |
| Workspace consumption of platform-wide skills | Opt-in per prompt orchestrator; defaults to off                                                                                                                  | No surprises in workspace generations                                    |
| Skill versioning                              | Semver per skill; major bumps require an ADR-style rationale embedded in the skill record                                                                        | Same discipline as prompts                                               |
| Promotion model                               | Candidate-then-promote: the platform surfaces candidates from quality signals; a human explicitly promotes                                                       | No silent self-mutation; reviewable                                      |
| Candidate threshold                           | `approved_first_pass` AND `revision_count == 0` AND `edit_distance / output_length < 0.05` AND `time_to_approval_seconds < workspace_median * 0.5`               | Conservative — only surfaces clear wins; tunable per workspace           |
| Skill retraction                              | Soft-deprecation: existing references continue to function; new generations skip retracted skills; workspace sees a banner                                       | Don't break in-flight work                                               |
| Trajectory storage                            | Same database as artifacts; per-workspace logical isolation; references upstream artifact content rather than copying                                            | Consistent with Objective 20; minimizes storage growth                   |
| Trajectory retention                          | Indefinite for approved artifacts; 90 days for rejected/abandoned trajectories                                                                                   | Cost discipline + signal preservation                                    |
| Trajectory compression format                 | JSON with content-addressed references to upstream artifacts; gzip at rest                                                                                       | Queryable + compact                                                      |
| Trajectory contains PII?                      | Inherits from the source generation: redacted prompts stay redacted in the trajectory; opt-in unredacted workspaces store unredacted trajectories                | Same policy as Objective 20; no separate PII regime                      |
| Skill content sanitization on publish         | Mandatory pass: workspace IDs, user IDs, custom domain terms (registered per workspace), and PII columns redacted to placeholders                                | Prevents accidental leakage                                              |
| Skill orchestrator integration                | Each prompt declares which skill types it consumes; the orchestrator queries top-K relevant skills and renders them as few-shot or template-specialization input | Explicit, per-prompt; never opaque                                       |
| Skill ranking for top-K                       | Deterministic: workspace skills first, then opted-in platform-wide skills; within each tier, sort by (recency-weighted approval rate, then version) descending   | Reproducible; no learned ranker                                          |
| Top-K default                                 | K=3 for few-shot exemplars, K=1 for template specialization; per-prompt override                                                                                 | Few-shot benefit plateaus; specialization conflicts above K=1            |
| Skill schema validation                       | Skills carry an output schema reference matching the prompt(s) they apply to; mismatch is a publish-time error                                                   | Prevents runtime breakage from schema drift                              |
| Audit events                                  | `skill.candidate_surfaced`, `skill.promoted`, `skill.version_bumped`, `skill.publish_requested`, `skill.published`, `skill.retracted`, `skill.consumed`          | Same audit discipline as Objective 7                                     |
| Authorization                                 | New permissions: `skill.read`, `skill.promote`, `skill.publish_request`, `skill.retract`; platform-admin permission `skill.publish_approve`                      | Per Objective 6 RBAC                                                     |

---

## 4. Architectural Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                      AI BUILD PIPELINE STAGES                         │
│                                                                       │
│  Stage 2 (PRD), Stage 4 (Schema), Stage 6 (UI), Stage 7 (Code), ...   │
│                                                                       │
│  Each prompt orchestrator that opts in:                                │
│  - Queries SkillService for top-K relevant skills                      │
│  - Renders skills as few-shot exemplars or template specialization     │
│  - Records skill consumption in the trajectory                         │
└─────────────────────────────────┬────────────────────────────────────┘
                                  │
                                  ▼
        ┌──────────────────────────────────────────────────┐
        │       Skill & Trajectory Layer (this objective)   │
        │                                                    │
        │   Services:                                        │
        │   - SkillService (CRUD + lifecycle)                │
        │   - SkillCandidateService (quality-signal scan)    │
        │   - SkillPublishingService (workspace → platform)  │
        │   - TrajectoryService (record + query)             │
        │                                                    │
        │   Ports:                                            │
        │   - SkillRepositoryPort                            │
        │   - TrajectoryRepositoryPort                       │
        │   - SkillSanitizerPort (publish-time scrubbing)    │
        │                                                    │
        │   Adapters:                                         │
        │   - skillrepo-postgres / mssql / mongo             │
        │   - trajectoryrepo-postgres / mssql / mongo        │
        │   - skillsanitizer-default                         │
        └──────────────────────────────────────────────────┘
                                  │
                                  ▼
        ┌──────────────────────────────────────────────────┐
        │   Foundation services (already complete):          │
        │   - ArtifactService (Objective 20)                  │
        │   - PromptService (Objective 20)                    │
        │   - GenerationService (Objective 20)                │
        │   - AuthorizationPort (Objective 6)                 │
        │   - AuditPort (Objective 7)                         │
        │   - PersonalDataRegistry (Objective 7)              │
        │   - ApprovalRoutingEngine (Objective 6)             │
        └──────────────────────────────────────────────────┘
```

The publish flow integrates with the existing approval routing engine: workspace skill → publish request → platform-admin approval queue → on approval, sanitization runs → published as platform-wide skill.

---

## 5. The Hard Parts

**5.1 The skill model — distinct from the artifact that produced it**

A common mistake would be treating "an approved artifact" and "a skill derived from it" as the same record. They aren't. The artifact is a workspace's actual deliverable (their PRD, their schema). The skill is a _generalized template_ extracted from it: the structural patterns, the section ordering, the vocabulary preferences, the implicit conventions. Skills generalize; artifacts particularize.

```typescript
export interface Skill {
  id: string; // UUID v7; survives renames and edits
  scope: 'workspace' | 'platform';
  workspaceId: string | null; // null for platform-wide skills
  publishedFromSkillId: string | null; // for platform skills, points to source workspace skill
  publishedFromWorkspaceId: string | null;

  appliesTo: SkillApplicability; // (stage, artifact type, prompt id pattern)
  kind: 'few_shot_exemplar' | 'template_specialization';

  status: 'draft' | 'active' | 'retracted';
  currentVersion: string; // semver

  template: SkillTemplate; // the actual generalized content
  sourceArtifactId: string; // the artifact this was promoted from
  sanitizationLog?: SanitizationRecord[]; // platform-wide skills only

  qualityRollup: SkillQualityRollup; // aggregate quality signals from generations that used this skill
  reasoning: ReasoningRecord; // why this skill exists; why this template; what it generalizes

  createdAt: Date;
  updatedAt: Date;
  promotedByUserId: string;
  retractedAt?: Date;
  retractedByUserId?: string;
  retractionReason?: string;
}

export interface SkillApplicability {
  stage: StageName; // 'prd', 'schema_synthesis', etc.
  artifactType: string; // 'prd_section', 'token_set', etc.
  promptIdPattern: string; // 'prd_generation.*' or specific prompt id
  outputSchemaRef: string; // schema this skill's output matches; mismatch = error
}

export interface SkillTemplate {
  // Discriminated by kind:
  // few_shot_exemplar: { exampleInput, exampleOutput, exampleReasoning }
  // template_specialization: { templateBody, slotsToFill, conventions }
}

export interface SkillQualityRollup {
  consumptionCount: number;
  acceptedFirstPassCount: number;
  acceptedAfterRevisionsCount: number;
  rejectedCount: number;
  averageEditDistance: number;
  lastConsumedAt: Date | null;
}
```

The skill is its own first-class entity, audited independently, versioned independently. When the source artifact is later edited or archived, the skill remains — it captured a moment-in-time generalization.

**5.2 The candidate-then-promote flow**

The Hermes anti-pattern this objective explicitly refuses is autonomous mutation: "the agent learned, so the agent now behaves differently." That's opaque and unreviewable. Instead:

```
1. An artifact is approved.
2. Quality signals are recorded (Objective 20 already does this).
3. Periodically (nightly job), SkillCandidateService scans new artifact_quality_records
   for ones meeting the candidate threshold.
4. For each candidate, a `skill.candidate_surfaced` event is emitted.
5. The skill library UI shows pending candidates to workspace admins.
6. The admin reviews, edits the proposed template, fills in reasoning, and promotes.
7. The skill becomes 'active' at version 1.0.0.
```

The candidate is _proposed_, never auto-promoted. The admin can dismiss it. Dismissed candidates do not resurface unless the underlying artifact is approved again after edits (the new approval is a new candidate event).

The candidate threshold (locked in §3) is conservative on purpose — it surfaces only clear wins. Workspaces can adjust the threshold via workspace settings (looser threshold = more candidates, more noise; stricter = fewer candidates, lower signal-to-noise). The default is tuned to surface roughly one candidate per 20–30 approved artifacts.

**5.3 The publish flow — sanitization is the security frontier**

Publishing a workspace skill as platform-wide is the moment workspace data could leak. The sanitization pass is the line of defense, and it must be conservative.

```
SkillPublishingService.requestPublish(ctx, skillId)
  ↓
1. Load the skill.
2. Run SkillSanitizerPort.sanitize(skill, workspaceId):
   a. Replace workspace-specific names (workspace name, project codenames) with placeholders.
   b. Replace user IDs and email addresses (already redacted if PII redaction is on; double-check).
   c. Replace custom domain terms registered per workspace (a "domain glossary" the workspace maintains).
   d. Strip any field matching the personal data registry from Objective 7.
   e. Reject if the sanitized skill is materially shorter than the original (heuristic: >40% shrinkage = too much customer-specific content).
3. Produce SanitizedSkill + SanitizationLog.
4. Emit `skill.publish_requested`.
5. Route to platform-admin approval queue (via ApprovalRoutingEngine, system-level routing rule).
6. Platform admin reviews:
   - Sanitized template
   - Sanitization log (what was redacted)
   - Source workspace skill quality rollup
   - Source workspace's consent confirmation
7. On approval: a new platform-scoped Skill record is created with `publishedFromSkillId` and `publishedFromWorkspaceId` populated. Audit event `skill.published`.
8. On rejection: emit `skill.publish_rejected` with reason; source workspace can edit and resubmit.
```

Two safeguards beyond sanitization:

- **Source workspace consent.** The workspace admin promoting the skill confirms publication intent. A workspace can mark itself as "no skills will ever be published from this workspace" — a hard gate on the publish flow regardless of admin action.
- **Platform admin verification.** The admin sees the sanitization log and can reject if the template still contains workspace-identifying language the sanitizer missed. This is a human review of an automated pass, not a replacement for it.

**5.4 Trajectory storage — references, not copies**

Naive trajectory storage (every generation captures the full upstream artifact contents inline) explodes on storage. A PRD generation in Stage 2 references the Intent Brief from Stage 1; a Schema Synthesis in Stage 4 references the PRD from Stage 2; a Code Generation in Stage 7 references all of them. If trajectories copy upstream content, late-stage trajectories balloon.

Instead, trajectories use content-addressed references:

```typescript
export interface Trajectory {
  id: string;
  workspaceId: string;
  artifactId: string; // the artifact this trajectory produced
  promptId: string;
  promptVersion: string;
  provider: string;
  model: string;

  upstreamArtifactRefs: ArtifactRef[]; // references, not copies
  inputsHash: string; // sha-256 of (promptId@version, upstream refs, runtime inputs)

  renderedSystemPrompt: string; // the system prompt as sent (post-redaction)
  renderedUserPrompt: string; // the user prompt as sent (post-redaction)
  toolCalls: ToolCallRecord[]; // ordered; each has parameters, response, duration
  rawResponse: string; // the model's full response text
  parsedOutput: unknown; // the validated structured output
  reasoning: ReasoningRecord; // already in the artifact; duplicated here for self-contained replay
  skillsConsumed: SkillConsumption[]; // which skills informed this generation

  outcome: 'approved_first_pass' | 'approved_after_revisions' | 'rejected' | 'abandoned';
  costUsd: string; // decimal as string
  inputTokens: number;
  outputTokens: number;
  toolUseTokens: number;
  durationMs: number;
  createdAt: Date;
  retainUntil: Date; // 90 days for non-approved, null for approved
}

export interface ArtifactRef {
  artifactId: string;
  version: number; // pinned version; immutable snapshot
  contentHash: string; // sha-256 of the artifact content at this version
}
```

Replay (Objective 35) reconstructs the full inputs from refs by reading the pinned artifact versions. Since Objective 20 mandates immutable artifact_versions, refs are stable forever.

Compression at rest: gzip on the JSON column. Indexes only on the columns that filter (workspace_id, prompt_id, prompt_version, outcome, created_at).

**5.5 Skill consumption and the `skillsConsumed` record**

When a generation runs and consumes skills, the trajectory records _which_ skills informed it. This is critical:

- For quality attribution: when an artifact gets approved or rejected, the rollup updates the consumed skills' quality stats.
- For impact analysis: retracting a skill is safe to recommend if the consumption history shows the skill correlated with high rejection rates.
- For replay: reproducing a generation requires the same skill set; if a skill has been retracted, replay must either use the snapshotted skill version or fail loudly.

```typescript
export interface SkillConsumption {
  skillId: string;
  skillVersion: string;
  skillScope: 'workspace' | 'platform';
  rank: number; // 1-based; rank in the top-K
  renderedAs: 'few_shot_exemplar' | 'template_specialization';
}
```

The skill version is pinned at consumption time. Replay later — even after the skill has been version-bumped — uses the version that was actually consumed.

**5.6 Determinism and the skill-ranker**

Skills feed into prompts as input. If skill selection is non-deterministic, prompt-level determinism (Objective 20's `temperature: 0` discipline, ADR-0159's nightly verification) breaks. The ranker must be deterministic given the inputs.

The ranker is:

```
candidateSkills = workspace_skills(stage, artifact_type, prompt_id) ∪ opted_in_platform_skills(stage, ...)
filtered = candidateSkills.filter(active && schemaCompatible)
ranked = sort(filtered, by:
  scopePriority,                      // workspace before platform
  qualityRollup.recency_weighted_approval_rate desc,
  currentVersion desc,
  skillId asc                         // deterministic tiebreak
)
return ranked.take(K)
```

No randomness. No embedding similarity (deferred — would add a dependency on a vector store and is not necessary for v1). No learned ranker. The same workspace + same prompt + same skill set = the same top-K, every time.

Recency weighting: a skill consumed within the last 30 days weights higher than one not consumed in 6 months. This privileges live conventions over stale ones without being non-deterministic.

**5.7 Retraction propagation**

A workspace skill is retracted: future generations in that workspace skip it; existing trajectories continue to reference the snapshotted version (replay still works).

A platform-wide skill is retracted: more delicate. Two cases:

1. **Soft retraction** (default): the skill is marked retracted, the workspace's prompt orchestrators stop including it in new generations, an audit event fires, and a banner notifies opted-in workspaces. Existing trajectories still reference the old version; replay works.
2. **Hard retraction** (rare; requires platform-admin justification ADR): the skill record is marked `purge_pending`, a 30-day grace period runs during which trajectories referencing it are flagged, and after the grace period the skill content is replaced with a tombstone. Replay of trajectories referencing a tombstoned skill fails with a typed error.

Hard retraction exists for one reason: a published platform-wide skill is later discovered to have leaked workspace-specific content despite sanitization. The grace period gives time to notify; the tombstone prevents continued exposure.

**5.8 Schema compatibility checks**

A skill declares `outputSchemaRef` — the schema its generalized template produces. The prompt orchestrator that consumes the skill also has an output schema. If the schemas drift (the prompt's output shape changes; the skill was promoted under the old shape), the skill becomes incompatible.

Compatibility check runs at three points:

1. **Promotion time**: the skill template is rendered against the current prompt; if the output doesn't match the prompt's current schema, promotion fails.
2. **Publish time**: same check, but with the platform-wide audience in mind.
3. **Generation time**: when ranking skills for a top-K, schema-incompatible skills are filtered out and an audit warning emits. This handles the case where a prompt's schema changed after the skill was promoted.

Schema-incompatible skills don't auto-update; the workspace admin must promote a new version against the new schema. This keeps schema evolution explicit.

**5.9 Storage growth and tier separation**

Trajectories grow monotonically. A workspace producing 500 approved artifacts a month, each with ~30 KB of trajectory data (post-compression), generates ~15 MB/month — small at first, real over years. Decisions:

- **Approved-artifact trajectories: indefinite retention.** This is the asset.
- **Non-approved trajectories: 90-day retention.** Long enough to investigate quality regressions; short enough to prevent unbounded growth.
- **Hot vs. cold tier: not yet.** Tier separation (recent in fast storage, old in cheap object storage) is deferred until a workspace shows usage warranting it. Premature optimization otherwise.

Storage growth metrics are surfaced in admin dashboards; thresholds emit warnings.

**5.10 The "did this skill help?" feedback loop**

Every consumption-then-outcome cycle updates the skill's quality rollup:

```
generation outcome = approved_first_pass → rollup.acceptedFirstPassCount++
generation outcome = approved_after_revisions → rollup.acceptedAfterRevisionsCount++
generation outcome = rejected → rollup.rejectedCount++
edit_distance → rolling average
```

If a skill's rolling rejection rate exceeds a threshold (default: 30% over the last 50 consumptions), the skill is auto-flagged for review. The workspace admin sees a dashboard alert; the skill remains active but flagged. This is a _signal_, not an action — the platform refuses to retract autonomously.

Surface this in:

- Workspace skill library: per-skill quality rollup, flag indicators.
- Platform-wide skills page: aggregated quality rollup across opted-in workspaces.
- Per-prompt dashboards (Objective 20's quality dashboards): which skills correlate with which outcomes.

**5.11 Anti-pattern: skills as a backdoor for prompt mutation**

Without discipline, skills become a way to mutate prompt behavior in production without going through code review: a workspace promotes a skill, that skill becomes few-shot input to a prompt, the prompt's effective behavior changes. This is _desired_ at the workspace scope (the workspace is intentionally specializing for itself). It is _not desired_ at the platform scope (platform-wide skills affect every opted-in workspace and should go through the same review discipline as prompts).

Mitigation: platform-wide skill publication requires platform-admin review (already locked). Additionally, platform-wide skills are versioned and listed in the same prompt-iteration runbook as prompt versions. A platform-wide skill change is a deliberate platform-level act; it doesn't happen quietly.

---

## 6. Component Specifications

### 6.1 SkillService

```typescript
// packages/core/src/services/ai/skill.service.ts

export class SkillService {
  // CRUD
  async create(ctx: RequestContext, input: CreateSkillInput): Promise<Result<Skill, AppError>>;
  async get(ctx: RequestContext, skillId: string): Promise<Result<Skill, AppError>>;
  async listForWorkspace(ctx: RequestContext, opts: ListSkillsOptions): Promise<Result<PaginatedResult<Skill>, AppError>>;
  async listPlatformSkills(ctx: RequestContext, opts: ListSkillsOptions): Promise<Result<PaginatedResult<Skill>, AppError>>;
  async update(ctx: RequestContext, skillId: string, changes: SkillUpdate): Promise<Result<Skill, AppError>>;

  // Lifecycle
  async promoteFromCandidate(ctx: RequestContext, candidateId: string, edits: SkillTemplateEdits): Promise<Result<Skill, AppError>>;
  async bumpVersion(ctx: RequestContext, skillId: string, kind: 'major' | 'minor' | 'patch', rationale: string, newTemplate: SkillTemplate): Promise<Result<Skill, AppError>>;
  async retract(ctx: RequestContext, skillId: string, reason: string): Promise<Result<void, AppError>>;

  // Ranking — called by GenerationService
  async getTopK(ctx: RequestContext, applicability: SkillApplicability, k: number): Promise<Result<Skill[], AppError>>;

  // Quality rollup — called by ArtifactService on outcome events
  async recordConsumptionOutcome(skillId: string, version: string, outcome: ArtifactOutcome, editDistance: number | null): Promise<Result<void, AppError>>;
}
```

### 6.2 SkillCandidateService

```typescript
export class SkillCandidateService {
  /** Nightly job: scan recent artifact_quality_records for promotion candidates. */
  async scanForCandidates(ctx: SystemContext): Promise<Result<CandidateScanReport, AppError>>;

  /** List pending candidates for a workspace. */
  async listPending(ctx: RequestContext): Promise<Result<SkillCandidate[], AppError>>;

  /** Dismiss a candidate (it doesn't resurface unless the source artifact is re-approved). */
  async dismiss(ctx: RequestContext, candidateId: string, reason: string): Promise<Result<void, AppError>>;

  /** Get the proposed template for a candidate (the platform's first draft of the generalized template). */
  async getProposedTemplate(ctx: RequestContext, candidateId: string): Promise<Result<SkillTemplate, AppError>>;
}
```

The proposed template is generated by an internal prompt: given the source artifact, its reasoning, and the prompt that produced it, generate a generalized few-shot exemplar or template specialization. The admin reviews and edits this proposal before promoting.

### 6.3 SkillPublishingService

```typescript
export class SkillPublishingService {
  /** Workspace admin requests publication of one of their skills. */
  async requestPublish(ctx: RequestContext, skillId: string, justification: string): Promise<Result<PublishRequest, AppError>>;

  /** Platform admin lists pending publish requests. */
  async listPendingRequests(ctx: RequestContext): Promise<Result<PublishRequest[], AppError>>;

  /** Platform admin approves; sanitization runs; published skill created. */
  async approvePublishRequest(ctx: RequestContext, requestId: string, comment?: string): Promise<Result<Skill, AppError>>;

  /** Platform admin rejects with reason. */
  async rejectPublishRequest(ctx: RequestContext, requestId: string, reason: string): Promise<Result<void, AppError>>;

  /** Platform admin retracts a published skill. */
  async retractPublished(ctx: RequestContext, skillId: string, reason: string, hardRetraction: boolean): Promise<Result<void, AppError>>;
}
```

### 6.4 TrajectoryService

```typescript
export class TrajectoryService {
  /** Record a trajectory; called by GenerationService at the end of a generation. */
  async record(ctx: RequestContext, input: RecordTrajectoryInput): Promise<Result<Trajectory, AppError>>;

  /** Get a trajectory by id. */
  async get(ctx: RequestContext, trajectoryId: string): Promise<Result<Trajectory, AppError>>;

  /** Query trajectories. */
  async query(ctx: RequestContext, q: TrajectoryQuery): Promise<Result<PaginatedResult<Trajectory>, AppError>>;

  /** Reconstruct full inputs from a trajectory's refs (needed for replay in Objective 35). */
  async hydrate(ctx: RequestContext, trajectoryId: string): Promise<Result<HydratedTrajectory, AppError>>;

  /** Update outcome when the artifact is approved/rejected/etc. */
  async updateOutcome(trajectoryId: string, outcome: ArtifactOutcome): Promise<Result<void, AppError>>;

  /** Background job: purge expired non-approved trajectories. */
  async purgeExpired(ctx: SystemContext): Promise<Result<PurgeReport, AppError>>;
}
```

### 6.5 Ports

```typescript
// packages/ports/ai-skills/src/skill-repository.port.ts
export interface SkillRepositoryPort {
  insert(skill: Skill): Promise<Result<Skill, AppError>>;
  findById(id: string): Promise<Result<Skill | null, AppError>>;
  findActiveByApplicability(scope: SkillScope, applicability: SkillApplicability): Promise<Result<Skill[], AppError>>;
  update(id: string, expectedVersion: string, changes: SkillUpdate): Promise<Result<Skill, AppError>>;
  insertVersion(skillId: string, version: SkillVersionRecord): Promise<Result<void, AppError>>;
}

// packages/ports/ai-trajectories/src/trajectory-repository.port.ts
export interface TrajectoryRepositoryPort {
  insert(trajectory: Trajectory): Promise<Result<Trajectory, AppError>>;
  findById(id: string): Promise<Result<Trajectory | null, AppError>>;
  query(q: TrajectoryQuery): Promise<Result<PaginatedResult<Trajectory>, AppError>>;
  updateOutcome(id: string, outcome: ArtifactOutcome): Promise<Result<void, AppError>>;
  deleteExpired(before: Date): Promise<Result<number, AppError>>;
}

// packages/ports/ai-skills/src/skill-sanitizer.port.ts
export interface SkillSanitizerPort {
  sanitize(skill: Skill, sourceWorkspaceId: string): Promise<Result<SanitizedSkill, AppError>>;
}
```

Adapters: Postgres / MSSQL / Mongo for both repositories, with conformance tests. Default sanitizer adapter uses the personal data registry (Objective 7) plus per-workspace domain glossary plus heuristic name-redaction.

### 6.6 Database Schema

```typescript
skills: {
  ...standardColumns,
  scope: enum('workspace', 'platform'),
  workspace_id: uuid?,                        // null for platform
  published_from_skill_id: uuid?,
  published_from_workspace_id: uuid?,
  applies_to: json,                            // SkillApplicability
  kind: enum('few_shot_exemplar', 'template_specialization'),
  status: enum('draft', 'active', 'retracted'),
  current_version: string,                    // semver
  template: json,
  source_artifact_id: uuid,
  sanitization_log: json?,
  quality_rollup: json,
  reasoning: json,
  promoted_by_user_id: uuid,
  retracted_at: timestamp?,
  retracted_by_user_id: uuid?,
  retraction_reason: text?,
}
indexes:
  [scope, status, _created_at DESC],
  [workspace_id, status],
  [(applies_to->>'stage'), (applies_to->>'artifactType'), status]

skill_versions: {
  ...standardColumns,
  skill_id: uuid,
  version: string,
  template: json,
  reasoning: json,
  rationale: text,                             // why this version exists
  bumped_by_user_id: uuid,
}
unique: [skill_id, version]

skill_candidates: {
  ...standardColumns,
  workspace_id: uuid,
  source_artifact_id: uuid,
  applies_to: json,
  proposed_template: json,
  status: enum('pending', 'promoted', 'dismissed'),
  surfaced_at: timestamp,
  dismissed_at: timestamp?,
  dismissed_by_user_id: uuid?,
  dismissal_reason: text?,
}
indexes: [workspace_id, status, surfaced_at DESC]

skill_publish_requests: {
  ...standardColumns,
  workspace_id: uuid,
  source_skill_id: uuid,
  requested_by_user_id: uuid,
  justification: text,
  status: enum('pending', 'approved', 'rejected'),
  sanitized_template: json?,
  sanitization_log: json?,
  approval_id: uuid?,                          // FK to approvals
  decided_at: timestamp?,
  decided_by_user_id: uuid?,
  decision_comment: text?,
}
indexes: [status, _created_at], [workspace_id, _created_at DESC]

trajectories: {
  ...standardColumns,
  workspace_id: uuid,
  artifact_id: uuid,
  prompt_id: string,
  prompt_version: string,
  provider: string,
  model: string,
  upstream_artifact_refs: json,                // ArtifactRef[]
  inputs_hash: char(64),
  rendered_system_prompt: text,
  rendered_user_prompt: text,
  tool_calls: json,                            // ToolCallRecord[]; gzipped
  raw_response: text,                          // gzipped
  parsed_output: json,
  reasoning: json,
  skills_consumed: json,                       // SkillConsumption[]
  outcome: enum,
  cost_usd: decimal,
  input_tokens: int,
  output_tokens: int,
  tool_use_tokens: int,
  duration_ms: int,
  retain_until: timestamp?,                    // null = indefinite
}
indexes:
  [workspace_id, _created_at DESC],
  [workspace_id, prompt_id, prompt_version, _created_at DESC],
  [outcome, _created_at DESC],
  [retain_until]                               // for purge job
```

### 6.7 Audit Events

```
skill.candidate_surfaced
skill.candidate_dismissed
skill.promoted
skill.version_bumped
skill.retracted

skill.publish_requested
skill.publish_approved
skill.publish_rejected
skill.published
skill.published_retracted_soft
skill.published_retracted_hard
skill.tombstoned

skill.consumed (per generation; high-volume, sampled)
skill.consumption_outcome_recorded
skill.flagged_for_review

trajectory.recorded
trajectory.outcome_updated
trajectory.purged_expired
trajectory.hydration_requested
```

### 6.8 Observability

```
platform_skills_active_total{scope}                       — gauge
platform_skill_candidates_pending_total{workspace}        — gauge
platform_skill_consumption_total{scope, stage, prompt}    — counter
platform_skill_consumption_outcome_total{outcome, skill}  — counter
platform_skill_promotion_total{scope}                      — counter
platform_skill_publish_requests_total{status}             — counter
platform_skill_retraction_total{scope, hard}              — counter
platform_skill_flagged_for_review_total                    — counter
platform_skill_schema_incompatible_total{prompt}          — counter

platform_trajectories_recorded_total{outcome}             — counter
platform_trajectories_purged_total                         — counter
platform_trajectory_storage_bytes{workspace}              — gauge
platform_trajectory_record_duration_seconds              — histogram
platform_trajectory_hydration_duration_seconds           — histogram
```

Slow trajectory hydration (> 2s) emits warnings — likely indicates a hot artifact_versions row or a trajectory with too many refs.

### 6.9 Operational Runbooks

New files in `docs/runbooks/`:

- `skill-publish-rejected-leak.md` — what to do when sanitization passes but admin spots leakage; hard retraction procedure
- `skill-quality-regression.md` — investigating a flagged-for-review skill; deciding bump vs. retract
- `skill-storage-growth.md` — workspace trajectory storage exceeding warning threshold; retention adjustment
- `trajectory-hydration-failure.md` — when an upstream artifact version is missing (data integrity issue)
- `platform-skill-tombstone-incident.md` — incident response for hard-retraction of a leaked skill

---

## 7. Implementation Order

1. **SkillRepositoryPort + Postgres adapter** with conformance tests; stub MSSQL/Mongo with tracked issues.
2. **TrajectoryRepositoryPort + Postgres adapter** with conformance tests; stub MSSQL/Mongo with tracked issues.
3. **Database migrations** on Postgres (MSSQL/Mongo migrations as part of step 1 conformance work).
4. **TrajectoryService** record/query/hydrate. Wire into the existing `GenerationService` so every generation records a trajectory at completion.
5. **SkillService** CRUD + version bump + retraction.
6. **SkillCandidateService** scan job + proposed-template generation prompt + dismiss flow.
7. **Skill ranking integration** in GenerationService: prompts opt in via prompt definition; orchestrator queries top-K; consumption recorded in trajectory.
8. **Quality rollup feedback** — when artifact outcome is recorded, propagate to consumed skills' rollups.
9. **SkillSanitizerPort + default adapter** using the personal data registry + workspace domain glossary.
10. **SkillPublishingService** request → approval routing → sanitization → publish flow.
11. **Platform-wide skill consumption** opt-in per workspace per prompt orchestrator.
12. **Schema compatibility checks** at promotion, publish, and generation time.
13. **Skill UI** — workspace skill library (list, view, version history, promote, retract, request publish). Platform-admin skill review surface.
14. **Retraction propagation** — soft + hard retraction with grace period and tombstone.
15. **Quality flagging** — auto-flag skills with high rejection rates; dashboard alert.
16. **Trajectory purge job** — 90-day cleanup for non-approved trajectories.
17. **Observability** — metrics, dashboards, runbooks.
18. **MSSQL + Mongo adapter implementations** for both repository ports; conformance tests pass on all three.
19. **Conformance verification** — cross-database identical behavior.
20. **Documentation** — ADRs, runbooks, skill authoring guide.
21. **Verify Definition of Done.**

---

## 8. ADRs to Write

- **ADR-0279: Skills as First-Class Artifacts** — why extend the artifact model; alternatives considered (separate entity, prompt-embedded examples)
- **ADR-0280: Two-Tier Skill Scoping (Workspace + Platform)** — why both from day one; refused alternatives (workspace-only v1, full marketplace)
- **ADR-0281: Candidate-Then-Promote (No Autonomous Skill Mutation)** — why human-in-the-loop is mandatory; the Hermes anti-pattern this refuses
- **ADR-0282: Sanitization Required for Cross-Workspace Publication** — what's stripped; why platform-admin review is required on top
- **ADR-0283: Trajectories Reference Upstream Artifacts** — content-addressed refs vs. inline copies; storage growth math
- **ADR-0284: Trajectory Retention Policy** — indefinite for approved, 90-day for non-approved; revisit conditions
- **ADR-0285: Deterministic Skill Ranking, No Embedding Retrieval** — why no learned ranker in v1; what "deterministic given inputs" requires
- **ADR-0286: Skill Schema Compatibility Enforcement** — when checks run; what failure does
- **ADR-0287: Soft vs. Hard Retraction of Published Skills** — when each applies; the leaked-content scenario
- **ADR-0288: Skill Quality Rollup as Signal, Not Action** — auto-flagging without auto-retracting; why platform refuses to retract autonomously

---

## 9. Verification Steps

1. **Skill creation** — promote a candidate; skill appears in workspace skill list with version 1.0.0.
2. **Skill referenced in generation** — a prompt opted into skills runs; trajectory records `skillsConsumed` with the right rank and version.
3. **Skill version bump** — workspace admin bumps minor version with rationale; both versions queryable.
4. **Skill quality rollup** — generation that consumed a skill is approved first-pass; skill's `acceptedFirstPassCount` increments.
5. **Schema compatibility check at promotion** — promote a skill against a prompt whose schema has changed; promotion fails with typed error.
6. **Schema compatibility filtering at generation** — skill incompatible with current prompt schema is filtered from top-K; warning emitted.
7. **Workspace skill scoping** — workspace A's skills do not appear in workspace B's top-K queries.
8. **Platform skill opt-in** — workspace not opted in does not see platform skills in top-K; opted-in workspace does.
9. **Publish request flow** — workspace admin requests publish; platform-admin approval queue receives; on approval, sanitization runs and platform skill is created.
10. **Sanitization strips workspace-specific content** — submit a skill containing workspace name + custom domain term; sanitized output does not contain them; sanitization log records both substitutions.
11. **Sanitization shrinkage rejection** — submit a skill whose content is mostly customer-specific; sanitization rejects with shrinkage > 40% error.
12. **Source workspace consent gate** — workspace marked "no skills will ever be published" rejects publish request before sanitization.
13. **Soft retraction** — platform-admin soft-retracts a published skill; opted-in workspaces' new generations skip it; existing trajectories still hydrate successfully.
14. **Hard retraction with grace period** — platform-admin hard-retracts; 30-day grace runs; after grace, skill is tombstoned; replay of trajectories referencing it fails with typed error.
15. **Candidate threshold** — approve an artifact meeting the threshold; nightly scan surfaces it; admin sees it in pending candidates.
16. **Candidate dismissal** — dismiss a candidate; same source artifact (no re-edit) does not resurface as candidate.
17. **Trajectory recording** — every approved generation produces a trajectory; non-approved generations also produce trajectories.
18. **Trajectory hydration** — given a trajectory id, hydrate to full inputs by reading pinned upstream artifact versions.
19. **Trajectory ref pinning** — upstream artifact updated after trajectory recorded; hydration still produces the original-version content.
20. **Trajectory purge** — non-approved trajectory older than 90 days is purged; approved trajectory of any age is preserved.
21. **Skill consumption audit** — skill consumed in generation produces `skill.consumed` audit (sampled); high-volume sampling rate is correct.
22. **Quality flagging** — skill with rolling rejection rate above threshold becomes flagged; dashboard shows flag.
23. **Cross-database conformance** — skills, skill_versions, candidates, publish_requests, trajectories work identically on Postgres, MSSQL, Mongo.
24. **Determinism check** — same workspace, same prompt, same skill set, two consecutive top-K calls return the identical ordered list.
25. **Authorization** — `skill.promote` permission required to promote; absent permission returns Forbidden; `skill.publish_approve` is platform-admin only.

If all 25 pass, the objective is met.

---

## 10. Definition of Done

**Ports & Adapters**

- [ ] SkillRepositoryPort defined with conformance tests
- [ ] TrajectoryRepositoryPort defined with conformance tests
- [ ] SkillSanitizerPort defined with default adapter
- [ ] skillrepo-postgres / skillrepo-mssql / skillrepo-mongo
- [ ] trajectoryrepo-postgres / trajectoryrepo-mssql / trajectoryrepo-mongo

**Services**

- [ ] SkillService (CRUD, lifecycle, ranking)
- [ ] SkillCandidateService (scan, list, dismiss, propose)
- [ ] SkillPublishingService (request, approve, reject, retract)
- [ ] TrajectoryService (record, query, hydrate, purge)

**Database Schema**

- [ ] All skill / candidate / publish-request / trajectory tables migrated on all three databases
- [ ] Indexes verified

**Skill Lifecycle**

- [ ] Promotion flow with proposed-template generation
- [ ] Version bump (major/minor/patch) with rationale capture
- [ ] Soft retraction
- [ ] Hard retraction with 30-day grace + tombstone

**Publishing**

- [ ] Workspace admin publish request flow
- [ ] Platform-admin approval queue integration with ApprovalRoutingEngine
- [ ] Sanitization (PII registry + workspace glossary + heuristics)
- [ ] Sanitization log capture
- [ ] Source-workspace consent gate
- [ ] Shrinkage rejection threshold

**Skill Consumption**

- [ ] Per-prompt opt-in to skill consumption
- [ ] Top-K deterministic ranking
- [ ] Schema compatibility filtering
- [ ] Workspace + platform tier ordering
- [ ] Per-prompt K override

**Trajectory System**

- [ ] Trajectory recorded on every generation completion
- [ ] Upstream artifact refs (content-addressed)
- [ ] Outcome update on artifact lifecycle events
- [ ] Hydration reconstructs full inputs
- [ ] 90-day purge job for non-approved trajectories
- [ ] Gzip compression on rest

**Quality Rollup**

- [ ] Per-skill quality rollup updated on consumption outcome
- [ ] Recency weighting in ranking
- [ ] Auto-flag at high rejection rate (signal only, not action)

**UI**

- [ ] Workspace skill library
- [ ] Pending candidates surface
- [ ] Skill version history
- [ ] Publish request UI
- [ ] Platform-admin skill review surface

**Authorization**

- [ ] `skill.read`, `skill.promote`, `skill.publish_request`, `skill.retract` workspace permissions
- [ ] `skill.publish_approve` platform-admin permission
- [ ] All service methods authorize early via Objective 6 RBAC

**Audit & Observability**

- [ ] All audit events emitted
- [ ] All metrics emitted
- [ ] Grafana dashboards for skill activity and trajectory storage

**Determinism & CI Gates (per Objective 20 discipline)**

- [ ] **Skill ranking determinism test** — CI runs the ranker against fixed inputs; assert identical output across runs.
- [ ] **Sanitization snapshot tests** — CI runs the sanitizer against canned skills with known PII / workspace identifiers; assert sanitization log matches snapshots.
- [ ] **Schema compatibility regression** — adding a breaking change to a prompt's output schema fails CI if any active skill is schema-incompatible without a corresponding skill-version bump.

**Documentation**

- [ ] ADRs 0279–0288 written and Accepted
- [ ] All runbooks in Section 6.9 written
- [ ] Skill authoring guide (when to promote, how to write a good template, sanitization expectations)
- [ ] Trajectory replay guide (forward reference for Objective 35)

**Verification**

- [ ] All 25 verification steps in Section 9 pass

---

## 11. Anti-Patterns to Refuse

- **Autonomous skill creation, mutation, or retraction.** Every skill state change is human-initiated. The platform surfaces signals; humans act.
- **Auto-publishing platform-wide skills.** Cross-workspace publication requires platform-admin approval. No "trusted workspace" exemption.
- **Inline trajectory storage.** Trajectories reference upstream artifacts; never copy.
- **Skipping sanitization on publish.** No skill bypasses the sanitization pass. No platform-admin "trust me, it's clean" override.
- **Non-deterministic skill ranking.** No randomness, no embedding similarity in v1, no learned ranker. Same inputs = same top-K, every time.
- **Treating skill quality rollups as ground truth for action.** Rollups are signal. Auto-flagging is allowed; auto-retraction is not.
- **Allowing schema-incompatible skills into generations.** Filtered out, with audit warning. Never silently dropped without a warning.
- **Embedding workspace data in platform-wide skills via creative routing.** If sanitization rejects, the skill doesn't publish. Creative routing around sanitization is an escalation, not a workaround.
- **Cross-workspace skill suggestions ("workspaces like yours promoted X").** Privacy-violating; out of scope.
- **Indefinite retention of all trajectories regardless of outcome.** Approved-only is indefinite; non-approved purges at 90 days.
- **Trajectory storage of unredacted content for redaction-on workspaces.** Trajectory PII handling inherits exactly from the source generation; no separate regime.

---

## 12. Open Questions for Confirmation Before Starting

1. **Candidate threshold default values** — proposing the values in §3 (`approved_first_pass`, zero revisions, edit distance ratio < 5%, time-to-approval < workspace median × 0.5). These are tunable per workspace; are the defaults acceptable?
2. **K defaults (3 few-shot, 1 specialization)** — confirmed? Some prompts may benefit from K=5; per-prompt override is available.
3. **Trajectory retention 90 days for non-approved** — appropriate? 30 days is cheaper but less useful for quality investigation; 180 days is more useful but more expensive.
4. **Sanitization shrinkage threshold (40%)** — calibrated by gut; needs validation against real promoted skills. Should we run a tuning pass during early implementation?
5. **Hard retraction grace period (30 days)** — long enough for opted-in workspaces to notice and react; short enough to prevent extended exposure of leaked content. Acceptable?
6. **Quality flag threshold (30% rejection over last 50 consumptions)** — conservative; some real-world skills may oscillate. Worth a tuning pass after launch.
7. **Stub MSSQL/Mongo adapters at v1?** — proposing Postgres adapters first with full conformance, then MSSQL + Mongo follow-up. Some objectives require all three day-one. Confirm: skills/trajectories can ship Postgres-first?

---

## 13. What Comes Next

With Objective 33 complete, the AI Build Pipeline gains procedural memory and a queryable history of every approved generation. Each subsequent objective benefits:

- **Objective 34 (AI PR Review Surface)** can use the same skill mechanism for "Learnings" — workspace-scoped review tunings that survive across PRs. The skill model is general enough to serve both.
- **Objective 35 (Eval & Replay Harness)** is unblocked: trajectories provide the substrate for replay, regression testing across providers, and golden-input expansion from real production data.
- **Objective 36 (IDE & CLI Surfaces)** can expose skill management — promote, retract, request publish — to a developer's local environment.

Stages 22–28 (PRD, schema, UI, code, test) all benefit organically: the more they're used in a workspace, the more the workspace's preferences crystallize into reusable skills that improve subsequent generations. The platform stops being amnesic.

---

_This document is the contract. Every checkbox in Section 10 must be true before Objective 35 begins._
