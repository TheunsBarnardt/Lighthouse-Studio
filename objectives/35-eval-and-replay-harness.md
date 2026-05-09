# Objective 35: Eval & Replay Harness

**Status:** Ready for development
**Prerequisites:** Objectives 20 (AI Pipeline Foundation), 33 (Skill Promotion & Trajectory Library) complete; Objective 34 (AI PR Review Surface) recommended but not strictly required
**Blocks:** None directly; meaningfully improves prompt iteration discipline across Objectives 21–30 and 34

---

## 1. Purpose

Objective 20 locks in "a test suite per prompt with golden-output checks and regression detection" as a property of the prompt management system. What it doesn't ship is the **harness** to run those evals at scale: replaying real production trajectories against new prompt versions, comparing provider outputs head-to-head, grading reasoning quality, and gating prompt-change PRs on eval deltas. Without that harness, the locked decision is aspirational — there's no way to actually run the evals in a way that catches regressions before they ship.

Objective 33 produced the substrate: every approved generation has a stored trajectory that hydrates back to its full inputs. This objective produces the harness that consumes those trajectories — replay them against the new prompt, against a different provider, against a different model — and produces a structured comparison report.

The other thing this objective produces is **CI integration**: a prompt-change PR runs the harness automatically against the prompt's eval set; significant regression on quality, structural stability, or cost blocks merge. The discipline already implied by ADR-0159 (determinism verification on cache miss), ADR-0160 (reasoning-capture as CI gate), and ADR-0161 (per-prompt cost-regression budget) becomes enforceable. They go from convention to gate.

---

## 2. Scope

### In Scope

- **Replay engine**: given a trajectory (Obj 33) + a target prompt version + a target provider/model, re-run the generation and capture the new output
- **Output diff**: structural and content-level diff between original and replayed output
- **Eval set authoring**: per-prompt eval sets stored alongside the prompt; each entry is a (trajectory id OR synthetic input, expected assertions)
- **Golden inputs from real trajectories**: an admin can promote a trajectory into the prompt's eval set with one action (with PII handling per Obj 20)
- **Cross-provider comparison**: run the same prompt + same input across multiple providers/models; produce side-by-side report
- **Reasoning-quality grading**: a grading prompt evaluates the reasoning of another prompt's output against rubric criteria; bounded recursion (the grader never grades itself)
- **CI gate on prompt PRs**: changes to a prompt file trigger replay + eval; quality, structural-stability, and cost deltas computed; significant regression fails CI
- **Cost-vs-quality dashboards**: per-prompt aggregate of (provider, model, cost, quality outcome) over time
- **Determinism verification job**: nightly cache-bypass replay for `temperature: 0` prompts (per ADR-0159), fully implemented here
- **Eval CLI**: a command-line entry point for engineers to run evals locally without going through CI
- **Eval result storage**: replays produce result records; queryable for trend analysis
- **Manual replay UI**: platform-admin UI to replay a single trajectory, view diff, share results
- ADRs

### Out of Scope (Belongs to Later Objectives or Explicitly Refused)

- **Customer-facing eval features.** This is internal tooling for the platform team and platform admins. Workspaces don't author evals.
- **Fine-tuning pipeline.** Trajectories + evals are the substrate, but training is deferred (already excluded by Obj 20).
- **A/B testing in production.** This is offline replay. Live traffic splitting is a different objective if ever needed.
- **Human-rater workflows.** Grading is done by the grader prompt against rubrics, not by paid human raters at v1.
- **Cross-prompt eval orchestration ("run all evals nightly").** The infrastructure here supports it, but the orchestration policy is operational, not part of this objective.
- **Eval result publishing to external benchmark leaderboards.** Out of scope.
- **Quality grading via embedding similarity.** Same reason as Objective 33 — no embedding store dependency in v1.

---

## 3. Locked Decisions

| Decision                     | Choice                                                                                                                                                                                          | Rationale                                             |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Replay source                | Trajectories from Objective 33; hydrated to original input at replay time                                                                                                                       | One source of truth for "real production input"       |
| Replay isolation             | Replays run via a non-cached `GenerationService` path; never write to artifact storage; never propagate to skills                                                                               | Replays don't pollute production state                |
| Eval set storage             | TypeScript fixtures in `packages/core/src/ai/prompts/<stage>/<prompt>/evals/`; versioned with the prompt; not in DB                                                                             | Reviewable, diffable, code-co-located                 |
| Eval entry kinds             | `trajectory_ref` (points to a stored trajectory) or `synthetic_fixture` (inline inputs in code)                                                                                                 | Real production inputs + curated edge cases           |
| Trajectory promotion to eval | Explicit platform-admin action via UI or CLI; PII rule: trajectories from PII-redaction-on workspaces use redacted content; opt-out workspaces require additional consent gate before promotion | Audit-trailed; respects redaction policy              |
| Golden output capture        | At eval-entry creation: the current production output is captured as the golden; subsequent runs diff against it                                                                                | Deterministic baseline                                |
| Output diff types            | Structural diff (output shape: keys, types, array lengths) + content diff (semantic equivalence per type)                                                                                       | Both shape regressions and content regressions matter |
| Quality grading prompt       | A separate prompt (`packages/core/src/ai/prompts/eval-grading/`) takes (input, output, reasoning, rubric) and produces a graded score                                                           | Same code-as-data discipline                          |
| Grading bounded recursion    | The grader prompt is itself ungradeable by the same grader; cycle detected and rejected with typed error                                                                                        | Prevents self-grading paradox                         |
| Grading rubric per prompt    | Each prompt declares its rubric (criteria + weights); rubric is part of the prompt definition                                                                                                   | Rubric drift is a versioned change                    |
| CI gate location             | GitHub Actions workflow triggered on PRs touching `packages/core/src/ai/prompts/**`                                                                                                             | Same CI as the rest of the codebase                   |
| CI eval scope                | Only the prompts whose files changed (plus their dependencies — grading prompts when graded prompt changes, etc.)                                                                               | Bounded; runs in reasonable time                      |
| CI failure thresholds        | Quality regression >5% (relative), structural stability variance >0.1, cost regression >20% (per ADR-0161); each independently gates                                                            | Tunable per prompt; defaults are conservative         |
| CI override                  | A prompt PR can override a threshold by including a budget-amending ADR with explicit justification                                                                                             | Per ADR-0161 discipline                               |
| Replay storage               | `replay_results` table; per-workspace logical isolation when replay sourced from a workspace's trajectory                                                                                       | Consistent with platform                              |
| Replay retention             | 180 days for ad-hoc replays; indefinite for replays attached to merged prompt PRs                                                                                                               | Trend analysis + audit trail                          |
| Cross-provider comparison    | Up to 5 (provider, model) combinations per comparison run                                                                                                                                       | Practical cap; deeper sweeps are sequential           |
| Determinism nightly job      | For every active `temperature: 0` prompt: 5 replays with cache bypass; structural variance computed and recorded; variance > tolerance fails the job                                            | Implements ADR-0159                                   |
| Authorization                | New permissions: `eval.run`, `eval.promote_trajectory`, `eval.view_results`; `eval.run_ci` is system-only                                                                                       | Per Objective 6 RBAC                                  |
| Cost attribution             | Replays cost the platform's evaluation budget (a separate budget bucket); not workspace budgets                                                                                                 | Customers don't pay for the platform's QA             |

---

## 4. Architectural Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                    Eval & Replay Harness (this objective)             │
│                                                                       │
│   Services:                                                           │
│   - ReplayService (run a single replay)                                │
│   - EvalSetService (load + manage eval sets)                           │
│   - EvalRunService (run an eval set; produce report)                  │
│   - GradingService (grade output against rubric)                       │
│   - DeterminismVerificationService (nightly t=0 verification)          │
│   - ComparisonService (cross-provider runs)                            │
│                                                                       │
│   Ports:                                                              │
│   - EvalResultRepositoryPort                                          │
│                                                                       │
│   Adapters:                                                           │
│   - evalresultrepo-postgres / mssql / mongo                           │
└─────────────────────────────────┬────────────────────────────────────┘
                                  │
                                  ▼
        ┌──────────────────────────────────────────────────┐
        │   Foundation services:                              │
        │   - GenerationService (Obj 20) — replay path         │
        │   - PromptService (Obj 20) — load prompts at version │
        │   - TrajectoryService (Obj 33) — hydrate inputs      │
        │   - SkillService (Obj 33) — skill set at replay time │
        │   - AIProviderPort (Obj 20) — multi-provider runs    │
        │   - AuditPort (Obj 7)                                 │
        │   - JobQueuePort (Obj 1.5)                            │
        └──────────────────────────────────────────────────┘
```

The harness is mostly orchestration over services that already exist. The new pieces are the service layer (orchestration), the eval set authoring convention (file system layout), and the CI integration.

---

## 5. The Hard Parts

**5.1 Replay must not pollute production**

A replay re-runs a prompt with hydrated inputs. The risk: replays accidentally hitting production code paths (writing artifacts, advancing state machines, consuming workspace cost budgets). The discipline:

- **Non-cached path**: replays bypass the AI response cache. (Cache hits would defeat the purpose.)
- **No artifact write**: replays produce a `ReplayResult`, never an `Artifact`. The artifact write code path is gated behind a context flag.
- **No skill quality propagation**: skills consumed during replay don't have their quality rollups updated.
- **No state machine transitions**: replays don't advance approval status of anything.
- **Cost attribution to platform eval bucket**: replays don't consume workspace budgets; they consume a platform-level eval budget tracked separately.
- **Audit attribution**: replay-generated audit events carry an explicit `replay_run_id` field; downstream analyses that aggregate audit can filter replays out.

The implementation: a `ReplayContext` extends `RequestContext` with a `replay_run_id` and `pollution_safe: false` flag. Services that have side effects check the flag and refuse to write. This is a defensive depth-of-field design — even if one service forgets to check, others will.

**5.2 Hydration faithfulness**

A trajectory hydrates to its original inputs. For replay to be faithful, those inputs must be exactly as they were at original-generation time, including:

- The pinned upstream artifact versions (already content-addressed per Obj 33).
- The skill set consumed (skill ids + versions captured in trajectory).
- The renderable system prompt and user prompt (captured in trajectory).
- The tool set available — and this is where it gets subtle: the _tool ids_ at trajectory time must still resolve at replay time. If a tool has been retired, the trajectory can't be replayed faithfully against the current tool registry.

Mitigation: when a tool is retired, existing trajectories are flagged. Replay against retired-tool trajectories fails with a typed error and a clear message. Forking a replay to substitute a new tool is possible but explicitly out of scope for v1 — it requires careful UX to avoid faking faithfulness.

**5.3 Output diffing is type-aware**

A naïve string diff between two AI outputs is noisy and unhelpful. The output diff is type-aware:

- **Structural diff**: parsed JSON shape comparison. Same keys? Same types? Same array lengths? This catches schema drift cleanly.
- **Content diff per type**:
  - Strings: character-level diff with a similarity score (Levenshtein normalized to length).
  - Numbers: absolute and relative difference.
  - Arrays of objects: matched by stable key (declared per output schema) — added / removed / changed entries.
  - Booleans: equal or not.
- **Semantic equivalence checks**: for prompts that produce code, an AST-level equivalence check catches reorderings that don't matter.

The diff is itself a structured artifact — not just human-readable text. CI consumes the structured diff to compute deltas.

**5.4 Grading rubric and the bounded recursion**

The grading prompt takes (input, output, reasoning, rubric) and produces a graded score per criterion plus an overall weighted score. The rubric for the PRD-generation prompt might be:

```typescript
{
  criteria: [
    { id: 'covers_prd_thirteen_sections', weight: 0.25, description: '...' },
    { id: 'reasoning_explains_section_choices', weight: 0.20, description: '...' },
    { id: 'acceptance_criteria_testable', weight: 0.20, description: '...' },
    { id: 'avoids_implementation_details', weight: 0.15, description: '...' },
    { id: 'language_clear_and_concise', weight: 0.10, description: '...' },
    { id: 'uses_workspace_domain_glossary', weight: 0.10, description: '...' },
  ],
}
```

Each criterion is graded 0–10 by the grader; weighted average is the prompt's quality score for that input.

The bounded-recursion problem: what grades the grader? Two options were considered:

- **Self-grading**: rejected. A grader marking its own output is paradoxical and produces no useful signal.
- **Manual rubric for the grader**: accepted. The grading prompt has its own rubric, but its evals are run with hardcoded golden outputs (a small, hand-curated set of `(input, output, reasoning, expected_grade)` tuples). When the grader prompt is changed, CI runs the grader against this hand-curated set; any divergence flags review.

The hand-curated set is small (proposing 20 entries to start), updated rarely, kept in `packages/core/src/ai/prompts/eval-grading/calibration/`. A change to that set requires an ADR-style rationale.

**5.5 CI gate behavior**

A PR that modifies a prompt file triggers the eval workflow. Steps:

```
1. Detect changed prompt files.
2. For each changed prompt:
   a. Load the prompt's eval set.
   b. For each entry: run replay with the new prompt version.
   c. Diff outputs (structural + content) against goldens.
   d. Run grading: new outputs vs. originals.
   e. Compute aggregate deltas:
      - quality_delta = mean(new_grade) - mean(original_grade)
      - structural_stability = 1 - structural_diff_rate
      - cost_delta = mean(new_tokens) / mean(original_tokens) - 1
3. Apply thresholds:
   - quality_delta < -0.05 → fail
   - structural_stability < 0.9 → fail
   - cost_delta > 0.20 → fail (per ADR-0161)
4. Post a comment on the PR with the structured report.
5. If any threshold failed and no override ADR present: workflow fails.
```

The CI workflow runs against a pinned provider+model to keep the gate stable across provider drift. The platform's nightly determinism job (Section 5.6) provides separate evidence that the pinned provider+model is itself stable.

Override path: a PR amends an ADR (using the existing ADR system) that re-locks the prompt's budget or thresholds with documented justification. The CI workflow detects the ADR change and accepts the override. This is per ADR-0161's spirit, generalized to the other thresholds.

**5.6 Determinism nightly verification (ADR-0159 implementation)**

Every prompt declared `temperature: 0` runs a nightly verification:

```
For each temperature=0 prompt:
  Pick N=5 inputs from the prompt's eval set.
  For each input:
    Run 5 replays via cache-bypass path.
    Compute structural_variance across the 5 outputs.
  Aggregate prompt-level structural_variance.
  If above tolerance (default: 0.05): mark prompt for review; emit alert.
```

This catches model drift: even if the prompt hasn't changed, the underlying provider model may have updated and produced different outputs. Caught early via this job rather than via a customer-visible quality regression.

The job's results land in `prompt_determinism_results`, surfaced in a Grafana dashboard. Variance trends are watched; sudden jumps trigger investigation.

**5.7 Cross-provider comparison**

Customers may run different providers (Obj 20 supports Anthropic, OpenAI, Azure OpenAI, Bedrock, Ollama, vLLM). The platform team needs visibility into how prompts perform across them.

```
ComparisonRun:
  prompt_id + version
  inputs: [trajectory_ref or synthetic][]
  targets: [(provider, model)][]            # up to 5

For each target:
  For each input:
    Run replay against (target.provider, target.model)
    Diff against the original trajectory's output
    Grade

Produce ComparisonReport:
  Per-target aggregate quality
  Per-target aggregate cost
  Per-input matrix: which target won
  Provider drift signals
```

This is offline analysis, run on demand by platform engineers via the eval CLI. Results are stored, queryable, and shared via URL (workspace-internal — no cross-workspace exposure).

**5.8 Promoting a trajectory to an eval entry**

The most useful eval inputs are real production trajectories that exposed edge cases. The promotion flow:

```
1. Platform admin browses trajectories (filtered by stage / outcome / interesting properties).
2. Selects a trajectory; views its inputs + outputs.
3. Clicks "Promote to eval set."
4. Specifies which prompt's eval set + adds optional assertions ("output must include section X").
5. PII gate:
   - If the source workspace has redaction on: trajectory uses redacted content; promotion proceeds.
   - If the source workspace has redaction opted out: a consent confirmation is required (the workspace's published consent policy is checked; if it covers eval use, proceed; else reject with a "needs explicit consent" error).
6. The promotion creates a new entry in the prompt's eval set TypeScript file via a templated PR.
7. The PR is reviewed by another platform engineer.
```

Step 6 is unusual — the platform writes code (the eval entry) which is then human-reviewed. This keeps eval sets in the repo (per locked decision) without requiring engineers to hand-craft entries. The PR-creation tool is part of this objective's CLI.

**5.9 Eval result storage and trend analysis**

Replay results pile up over time. The substrate for this is `replay_results`:

```typescript
replay_results: {
  ...standardColumns,
  replay_run_id: uuid,                          // groups multiple replays into one logical run
  source_trajectory_id: uuid?,                  // null for synthetic-fixture replays
  prompt_id: string,
  prompt_version: string,
  target_provider: string,
  target_model: string,
  output: json,                                 // the replayed output
  structural_diff: json,                        // vs. golden (or original trajectory output)
  content_diff: json,
  grade: json,                                  // per-criterion + overall
  cost_usd: decimal,
  input_tokens: int,
  output_tokens: int,
  duration_ms: int,
  triggered_by: enum('ci_pr', 'nightly_determinism', 'manual', 'comparison'),
  triggered_by_user_id: uuid?,
  triggered_by_pr: string?,                     // GitHub PR number for ci_pr
}
indexes: [prompt_id, prompt_version, _created_at DESC], [replay_run_id], [triggered_by, _created_at]
```

Trend dashboards aggregate this:

- Quality score over time per prompt.
- Cost per call over time per prompt.
- Determinism variance over time per prompt.
- Provider comparison heat maps.

Storage growth matters less than for trajectories — replay results are smaller (no upstream refs to hydrate) and 180-day retention applies to most.

**5.10 The CLI surface**

Engineers run evals locally before pushing. The CLI is part of this objective (the broader CLI as a developer surface is Objective 36; this objective ships the eval-specific subcommands):

```
lighthouse eval run <prompt-id> [--against <trajectory-id>] [--provider <p>] [--model <m>]
lighthouse eval set list <prompt-id>
lighthouse eval determinism <prompt-id>
lighthouse eval compare <prompt-id> --providers <p1>,<p2>,<p3>
lighthouse eval promote <trajectory-id> --to-prompt <prompt-id>
lighthouse eval results <prompt-id> [--last <N>]
```

The CLI authenticates against the platform via the same SDK Obj 36 will expose. Until Obj 36 lands, the CLI uses a temporary auth bootstrap (config file with API key); this is replaced when Obj 36 ships.

**5.11 Determinism of the eval harness itself**

The harness produces results that humans and CI act on. If the harness is non-deterministic, those decisions are unreliable. Disciplines:

- The grader runs at `temperature: 0`.
- Replay runs at the prompt's declared temperature; for `temperature: 0` prompts the result is deterministic given (provider, model, prompt version, inputs).
- For `temperature > 0` prompts, replays run N times (N=3 default) and the result is the median grade; structural diff is computed against the original output (not against another replay).
- The harness's own internal logic (scoring aggregation, threshold computation) is pure code and unit-tested.

When CI fails an eval, the failure must be reproducible: clicking "re-run job" should produce the same outcome. If it doesn't, the harness has a bug (or the underlying provider has drifted, in which case the determinism nightly job would have caught it first).

---

## 6. Component Specifications

### 6.1 ReplayService

```typescript
export class ReplayService {
  /** Replay a single trajectory against a target prompt + provider/model. */
  async replay(ctx: ReplayContext, input: ReplayInput): Promise<Result<ReplayResult, AppError>>;

  /** Replay multiple trajectories in parallel (bounded concurrency). */
  async replayBatch(ctx: ReplayContext, inputs: ReplayInput[]): Promise<Result<ReplayResult[], AppError>>;
}

export interface ReplayInput {
  sourceTrajectoryId?: string; // for trajectory-sourced replays
  syntheticInput?: { prompt: string; promptVersion: string; inputs: unknown };
  targetPromptVersion: string; // may differ from trajectory's prompt version
  targetProvider: string;
  targetModel: string;
  cacheControl: 'bypass'; // always bypass for replays
}
```

### 6.2 EvalSetService

```typescript
export class EvalSetService {
  async loadForPrompt(promptId: string): Promise<Result<EvalSet, AppError>>;
  async listPromptsWithEvals(): Promise<Result<string[], AppError>>;
}

export interface EvalSet {
  promptId: string;
  promptVersion: string;
  rubric: GradingRubric;
  entries: EvalEntry[];
}

export interface EvalEntry {
  id: string;
  kind: 'trajectory_ref' | 'synthetic_fixture';
  trajectoryId?: string;
  syntheticInputs?: unknown;
  goldenOutput?: unknown; // captured at entry-creation time
  assertions?: EvalAssertion[];
  notes?: string;
}
```

### 6.3 EvalRunService

```typescript
export class EvalRunService {
  /** Run an entire eval set and produce a report. */
  async runEvalSet(ctx: ReplayContext, input: RunEvalSetInput): Promise<Result<EvalReport, AppError>>;

  /** Run only the entries affected by a specific change (for CI). */
  async runEvalSetForCi(ctx: ReplayContext, input: RunEvalSetCiInput): Promise<Result<EvalReport, AppError>>;
}

export interface EvalReport {
  promptId: string;
  newVersion: string;
  baselineVersion: string;
  perEntry: PerEntryReport[];
  aggregate: {
    qualityDelta: number;
    structuralStability: number;
    costDelta: number;
    durationDeltaMs: number;
  };
  thresholdViolations: ThresholdViolation[];
}
```

### 6.4 GradingService

```typescript
export class GradingService {
  /** Grade an output against the prompt's rubric. */
  async grade(ctx: ReplayContext, input: GradeInput): Promise<Result<GradedScore, AppError>>;

  /** Calibrate the grader against the hand-curated calibration set. */
  async calibrate(ctx: SystemContext): Promise<Result<CalibrationReport, AppError>>;
}

export interface GradedScore {
  perCriterion: Array<{ criterionId: string; score: number; rationale: string }>;
  weightedOverall: number;
  graderPromptVersion: string;
}
```

### 6.5 DeterminismVerificationService

```typescript
export class DeterminismVerificationService {
  /** Run nightly determinism verification across all temperature=0 prompts. */
  async runNightly(ctx: SystemContext): Promise<Result<DeterminismReport, AppError>>;

  /** Run determinism check for a specific prompt. */
  async runForPrompt(ctx: SystemContext, promptId: string): Promise<Result<PromptDeterminismResult, AppError>>;
}
```

### 6.6 ComparisonService

```typescript
export class ComparisonService {
  async runComparison(ctx: ReplayContext, input: ComparisonInput): Promise<Result<ComparisonReport, AppError>>;
}

export interface ComparisonInput {
  promptId: string;
  promptVersion: string;
  inputs: ReplayInput[]; // up to 50 inputs
  targets: Array<{ provider: string; model: string }>; // up to 5 targets
}
```

### 6.7 Database Schema

```typescript
replay_runs: {
  ...standardColumns,
  triggered_by: enum,
  triggered_by_user_id: uuid?,
  triggered_by_pr: string?,
  prompt_id: string,
  prompt_version: string,
  target_provider: string?,                     // null for multi-target comparison
  target_model: string?,
  status: enum('queued', 'running', 'completed', 'failed'),
  total_replays: int,
  succeeded_replays: int,
  cost_usd: decimal,
  retain_until: timestamp?,                     // null = indefinite
}
indexes: [prompt_id, _created_at DESC], [triggered_by_pr]

replay_results: {
  ...standardColumns,
  replay_run_id: uuid,
  source_trajectory_id: uuid?,
  prompt_id: string,
  prompt_version: string,
  target_provider: string,
  target_model: string,
  output: json,
  structural_diff: json,
  content_diff: json,
  grade: json,
  cost_usd: decimal,
  input_tokens: int,
  output_tokens: int,
  duration_ms: int,
  triggered_by: enum,
  triggered_by_user_id: uuid?,
  triggered_by_pr: string?,
}
indexes: [prompt_id, prompt_version, _created_at DESC], [replay_run_id], [triggered_by, _created_at]

prompt_determinism_results: {
  ...standardColumns,
  prompt_id: string,
  prompt_version: string,
  provider: string,
  model: string,
  sample_count: int,
  structural_variance: decimal,
  passed: boolean,
}
indexes: [prompt_id, _created_at DESC]

eval_calibration_results: {
  ...standardColumns,
  grader_prompt_version: string,
  calibration_entry_id: string,
  expected_grade: decimal,
  actual_grade: decimal,
  divergence: decimal,
}
indexes: [grader_prompt_version, _created_at DESC]
```

### 6.8 Audit Events

```
eval.set_loaded
eval.run_started
eval.run_completed
eval.run_failed

replay.executed
replay.failed
replay.tool_unavailable_in_current_registry

grading.executed
grading.calibration_run
grading.calibration_drift_detected

determinism.nightly_started
determinism.nightly_completed
determinism.prompt_variance_above_tolerance

comparison.started
comparison.completed

eval.trajectory_promoted
eval.threshold_violated
eval.override_adr_accepted
```

### 6.9 Observability

```
platform_eval_runs_total{trigger, prompt}                              — counter
platform_eval_run_duration_seconds                                     — histogram
platform_eval_quality_delta{prompt}                                    — gauge (last run)
platform_eval_cost_delta{prompt}                                       — gauge (last run)
platform_eval_structural_stability{prompt}                             — gauge (last run)
platform_eval_threshold_violations_total{type}                         — counter

platform_replay_executions_total{prompt, provider, model, status}      — counter
platform_replay_duration_seconds                                       — histogram

platform_grading_calibration_divergence{grader_version}                — gauge
platform_determinism_variance{prompt}                                  — gauge
platform_determinism_failures_total                                    — counter

platform_eval_budget_consumed_usd_total                                — counter
```

### 6.10 Operational Runbooks

New files in `docs/runbooks/`:

- `eval-ci-failure.md` — diagnosing CI eval failures; threshold tuning; override ADR procedure.
- `determinism-nightly-failure.md` — investigating prompt variance jumps; provider-side drift vs. prompt-side regression.
- `grader-calibration-drift.md` — when calibration divergence rises; recalibration steps.
- `eval-budget-exceeded.md` — platform-level eval budget at cap; investigation + extension.
- `replay-tool-unavailable.md` — replay against retired-tool trajectory; what to do.
- `trajectory-promotion-blocked.md` — PII gate rejected; consent-policy review.

---

## 7. Implementation Order

1. **EvalResultRepositoryPort + Postgres adapter**; stub MSSQL/Mongo.
2. **Database migrations** for replay_runs, replay_results, prompt_determinism_results, eval_calibration_results.
3. **ReplayContext + pollution-safe service flag** wired into GenerationService, ArtifactService, SkillService.
4. **ReplayService** — single-replay path with hydration via TrajectoryService.
5. **Output diff utilities** — structural diff, content diff per type, AST-equivalence for code outputs.
6. **EvalSetService** — load eval sets from `packages/core/src/ai/prompts/<stage>/<prompt>/evals/` directories.
7. **Grading prompt** authored in `packages/core/src/ai/prompts/eval-grading/`.
8. **Calibration set** for grading prompt (20 entries to start) in `eval-grading/calibration/`.
9. **GradingService** — grade single output; calibrate against calibration set.
10. **EvalRunService** — full eval set run + per-entry report + aggregate deltas.
11. **CI workflow** — GitHub Action on prompt-file PRs; runs `runEvalSetForCi`; comments on PR; fails on threshold violations.
12. **Override ADR detection** — CI parses changed ADRs; accepts override when present.
13. **DeterminismVerificationService** — nightly job + per-prompt run.
14. **ComparisonService** — multi-target replay + matrix report.
15. **Eval CLI subcommands** — `run`, `set list`, `determinism`, `compare`, `promote`, `results`.
16. **Trajectory promotion to eval entry** — PR-creation tool; PII gate; templated entry insertion.
17. **Manual replay UI** for platform admins.
18. **Trend dashboards** — Grafana panels for quality, cost, determinism over time.
19. **MSSQL + Mongo adapter implementations**; conformance.
20. **Documentation** — ADRs, runbooks, eval authoring guide.
21. **Verify Definition of Done.**

---

## 8. ADRs to Write

- **ADR-0299: Replay as Pollution-Safe Path** — what `pollution_safe: false` blocks; why this design over a separate replay-only service.
- **ADR-0300: Eval Sets in Code, Not DB** — co-located with prompts; reviewable; templated promotion from trajectories.
- **ADR-0301: Type-Aware Output Diff** — structural vs. content diff; AST equivalence for code outputs.
- **ADR-0302: Bounded Recursion for Grading** — grader graded by hand-curated calibration set; no self-grading.
- **ADR-0303: CI Threshold Gates with ADR Override** — three independent gates (quality, structural stability, cost); ADR override path.
- **ADR-0304: Determinism Nightly Verification (implements ADR-0159)** — what runs nightly; tolerance defaults; alerting.
- **ADR-0305: Cross-Provider Comparison Cap** — up to 5 (provider, model); rationale.
- **ADR-0306: Eval Budget Separate from Workspace Budgets** — platform pays for QA; customer doesn't subsidize.
- **ADR-0307: Trajectory Promotion PII Gate** — redacted is fine; opt-out workspaces require consent confirmation.
- **ADR-0308: Replay Failure on Retired Tools** — refusing to fake faithfulness; v1 doesn't substitute tools.

---

## 9. Verification Steps

1. **Single replay** — given a trajectory id, replay against the same prompt version + same provider; output diff is empty (or near-empty if `temperature > 0`).
2. **Replay with new prompt version** — replay against a bumped prompt version; structural diff and content diff produced.
3. **Replay across providers** — same input, two providers; outputs differ but both validated against schema.
4. **Pollution safety: no artifact written** — replay completes; no new artifact records exist for the workspace.
5. **Pollution safety: skill rollups untouched** — skills consumed during replay; their quality rollups unchanged.
6. **Pollution safety: workspace budget untouched** — workspace's AI budget unchanged after replay; platform eval budget consumed.
7. **Eval set load** — load an eval set for a known prompt; entries parsed; rubric loaded.
8. **Eval set run** — run all entries in a set; report contains per-entry results + aggregate deltas.
9. **CI threshold: quality regression** — synthetic prompt change reduces quality by 10%; CI fails with `quality_delta` violation.
10. **CI threshold: structural instability** — prompt change produces inconsistent shapes; CI fails with `structural_stability` violation.
11. **CI threshold: cost regression** — prompt change increases tokens by 30%; CI fails with `cost_delta` violation.
12. **CI override via ADR** — failing PR includes a budget-amending ADR; CI accepts.
13. **Grading calibration** — grader prompt graded against calibration set; divergence within tolerance; passes.
14. **Grading calibration drift** — synthetic grader change causes divergence > tolerance; calibration job fails; alert emitted.
15. **Determinism nightly: pass** — `temperature: 0` prompt with stable provider; 5 replays produce identical structure; recorded as passed.
16. **Determinism nightly: variance detected** — synthetically perturbed model produces variance; recorded as failed; alert emitted.
17. **Cross-provider comparison** — 3 targets, 5 inputs; matrix produced; per-target aggregate quality computed.
18. **Trajectory promotion (redacted workspace)** — promote a trajectory from a redaction-on workspace; PR created with eval entry; redacted content used.
19. **Trajectory promotion (opt-out workspace)** — promote from a redaction-off workspace without consent: rejected with typed error.
20. **Trajectory promotion (opt-out + consent)** — workspace's consent policy covers eval use; promotion proceeds; audit reflects consent reference.
21. **Replay against retired-tool trajectory** — tool removed from registry after trajectory recorded; replay fails with `replay.tool_unavailable_in_current_registry` error.
22. **CLI: run** — `lighthouse eval run <prompt> --against <trajectory>` produces a result locally.
23. **CLI: determinism** — `lighthouse eval determinism <prompt>` runs the determinism check and prints variance.
24. **CLI: promote** — `lighthouse eval promote <trajectory> --to-prompt <prompt>` opens a PR with a new eval entry.
25. **Trend dashboard** — Grafana panel shows per-prompt quality and cost over the last 30 days.
26. **Cross-database conformance** — replay_runs, replay_results, determinism_results, calibration_results work identically on Postgres, MSSQL, Mongo.

If all 26 pass, the objective is met.

---

## 10. Definition of Done

**Ports & Adapters**

- [ ] EvalResultRepositoryPort defined with conformance tests
- [ ] evalresultrepo-postgres / mssql / mongo

**Services**

- [ ] ReplayService (replay, replayBatch)
- [ ] EvalSetService (loadForPrompt, list)
- [ ] EvalRunService (runEvalSet, runEvalSetForCi)
- [ ] GradingService (grade, calibrate)
- [ ] DeterminismVerificationService (runNightly, runForPrompt)
- [ ] ComparisonService (runComparison)

**Database Schema**

- [ ] All tables migrated on all three databases

**Replay Path**

- [ ] ReplayContext + pollution-safe flag wired through services
- [ ] Cache bypass on replay path
- [ ] Trajectory hydration faithfulness
- [ ] Retired-tool detection and typed error

**Eval Sets**

- [ ] File-system layout for eval sets co-located with prompts
- [ ] Trajectory-ref + synthetic-fixture entry kinds
- [ ] Rubric per prompt
- [ ] Grading prompt + calibration set

**Output Diff**

- [ ] Structural diff
- [ ] Content diff per type
- [ ] AST equivalence for code outputs

**CI Integration**

- [ ] GitHub Action on prompt-file PRs
- [ ] Three-threshold gating (quality, structural stability, cost)
- [ ] PR comment with structured report
- [ ] Override ADR detection

**Determinism**

- [ ] Nightly job for all temperature=0 prompts
- [ ] Per-prompt variance recorded
- [ ] Alerting on tolerance breach

**Cross-Provider**

- [ ] Up to 5 targets per comparison run
- [ ] Matrix report
- [ ] Storage of comparison results

**CLI**

- [ ] `eval run`, `eval set list`, `eval determinism`, `eval compare`, `eval promote`, `eval results`
- [ ] Bootstrap auth (replaced by Obj 36 SDK auth when available)

**Trajectory Promotion**

- [ ] Platform-admin promote flow
- [ ] PII gate (redacted-workspace path)
- [ ] Opt-out workspace consent gate
- [ ] PR creation with templated entry

**UI**

- [ ] Manual replay UI for platform admins
- [ ] Eval results browser

**Cost Tracking**

- [ ] Separate platform eval budget bucket
- [ ] Per-prompt cost trend dashboards

**Audit & Observability**

- [ ] All audit events emitted
- [ ] All metrics emitted
- [ ] Grafana dashboards for evals, replays, determinism, calibration

**Documentation**

- [ ] ADRs 0299–0308 written and Accepted
- [ ] All runbooks in Section 6.10 written
- [ ] Eval authoring guide
- [ ] Grading rubric guide
- [ ] CI threshold tuning guide

**Verification**

- [ ] All 26 verification steps in Section 9 pass

---

## 11. Anti-Patterns to Refuse

- **Replays writing artifacts, advancing state, or consuming workspace budgets.** Pollution safety is mandatory.
- **Caching replay responses.** Always bypass.
- **Self-grading the grader.** Bounded recursion via calibration set; no exceptions.
- **Skipping CI gates by editing thresholds in code.** Override requires an ADR amendment.
- **Using string-equality diffs for structured output.** Type-aware diffs only.
- **Running determinism checks against `temperature > 0` prompts.** Determinism is a property of `temperature: 0` only.
- **Promoting trajectories without PII gate.** No exceptions, even for "trusted" workspaces.
- **Substituting tools at replay time.** Retired-tool trajectory replays fail loudly.
- **Aggregating replay results across workspaces in customer-visible dashboards.** Internal-only.
- **Treating eval results as ground truth without calibration awareness.** Calibration drift invalidates grader output; CI catches this.
- **Running cross-provider comparisons in production traffic ("just route 5% to the new model").** This is offline replay; live A/B is out of scope.

---

## 12. Open Questions for Confirmation Before Starting

1. **CI threshold defaults (5% quality, 10% structural, 20% cost)** — calibrated by gut. Tune after first month?
2. **Calibration set size (20 entries)** — enough? Too many → calibration runs are expensive. Too few → coarse signal. Acceptable starting point?
3. **Determinism tolerance (variance ≤ 0.05)** — needs validation against real prompts; starting conservative.
4. **Eval budget allocation** — what's the platform's monthly eval budget? Proposing $500/month to start.
5. **Replay retention (180 days for ad-hoc, indefinite for PR-attached)** — acceptable? Storage growth is real.
6. **Cross-provider cap (5 targets)** — practical limit; bigger sweeps run sequentially. Acceptable?
7. **CLI auth bootstrap** — temporary config-file API key until Obj 36 lands. Or block this objective on Obj 36? Proposing temporary.

---

## 13. What Comes Next

With Objective 35 complete, the prompt-iteration loop closes: real production trajectories feed evals; evals catch regressions before merge; nightly determinism catches model drift; cross-provider comparisons inform provider-switching decisions. The locked decisions in Objective 20 around prompt evaluation become operationally enforceable.

**Objective 36 (IDE & CLI Surfaces)** consumes the eval CLI subcommands shipped here as part of its broader CLI surface. Eval CLI authentication graduates from bootstrap to the full SDK auth model.

For the platform team, this objective is the daily-use tool: every prompt change runs through it before merge; every model upgrade is verified by it; every cross-provider decision is informed by it. The discipline locked into Objective 20 becomes the discipline actually shipped.

---

_This document is the contract. Every checkbox in Section 10 must be true before the eval CI gate becomes mandatory across all prompt PRs._
