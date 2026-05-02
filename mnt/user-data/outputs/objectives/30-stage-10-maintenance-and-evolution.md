# Objective 30: Stage 10 — Maintenance & Evolution

**Status:** Ready for development
**Prerequisites:** All prior objectives (1–29) complete
**Blocks:** Nothing — this is the final stage; the AI pipeline is complete after this objective ships

---

## 1. Purpose

Apps don't end at deployment. Bugs surface in production. Users request features. Performance degrades. Requirements evolve. Security advisories emerge. The stage that handles this — the **Maintenance & Evolution** stage — closes the AI pipeline's loop. Production reality feeds back into the pipeline; specific stages re-engage with that feedback; updates flow through the full pipeline (re-test, re-deploy) without starting from scratch.

This stage is what differentiates "we shipped a working app" from "we shipped a working app and the platform helps us evolve it." Without this stage, the customer ships v1 and is on their own. With it, the platform stays useful indefinitely — the pipeline isn't a one-shot build, it's an iterating system.

A good Maintenance & Evolution stage:
- **Surfaces production signals**: errors, performance issues, user feedback, dependency advisories
- **Routes signals to relevant stages**: a bug in a UI component goes back to Stage 6; a slow query goes to Stage 4 or 7; a new requirement goes back to Stage 2
- **Supports incremental change**: regenerate one component without regenerating the whole app
- **Tracks change provenance**: every change has clear lineage from signal to deployment
- **Coordinates breaking changes**: schema changes, dependency updates, API version bumps
- **Manages technical debt**: surfaces accumulating debt; suggests when to invest in cleanup
- **Handles security updates**: dependency vulnerabilities, platform-level security patches, customer-code patches

This stage doesn't need its own grand new infrastructure. It needs to **wire the existing stages together for iteration**: production observability (already built) → signal classification → routing to stages (already built) → re-deployment (already built). The novel work is the signal-classification and routing logic.

---

## 2. Scope

### In Scope

- **Signal collection from production**: errors, slow requests, user-reported bugs, customer feedback, dependency advisories
- **Signal classification**: identify which pipeline stage a signal points to
- **Change request artifact**: structured artifact representing "this needs to change, and here's why"
- **Pipeline re-engagement**: re-run specific stages with the change request as input
- **Selective regeneration**: only the affected artifacts regenerate; downstream stages re-engage as needed
- **Change tracking**: every change has lineage from signal → request → re-engaged stage → new deployment
- **Dependency management**: track customer-app dependencies (via the curated SDK and integration catalog); surface advisories
- **Schema evolution**: handle non-trivial schema changes that span deployments (deprecate columns, migrate data, then drop)
- **Versioning of deployed apps**: customer-facing version numbers (semver-style) tied to deployments
- **Change history UI**: see what changed when, why, and what was redeployed
- **Bug report intake**: structured form for reporting bugs from within the running app or from external sources
- **Feature request intake**: structured form for new requirements
- **Approval routing for changes**: per workspace's `change_request` configuration
- **Quality signals across iterations**: track whether changes produce regressions
- ADRs

### Out of Scope (Belongs to Later Objectives)

- Customer support / helpdesk workflows (out of scope; customer uses external tools or builds their own)
- Auto-fix of bugs without human review (deferred indefinitely; AI suggesting fixes with human approval is in scope; auto-fixing is not)
- Automated dependency updates without explicit approval (deferred — same reason)
- A/B testing of competing implementations (deferred)
- Custom analytics dashboards beyond what Objective 3 provides (deferred)
- Customer-controlled feature flags / experiments (deferred — could be a useful future feature)
- Automated performance optimization (deferred — surfacing issues yes; auto-fixing no)
- AI-suggested architectural refactoring (deferred)
- Self-modifying prompt iteration based on production outcomes (the platform team iterates prompts; not the customer's app)

---

## 3. Locked Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Signal sources | Errors (Sentry-style), slow requests (APM), user bug reports, dependency scanners, customer feedback | Cover common iteration drivers |
| Change request artifact | Structured artifact with: signal source, severity, classification, suggested stage, reasoning | Reviewable, traceable |
| Routing logic | AI-assisted classification + user override | AI suggests; user confirms |
| Regeneration scope | Smallest possible — single artifact preferred; cascading regeneration only when truly needed | Minimize blast radius |
| Selective deploy | Yes — deploy only changed artifacts; full deploy on schema changes | Efficient |
| Change history retention | 1 year by default; longer with explicit retention | Bounded storage |
| Customer app versioning | Semver-style (vX.Y.Z); auto-bumped per deploy; user can override | Standard |
| Approval routing | Per workspace's `change_request` stage; dev changes typically self-approve, prod changes require approval | Reuse |
| Bug report intake | In-app widget (optional, customer enables) + manual entry + integrations (Sentry, etc.) | Flexible |
| Cost target | $0.10–$1.00 per change request handling (varies by complexity) | Cost-aware |

---

## 4. Architectural Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│              PRODUCTION SIGNALS                                        │
│                                                                       │
│   - Errors (from monitoring)                                          │
│   - Slow requests (from APM)                                          │
│   - User-reported bugs (in-app widget, support email)                 │
│   - Feature requests                                                  │
│   - Dependency advisories                                             │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│              MAINTENANCE & EVOLUTION SERVICE                           │
│                                                                       │
│   1. Signal ingestion — receive from various sources                  │
│   2. Signal triage — duplicate detection, severity assignment         │
│   3. Classification — AI identifies which pipeline stage              │
│   4. Change request creation — structured artifact                    │
│   5. Routing — engage the appropriate stage with the request          │
│   6. Stage re-engagement — Stage 2, 4, 6, 7 etc. handle as before     │
│   7. Cascade detection — does this change require downstream regen?   │
│   8. Re-test (Stage 8)                                                │
│   9. Re-deploy (Stage 9)                                              │
│  10. Outcome tracking — did the change resolve the signal?             │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
                ┌────────────────────────┐
                │   Change Request        │
                │  Artifact                │
                │  - Source signal         │
                │  - Stage classification  │
                │  - Affected artifacts    │
                │  - Resolution status     │
                └─────────────────────────┘
                             │
                             ▼
                ┌────────────────────────┐
                │   Change History UI     │
                │  - Active requests       │
                │  - Resolved requests     │
                │  - Pipeline impact       │
                │  - Outcome tracking      │
                └─────────────────────────┘
```

---

## 5. The Hard Parts

**5.1 Signal classification — which stage?**

A production error appears: "TypeError: Cannot read property 'name' of undefined at ContactsList.tsx:42." Which stage does this go back to?

Most likely: Stage 6 (UI Generation). The error is in a generated component. The fix is to regenerate that component.

But it could also be:
- Stage 7 (Code Generation) if the data the UI receives is wrong
- Stage 4 (Schema) if the column the UI expects doesn't exist
- Stage 2 (PRD) if the requirement was misinterpreted upstream

The classification prompt:
- Reads the error context (stack trace, request, response, related artifacts)
- Reads the affected artifacts' reasoning
- Suggests which stage(s) need to re-engage
- Provides confidence

The user reviews the classification and confirms or overrides. This is critical — incorrect classification wastes regeneration cost on the wrong stage.

For unclear cases, the AI can suggest "Stage 6 first; if that doesn't fix it, try Stage 4." Cascading attempts.

**5.2 Change request as the unit of work**

A signal becomes a Change Request artifact:

```typescript
interface ChangeRequest {
  source: ChangeRequestSource;             // error, perf, user_bug, feature_request, dependency_advisory
  severity: 'critical' | 'high' | 'medium' | 'low';
  classification: StageClassification;
  affectedArtifactIds: string[];
  description: string;
  suggestedStages: string[];                // e.g., ['ui_generation', 'code_generation']
  resolutionStatus: 'open' | 'in_progress' | 'resolved' | 'wont_fix' | 'duplicate';
  resolutionNotes?: string;
  
  // Lineage
  rootSignalId: string;                     // the original signal
  duplicateOfRequestId?: string;            // if this is a duplicate
  resolvedByDeploymentId?: string;          // if resolved
}
```

Change requests are first-class artifacts: versioned, audit-tracked, approval-routed. They're the unit of iteration.

**5.3 Selective regeneration**

The change request points at one or more stage artifacts. Regeneration:
- The targeted artifact regenerates with the change request as input
- The stage's prompt receives both the original inputs AND the change request feedback
- The user reviews the regenerated artifact (Stage 6's review UI for components, etc.)
- Approval triggers regeneration of downstream affected artifacts (only if needed)

For example: regenerating a UI component generally doesn't affect tests (Stage 8) — the test still validates the same behavior. But if the component's behavior changes in ways the test verifies, the test needs updating too. The platform tracks dependencies and identifies affected downstreams.

The principle: **smallest possible regeneration**. Component-level when possible. Page-level when the change spans multiple components. App-level only when the change is foundational.

**5.4 Cascade detection**

Some changes cascade:
- A schema change cascades to functions that use that schema
- A function signature change cascades to UI components that call it
- A new requirement cascades from PRD through schema, UI, code, tests

The platform tracks these dependencies via the parent/child relationships in the artifact graph. When an artifact regenerates, the platform identifies downstream artifacts that may need regeneration:

- **Stale**: dependency changed; might need update
- **Affected**: dependency changed in a way that requires update
- **Unaffected**: dependency change doesn't matter

The classification is itself a prompt: given the change and the dependent artifact, does this dependency need to update?

For ambiguous cases, the platform marks dependent artifacts stale and prompts the user to decide. Better to over-flag than to silently drift.

**5.5 Re-engagement of stages**

When a change request points at Stage 6, the platform invokes Stage 6's regeneration:

```typescript
// Pseudocode
async function reEngageStage(stage: StageName, request: ChangeRequest): Promise<void> {
  const targetArtifact = await getTargetArtifact(request);
  
  // Pass change request feedback into the stage's regeneration prompt
  const newArtifact = await stages[stage].regenerate(targetArtifact, {
    feedback: request.description,
    severity: request.severity,
    relatedSignals: request.relatedSignals,
  });
  
  // The new artifact goes through the stage's normal lifecycle:
  // draft → submitted → approved → deployed
  await stages[stage].submitForApproval(newArtifact);
}
```

The stages don't know they're being re-engaged for maintenance vs. initial generation. They run their normal flow. This means: maintenance work uses the same approval routing, the same review UIs, the same quality signals as initial generation.

The result: change requests flow through the system uniformly. A bug fix is just another regeneration; a feature addition is just another generation.

**5.6 Re-test and re-deploy**

After approved changes, the pipeline re-tests and re-deploys:

- Stage 8 runs tests against the changed artifacts
- If tests pass: Stage 9 deploys
- The deployment is labeled with both the change request ID and the new app version

The customer sees: "Deployment v0.3.2: Fixed bug in ContactsList (CR-127). Promoted from staging by Alice 12 minutes ago."

The audit trail is dense: every deploy traces back to its change requests; every change request traces back to its signals; every signal traces back to a production observation.

**5.7 Schema evolution**

Schema changes from maintenance are higher-stakes. A bug might require adding a column; a feature might require a new table; a security fix might require a migration. The platform handles this via the Stage 4 → Stage 5 (Data Migration) → Stage 9 (Deployment) chain:

- Stage 4 generates the schema change (additive or destructive)
- Stage 5 generates the migration if data movement is required
- Stage 9 coordinates: schema change first, then code, with rollback if either fails

For destructive changes (drop column with data), the platform offers a multi-deploy pattern:
1. Deploy 1: stop writing to the column (code change)
2. Deploy 2: migrate any remaining data
3. Deploy 3: drop the column

The customer chooses the cadence. The platform helps sequence; doesn't force timing.

**5.8 Dependency management**

The customer's app has dependencies:
- The platform's SDK (Objective 19)
- Curated integrations (Stage 7 catalog)
- React, Tailwind, etc. (the stack from Stage 6)
- The platform itself

Each has a version. Each gets advisories: "SDK v1.4 has a bug; upgrade to v1.5"; "React 18.x has a CVE; upgrade required."

The platform:
- Tracks dependencies for each customer app (via the deployment manifest)
- Subscribes to advisories from the relevant sources
- Surfaces relevant advisories per customer app: "Your app uses SDK v1.4; advisory affects this version"
- Generates change requests for security-critical advisories
- Lets customers configure: "auto-accept patch updates; require approval for minor; require approval + review for major"

The default: nothing auto-applied; everything surfaces as a change request requiring approval. Customers can opt into auto-accepting low-risk updates.

**5.9 Outcome tracking**

After a change is deployed, did it actually fix the problem?
- For error-driven changes: did the error rate drop?
- For perf-driven changes: did latency improve?
- For feature requests: was the feature delivered as requested?
- For bugs: did the bug stop reoccurring?

The platform tracks outcomes by linking change requests to post-deployment metrics:
- Error rates per component before vs. after
- Latency distribution per endpoint before vs. after
- User-reported issue count for the same area before vs. after

If a change DIDN'T fix the problem (errors continue, performance unchanged), the platform surfaces this and the change request reopens. The user can engage another iteration.

**5.10 Quality signals across iterations**

The platform tracks signals that span the pipeline's iterating use:
- **Mean time to resolution**: from signal to deployed fix
- **Regression rate**: how often does a fix introduce new issues?
- **Stage classification accuracy**: how often does the AI's "this needs Stage X" turn out correct?
- **Cascade accuracy**: how often is downstream regeneration actually needed?
- **Customer-reported satisfaction**: did the customer indicate the change fixed their issue?

These signals reveal whether the maintenance loop is working. If MTTR is high, something is slow. If regression rate is high, generation quality is low. If classification accuracy is poor, the routing prompt needs work.

---

## 6. Component Specifications

### 6.1 MaintenanceService

```typescript
// packages/core/src/services/ai/maintenance/maintenance.service.ts

export class MaintenanceService {
  constructor(
    private readonly authz: AuthorizationPort,
    private readonly artifacts: ArtifactService,
    private readonly generation: GenerationService,
    private readonly pipeline: StagePipelineService,
    private readonly stages: PipelineStageRegistry,        // refs to all the stage services
    private readonly observability: ObservabilityPort,    // from Objective 3
    private readonly audit: AuditPort,
    private readonly logger: LoggerPort,
  ) {}

  /** Ingest a signal from any source. */
  async ingestSignal(
    ctx: RequestContext,
    input: SignalInput,
  ): Promise<Result<Signal, AppError>>;

  /** List signals for a workspace. */
  async listSignals(
    ctx: RequestContext,
    workspaceId: string,
    opts: ListOptions,
  ): Promise<Result<PaginatedResult<Signal>, AppError>>;

  /** Classify a signal to identify affected stages. */
  async classifySignal(
    ctx: RequestContext,
    signalId: string,
  ): Promise<Result<SignalClassification, AppError>>;

  /** Create a change request from a signal (or multiple). */
  async createChangeRequest(
    ctx: RequestContext,
    input: CreateChangeRequestInput,
  ): Promise<Result<Artifact<ChangeRequest>, AppError>>;

  /** Get a change request. */
  async getChangeRequest(
    ctx: RequestContext,
    requestId: string,
  ): Promise<Result<Artifact<ChangeRequest>, AppError>>;

  /** Update a change request (severity, classification, etc.). */
  async updateChangeRequest(
    ctx: RequestContext,
    requestId: string,
    changes: ChangeRequestUpdate,
  ): Promise<Result<Artifact<ChangeRequest>, AppError>>;

  /** Engage the appropriate stage(s) to address the change request. */
  async engageStages(
    ctx: RequestContext,
    requestId: string,
  ): Promise<Result<{ engagedStages: string[] }, AppError>>;

  /** Identify downstream artifacts affected by a change. */
  async identifyAffectedDownstream(
    ctx: RequestContext,
    artifactId: string,
  ): Promise<Result<AffectedDownstreamReport, AppError>>;

  /** Mark a change request resolved. */
  async resolveChangeRequest(
    ctx: RequestContext,
    requestId: string,
    resolution: ResolutionInput,
  ): Promise<Result<ChangeRequest, AppError>>;

  /** Subscribe to dependency advisories. */
  async listDependencyAdvisories(
    ctx: RequestContext,
    workspaceId: string,
  ): Promise<Result<DependencyAdvisory[], AppError>>;

  /** Track outcome of a deployed change. */
  async trackOutcome(
    ctx: RequestContext,
    requestId: string,
  ): Promise<Result<OutcomeReport, AppError>>;
}
```

### 6.2 The Signal and Change Request Models

```typescript
interface Signal {
  id: string;
  workspaceId: string;
  source: SignalSource;
  
  // Source-specific data
  errorDetails?: ErrorSignalDetails;
  perfDetails?: PerfSignalDetails;
  userReportDetails?: UserReportDetails;
  advisoryDetails?: DependencyAdvisoryDetails;
  
  severity: 'critical' | 'high' | 'medium' | 'low';
  
  // Triage
  duplicateOfSignalId?: string;
  cluster?: string;                          // grouping similar signals
  
  // Classification
  classification?: SignalClassification;
  
  // Status
  status: 'new' | 'classified' | 'in_change_request' | 'resolved' | 'wont_fix';
  
  observedAt: Date;
  ingestedAt: Date;
}

type SignalSource = 'error' | 'perf' | 'user_report' | 'dependency_advisory' | 'feature_request' | 'manual';

interface ErrorSignalDetails {
  message: string;
  stackTrace?: string;
  affectedRequest?: { method: string; path: string };
  affectedFunctionId?: string;
  affectedComponentId?: string;
  occurrenceCount: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

interface SignalClassification {
  suggestedStages: { stageName: string; confidence: number; reasoning: string }[];
  affectedArtifactIds: string[];
  classifiedAt: Date;
  classifiedBy: 'ai' | 'user';
}

interface ChangeRequest {
  workspaceId: string;
  triggeringSignals: string[];               // signal IDs
  description: string;                        // human-readable summary
  
  classification: SignalClassification;
  
  severity: 'critical' | 'high' | 'medium' | 'low';
  priority: 'p0' | 'p1' | 'p2' | 'p3';
  
  affectedArtifactIds: string[];              // existing artifacts to regenerate
  
  status: 'open' | 'classified' | 'in_progress' | 'pending_approval' | 'approved' | 'in_deployment' | 'resolved' | 'wont_fix' | 'duplicate';
  
  // Lineage
  rootSignalIds: string[];
  duplicateOfRequestId?: string;
  resolvedByDeploymentId?: string;
  
  // Resolution
  resolution?: {
    resolvedAt: Date;
    resolvedByUserId: string;
    notes: string;
    outcomeMetrics?: OutcomeMetrics;
  };
}
```

### 6.3 The Generation Prompts

In `packages/core/src/ai/prompts/maintenance/`:

- `signal-classification.prompt.ts`           — classify signal → stage(s)
- `signal-deduplication.prompt.ts`            — identify duplicate signals
- `affected-downstream-detection.prompt.ts`    — identify cascade effects
- `change-request-summary.prompt.ts`           — summarize multiple signals into a single request
- `outcome-assessment.prompt.ts`               — did the change fix the issue?
- `dependency-advisory-impact.prompt.ts`       — does this advisory affect this app?

These prompts are smaller and more deterministic than other stages — they classify and route rather than generating product code.

### 6.4 Signal Ingestion Adapters

```typescript
// packages/adapters/maintenance-signals/src/

export interface SignalIngestionAdapter {
  source: SignalSource;
  ingest(rawSignal: unknown, workspaceId: string): Promise<Result<Signal, AppError>>;
}

class ErrorSignalAdapter implements SignalIngestionAdapter { /* receives from observability */ }
class PerfSignalAdapter implements SignalIngestionAdapter { /* receives from APM */ }
class UserReportSignalAdapter implements SignalIngestionAdapter { /* receives from in-app widget */ }
class DependencyAdvisoryAdapter implements SignalIngestionAdapter { /* receives from advisory subscriptions */ }
class FeatureRequestAdapter implements SignalIngestionAdapter { /* receives from explicit feature requests */ }
```

Each adapter normalizes its source-specific input into the canonical Signal model. The platform's observability infrastructure (Objective 3) feeds errors and performance signals automatically; user reports come via the in-app widget; dependency advisories via subscriptions.

### 6.5 The In-App Bug Report Widget

A small UI component that customers can embed in their generated apps:

```tsx
import { BugReportWidget } from '@platform-name/sdk-react';

// In the customer's app layout
<BugReportWidget
  position="bottom-right"
  onSubmit={(report) => {
    // Submitted to the platform's signal ingestion
  }}
/>
```

The widget collects:
- User-typed description
- Current URL
- Browser / device info (with permission)
- Recent console errors (with permission)
- Screenshot (with permission)
- The current authenticated user's identity (already known)

Submissions become Signals via the user-report adapter. The customer's app gets a privacy notice the user reviews before submitting.

The widget is opt-in per generated app — the customer enables it during Stage 6 generation or post-deploy.

### 6.6 The Maintenance UI

Lives in `apps/web/src/ai-pipeline/maintenance/`:

- `MaintenancePage.tsx` — main dashboard
- `panels/SignalsListPanel.tsx` — incoming signals; triage view
- `panels/ChangeRequestsPanel.tsx` — open and recent change requests
- `panels/DeploymentTimelinePanel.tsx` — chronological deployment history with linked change requests
- `panels/DependencyAdvisoriesPanel.tsx` — current advisories affecting the app
- `panels/OutcomeTrackingPanel.tsx` — did changes fix what they intended?
- `views/SignalDetail.tsx`
- `views/ChangeRequestDetail.tsx`
- `views/CascadeImpactView.tsx` — visualize affected downstream artifacts
- `dialogs/CreateChangeRequestDialog.tsx`
- `dialogs/EngageStageDialog.tsx`
- `dialogs/ResolveChangeRequestDialog.tsx`

The maintenance dashboard is the customer's "what's happening with my app" view — issues, fixes in flight, recent deployments. It connects to all the prior stages without being a stage itself.

### 6.7 Audit Events

```
ai.maintenance.signal_ingested
ai.maintenance.signal_classified
ai.maintenance.signal_deduplicated
ai.maintenance.change_request_created
ai.maintenance.change_request_updated
ai.maintenance.change_request_engaged_stage
ai.maintenance.change_request_resolved
ai.maintenance.change_request_wont_fix
ai.maintenance.dependency_advisory_received
ai.maintenance.outcome_assessed
ai.maintenance.regression_detected
```

### 6.8 Permissions

```
ai.maintenance.read              — view signals, change requests, advisories
ai.maintenance.create_request   — create change requests
ai.maintenance.engage_stage    — initiate stage re-engagement
ai.maintenance.resolve         — mark change requests resolved
ai.maintenance.config           — configure ingestion sources, advisory subscriptions
```

Default role mappings:
- `workspace_owner`, `workspace_admin`: all
- `architect`: all
- `developer`: read, create_request, engage_stage, resolve
- `qa`: read, create_request, resolve
- `business_analyst`: read, create_request
- `reviewer`, `viewer`: read
- Custom roles configurable

### 6.9 Database Schema

```typescript
signals: {
  ...standardColumns,
  workspace_id: uuid,
  source: enum,
  source_data: json,                          // source-specific details
  severity: enum,
  cluster: string?,
  duplicate_of_signal_id: uuid?,
  classification: json?,
  status: enum,
  observed_at: timestamp,
}
indexes: [workspace_id, status, _created_at DESC], [workspace_id, cluster]

change_requests: {
  ...standardColumns,
  workspace_id: uuid,
  description: text,
  classification: json,
  severity: enum,
  priority: enum,
  affected_artifact_ids: json,
  status: enum,
  triggering_signal_ids: json,
  duplicate_of_request_id: uuid?,
  resolved_by_deployment_id: uuid?,
  resolution: json?,
}
indexes: [workspace_id, status], [workspace_id, severity, _created_at DESC]

dependency_advisories: {
  ...standardColumns,
  workspace_id: uuid?,                        // null = installation-wide
  source: enum,                                // 'platform_sdk', 'integration', 'transitive'
  package_name: string(255),
  affected_versions: string(255),
  fixed_version: string(255)?,
  severity: enum,
  description: text,
  cve_id: string(50)?,
  url: text?,
}
indexes: [workspace_id, package_name], [_created_at DESC]
```

### 6.10 Quality Signal Specifics

```typescript
interface MaintenanceQualitySignals {
  workspaceId: string;
  
  // Speed
  meanTimeToClassificationMinutes: number;
  meanTimeToResolutionMinutes: number;
  
  // Accuracy
  classificationAccuracyRate: number;            // user agreed with AI classification
  cascadeAccuracyRate: number;                    // downstream regen was actually needed
  
  // Quality
  regressionRate: number;                        // % of fixes that caused new issues
  duplicateDetectionRate: number;
  
  // Volume
  signalsIngestedPerWeek: number;
  changeRequestsCreatedPerWeek: number;
  changeRequestsResolvedPerWeek: number;
  
  // Outcomes
  outcomeFixRate: number;                        // % of changes that actually resolved the signal
}
```

### 6.11 Operational Runbooks

- `maintenance-signal-classification-poor.md` — when AI keeps misclassifying
- `maintenance-cascade-storm.md` — when a single change keeps triggering downstream regenerations
- `maintenance-regression-after-fix.md` — handling fix-induced regressions
- `maintenance-dependency-advisory-storm.md` — when many advisories arrive at once
- `maintenance-stuck-change-request.md` — change requests that don't progress
- `maintenance-outcome-not-improving.md` — when fixes don't actually fix the underlying issue

---

## 7. Implementation Order

1. **Signal, change request schemas locked.**

2. **Database tables migrated.**

3. **Signal ingestion adapters** for the five source types.

4. **Signal classification prompt** with test suite.

5. **Signal deduplication prompt.**

6. **Affected downstream detection prompt.**

7. **Change request summary prompt.**

8. **Outcome assessment prompt.**

9. **Dependency advisory impact prompt.**

10. **MaintenanceService skeleton.**

11. **Signal ingestion end-to-end** (errors, perf signals from observability).

12. **In-app bug report widget** as a SDK component.

13. **Change request creation from signals.**

14. **Stage re-engagement** wiring to existing stage services (Stage 2, 4, 6, 7).

15. **Cascade detection** identifying affected downstream artifacts.

16. **Re-test integration** (calls Stage 8).

17. **Re-deploy integration** (calls Stage 9).

18. **Outcome tracking** linking deployments to signal resolution.

19. **Dependency advisory ingestion**.

20. **Maintenance UI** with all panels and dialogs.

21. **Stage pipeline integration** (change request approval routing).

22. **Quality signal recording.**

23. **Audit events emitted.**

24. **End-to-end test**: production error → signal → classification → change request → stage re-engagement → re-deploy → resolution.

25. **Documentation, ADRs, runbooks.**

26. **Verify Definition of Done.**

---

## 8. ADRs to Write

- **ADR-0219: Signals as First-Class Inputs to the Pipeline** — production reality feeds back; pipeline iterates
- **ADR-0220: AI-Assisted Classification with Human Override** — AI suggests; user confirms
- **ADR-0221: Smallest Possible Regeneration** — minimize blast radius
- **ADR-0222: Cascade Detection via Artifact Graph** — explicit dependencies; bounded propagation
- **ADR-0223: Outcome Tracking Closes the Loop** — did the fix actually fix it?
- **ADR-0224: Dependency Advisories Surface but Don't Auto-Apply** — humans decide upgrades
- **ADR-0225: In-App Widget for User Reports** — opt-in; privacy-respecting; structured intake

---

## 9. Verification Steps

1. **Production error ingested** automatically from observability; appears in signal list.

2. **Signal classified** by AI; suggests Stage 6 (UI) for a UI-layer error.

3. **User confirms classification** or overrides; classification saved.

4. **Duplicate detection**: 100 instances of the same error grouped into one signal.

5. **Change request created** from signal; affected artifacts identified.

6. **Stage re-engagement**: change request triggers Stage 6 regeneration of a specific component.

7. **Cascade detection**: regenerating a function flags affected components.

8. **Re-test runs**: Stage 8 runs against the regenerated artifacts; passes.

9. **Re-deploy succeeds**: Stage 9 deploys the change; environment marked deployed.

10. **Outcome tracking**: error rate drops post-deploy; change request marked resolved with outcome metrics.

11. **Outcome doesn't improve**: error continues; change request reopens; user can engage another iteration.

12. **In-app widget**: user submits bug report from a deployed app; signal ingested; appears in dashboard.

13. **Dependency advisory**: a CVE is detected affecting the SDK; advisory surfaces; suggested change request created.

14. **Severity assignment**: critical errors marked critical; cosmetic issues marked low; AI-assisted with user override.

15. **Multi-signal change request**: 3 signals about the same root cause grouped into one request.

16. **Approval routing**: production change requests require approval per workspace config.

17. **Smallest regeneration**: a UI bug fix regenerates only that component, not the whole app.

18. **Cascade limits**: cascade-induced regeneration bounded; user warned if cascade is large.

19. **Provider failover**: classification mid-flight fails over to backup provider.

20. **Cost tracking**: per-change-request cost recorded.

21. **Audit trail**: every signal → request → engagement → deployment chain audited.

22. **Quality signals**: classification accuracy, regression rate, MTTR, outcome fix rate recorded.

23. **Cross-database**: maintenance works for all three database drivers.

24. **Maintenance dashboard**: signals, change requests, advisories visible per workspace.

25. **Iteration over time**: workspace handles 10 change requests over a week; pipeline produces 10 deploys; everything traced.

26. **Stale handling**: if upstream artifact (e.g., PRD) changes, dependent artifacts marked stale automatically.

If all 26 pass, the objective is met.

---

## 10. Definition of Done

**Schema & Types**
- [ ] Signal, ChangeRequest, DependencyAdvisory schemas locked
- [ ] All sub-structures locked

**Database**
- [ ] All tables migrated on three database drivers

**Prompts**
- [ ] Signal classification
- [ ] Signal deduplication
- [ ] Affected downstream detection
- [ ] Change request summary
- [ ] Outcome assessment
- [ ] Dependency advisory impact
- [ ] Test suites per prompt

**Service Layer**
- [ ] MaintenanceService implemented
- [ ] All signal, classification, change-request, engagement, outcome methods
- [ ] Stage pipeline integration
- [ ] Approval routing for change requests

**Ingestion**
- [ ] Error signal adapter (from observability)
- [ ] Perf signal adapter (from APM)
- [ ] User report adapter (from widget)
- [ ] Dependency advisory adapter
- [ ] Feature request adapter (from explicit input)

**In-App Widget**
- [ ] BugReportWidget component in @platform-name/sdk-react
- [ ] Privacy-respecting; opt-in capture (screenshot, console, etc.)
- [ ] Submission to maintenance service

**Stage Re-engagement**
- [ ] Wiring to Stage 2 (PRD)
- [ ] Wiring to Stage 4 (Schema)
- [ ] Wiring to Stage 6 (UI)
- [ ] Wiring to Stage 7 (Code)
- [ ] Wiring to Stage 8 (Tests)
- [ ] Wiring to Stage 9 (Deploy)

**Cascade Handling**
- [ ] Affected downstream detection
- [ ] Cascade limits (warn if cascade is large)
- [ ] Stale flagging

**Outcome Tracking**
- [ ] Link deployments to change requests
- [ ] Track post-deploy metrics
- [ ] Detect resolution success / failure

**Dependency Advisories**
- [ ] Subscription to platform-relevant advisories
- [ ] Per-app affected detection
- [ ] Surface in UI; auto-create change requests for critical

**UI**
- [ ] Maintenance page with all panels
- [ ] Signal detail view
- [ ] Change request detail view
- [ ] Cascade impact view
- [ ] All dialogs (create, engage, resolve)

**Quality & Observability**
- [ ] Quality signals recorded
- [ ] Per-prompt dashboards
- [ ] Stage-specific metrics
- [ ] MTTR tracking

**Permissions**
- [ ] Stage permissions added
- [ ] Default role grants

**Cross-Database**
- [ ] Maintenance works on all three database drivers

**Documentation**
- [ ] ADRs 0219–0225 written and Accepted
- [ ] All runbooks in Section 6.11 written
- [ ] Customer-facing maintenance guide

**Verification**
- [ ] All 26 verification steps in Section 9 pass

---

## 11. Anti-Patterns to Refuse

- **Auto-fixing bugs without human review.** AI suggests; humans approve. Always.
- **Auto-applying dependency updates.** Surfaces advisories; humans decide.
- **Skipping the smallest-regeneration discipline.** Bug in one component shouldn't regenerate the whole app.
- **Hiding cascade effects.** When changes cascade, the user sees what's affected before approving.
- **Ignoring outcome tracking.** Did the fix actually fix? If not, the system should know.
- **Letting change requests grow unbounded.** Bounded scope; if it's getting too big, split into multiple.
- **Treating user-reported bugs as low priority by default.** Severity classification is data-driven, not status-based.
- **Allowing classifications without confidence indicators.** AI suggests with confidence; low confidence flagged.
- **Skipping audit on resolution.** Every resolution captured; outcome tracked.
- **Letting maintenance use different patterns than initial generation.** Stage re-engagement uses same prompts, same approval, same review UIs.
- **Building self-modifying prompts.** The platform team iterates prompts; not the customer's app.

---

## 12. Open Questions for Confirmation Before Starting

1. **Auto-create change requests for critical advisories** — proposing yes for security-critical CVEs. Some teams want even critical advisories to be human-reviewed first. Recommendation: auto-create as draft requiring approval; user can configure to disable auto-create.

2. **Bug report widget privacy implications** — proposing privacy-respecting capture (with explicit user permissions for screenshot, console, etc.). Each capture is an opt-in.

3. **Outcome assessment automation** — proposing AI-driven assessment of "did this fix resolve the signal." Some teams want manual assessment only. Recommendation: AI-suggested with human override.

4. **Cascade limits** — proposing warn if cascade affects > 5 artifacts. Acceptable threshold?

5. **Change request retention** — proposing 1 year. Acceptable?

6. **Customer apps using their own observability vs. platform's** — proposing the platform's observability is the default; customers can integrate external observability (Sentry, Datadog) and feed signals through. Acceptable?

7. **Outcome metric measurement window** — how long after deploy do we measure outcome? Proposing 24-72 hours; configurable per signal type. Acceptable?

---

## 13. What Comes Next

With Objective 30 complete, the AI Build Pipeline is **complete**. The customer's full lifecycle is covered:

1. **Stage 1**: Intent capture
2. **Stage 2**: PRD generation
3. **Stage 3**: Design tokens
4. **Stage 4**: Schema synthesis
5. **Stage 5**: Data migration (optional)
6. **Stage 6**: UI generation
7. **Stage 7**: Code generation
8. **Stage 8**: Test generation
9. **Stage 9**: Deployment
10. **Stage 10**: Maintenance & evolution

Combined with the Data Management Module (Objectives 11-19) and the foundation (Objectives 1-10), the platform delivers the master plan's full vision: structured AI-assisted development that takes a customer from "I want to build X" through "X is deployed, tested, monitored, and maintainable" — without writing code.

What's been specified:
- **30 objectives** spanning foundation, data management, and AI pipeline
- **~225 ADRs** documenting key decisions
- **Three databases supported** from day one (Postgres, MSSQL, MongoDB)
- **Two operating systems** supported (Linux primary, Windows first-class)
- **Two products** on one foundation: a Supabase-equivalent and an AI build pipeline
- **Configurable approval routing** that scales from solo workflows to enterprise

What's still ahead:
- Implementation. Each objective is a contract; building them is the multi-year work.
- Customer feedback driving prioritization within and across objectives.
- Iteration on prompts, design decisions, capability matrices as customers actually use the platform.
- The AGPL-3.0 + CLA Assistant licensing approach preserving dual-licensing optionality.

The platform's value proposition is now articulated end-to-end. Microsoft houses get modern data tooling. Displaced enterprise professionals get structured development that doesn't produce vibe-coded crap. Solo developers and Microsoft enterprise houses use the same machinery, configured differently. The thesis from the original conversation holds.

This is enough specification to build a real product. The 30 documents are the contract; they're stored at `/mnt/user-data/outputs/objectives/`; the journal entry summarizes them; the next session can pick up at any objective and proceed.

---

*This document is the contract. Every checkbox in Section 10 must be true to declare the AI Build Pipeline complete.*
