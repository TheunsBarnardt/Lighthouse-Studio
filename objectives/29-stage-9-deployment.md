# Objective 29: Stage 9 — Deployment

**Status:** Ready for development
**Prerequisites:** Objectives 2 (Environment Strategy), 6 (Multi-Tenancy / Approval Routing), 9 (Cross-Platform Runtime), 20 (AI Pipeline Foundation), 24 (Schema), 26 (UI Generation), 27 (Code Generation), 28 (Test Generation) complete
**Blocks:** Objective 30 (Maintenance & Evolution — operates on deployed apps)

---

## 1. Purpose

Take the approved artifacts — UI from Stage 6, server functions from Stage 7, tests from Stage 8 — and **deploy them through the customer's environment pipeline** (dev → staging → production, or whatever the workspace's environments are configured as in Objective 2). Tests run on every deployment; failures block production; rollback works on a single click.

This stage is the moment the customer's app becomes real. Not "I have a working preview"; actually "my app is live at acme.example.com, my users are using it, my data is flowing through it." The customer hasn't written code; they've reviewed AI-generated artifacts; now those artifacts run in production.

A good deployment stage:

- **Promotes through environments in order** — dev first; then staging; then production. Each gate has its own approval.
- **Runs tests at each gate** — tests must pass to advance to the next environment
- **Supports rollback** — a single action reverts to the previous deployment
- **Is observable** — health checks, metrics, logs visible during and after deployment
- **Is auditable** — every deployment recorded; who, what, when, why
- **Is fast for normal cases** — typical deployments minutes, not hours
- **Handles failures gracefully** — partial failures don't leave the system half-deployed

This stage is where the platform's infrastructure investments (Objective 2's environment strategy, Objective 9's cross-platform runtime, Objective 4's database migrations) pay off. The deployment uses everything that's already there; this stage is the orchestrator.

---

## 2. Scope

### In Scope

- **Deployment plan generation**: AI generates the plan; user reviews
- **Deployment artifacts**: bundled UI, bundled server functions, schema migrations, configuration
- **Per-environment deployment**: dev → staging → prod with approval gates
- **Schema migration coordination**: schema changes deploy alongside code (atomically where possible)
- **Test execution**: tests from Stage 8 run pre-deployment; failures block
- **Health checks**: post-deployment, verify the app is responding correctly
- **Rollback**: one-action revert; resilient to partial-deploy state
- **Configuration management**: per-environment config (API keys, feature flags, etc.) via SecretStorePort
- **Deployment monitoring UI**: real-time view of deploy progress; logs; metrics; status
- **Multi-instance deployment**: rolling deploys for production environments
- **Blue/green deployment option**: zero-downtime deploys via parallel environments
- **Deployment notifications**: notify configured users when a deployment starts/completes/fails
- **Approval routing**: per workspace's `deployment` stage; production typically requires architect or workspace owner
- ADRs

### Out of Scope (Belongs to Later Objectives)

- Custom deployment infrastructure beyond what Objective 2 + 9 provide (deferred — not all customers will want what the platform offers; for now, the platform's infrastructure is the deployment target)
- Deployment to customer-managed Kubernetes clusters or other custom infrastructure (deferred — interesting future capability)
- Canary deployments with traffic-percentage routing (deferred — full canary infrastructure is heavyweight; rolling and blue/green are sufficient for v1)
- Automated rollback on metric-threshold breaches (deferred — auto-rollback is risky; humans decide)
- Multi-region deployments / geo-distributed apps (deferred — single-region per environment for v1)
- DNS management / TLS certificate provisioning (out of scope; assumed to be handled by the platform's existing infrastructure or customer's DNS)
- CDN configuration (deferred; platform CDN is the v1 default)
- Database read replicas / sharding (deferred)
- Long-running migration support (large schema changes that span multiple deploys) — deferred; v1 assumes migrations complete in a single deploy

---

## 3. Locked Decisions

| Decision                       | Choice                                                                                                                                                               | Rationale                                                                        |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Environment progression        | Configurable per workspace; defaults to dev → staging → prod                                                                                                         | Customer choice; platform mechanism                                              |
| Approval per environment       | Configurable; defaults: dev = automatic, staging = workspace_admin, prod = architect/owner                                                                           | Sensible defaults; configurable                                                  |
| Test gating                    | Tests from Stage 8 must pass for deploys to staging and prod; configurable for dev                                                                                   | Quality gate                                                                     |
| Schema migration timing        | Migrations run before code deploy; atomic per migration; rollback if code deploy fails                                                                               | Standard pattern                                                                 |
| Rolling vs. blue/green         | Rolling default; blue/green opt-in per environment                                                                                                                   | Resource efficiency; opt-in for zero-downtime needs                              |
| Health check pattern           | Post-deploy, hit known endpoints; verify response shape; verify functions reachable                                                                                  | Standard                                                                         |
| Rollback window                | 7 days; older deployments require explicit recovery procedure                                                                                                        | Bounded resource cost                                                            |
| Notification channels          | In-app, email, Slack, Discord (via integration adapters from Stage 7)                                                                                                | Reuse                                                                            |
| Deployment plan artifact       | Generated; reviewed; approved before execution                                                                                                                       | Reuse pattern                                                                    |
| Configuration format           | YAML for human review; per-environment overrides                                                                                                                     | Standard                                                                         |
| Cost target                    | Deployment generation: $0.50–$2.00 per plan; runtime cost varies with infrastructure                                                                                 | Cost-aware                                                                       |
| Approval routing               | Per workspace's `deployment` stage configuration                                                                                                                     | Reuse                                                                            |
| Production deployment requires | All Stage 8 tests passing AND approval per workspace config AND health check after deploy                                                                            | Discipline                                                                       |
| Deployment orchestrator        | First-party (`apps/deploy-orchestrator/`); no third-party PaaS (supersedes ADR-0017)                                                                                 | Single security/audit boundary; no external runtime dep                          |
| Build                          | BuildKit (`docker buildx`) for container deploys; `pnpm build` + tarball for native deploys; SBOM (CycloneDX) emitted in both modes                                  | SBOM is the scan-gate input regardless of mode                                   |
| Artifact registry              | Local OCI registry (`registry:2`) for container artifacts; signed tarball store on the platform host for native artifacts; remote artifact stores pluggable          | Self-contained; no external pull dependency                                      |
| Deploy mode                    | **Per app, per environment**: `container` (Docker Compose v2) **or** `native` (systemd on Linux, `node-windows` + IIS on Windows). Customer chooses per environment. | Customers without Docker (regulated, bare-metal, legacy Windows) are first-class |
| Target host topology           | Single host **or** multiple hosts via SSH (Linux) / WinRM (Windows). Hosts registered per workspace environment.                                                     | Physical machines and VMs supported, not just the platform's own VPS             |
| Edge proxy / TLS               | Embedded **Caddy** on Linux hosts; **IIS + ARR** on Windows hosts; config generated from deploy plan; on-demand Let's Encrypt where the host can reach ACME          | OSS where possible; native Windows path uses what Windows fleets already run     |
| Multi-host clustering          | Multi-host deploys to fleets of registered hosts (rolling across hosts); full clustering / scheduler / HA out of scope v1                                            | Real customers have multiple boxes; orchestrator must speak to them              |
| CVE scan gate                  | `VulnerabilityScannerPort` scans SBOM + image before promotion; `critical` blocks prod                                                                               | Closes pre-deploy security gap                                                   |
| Scanner adapter                | `adapter-scanner-grype` with cached OSV DB (offline)                                                                                                                 | No third-party SaaS call                                                         |

---

## 4. Architectural Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                  INPUTS (from prior stages)                            │
│                                                                       │
│   - Approved UI Project (Stage 6)                                     │
│   - Approved Server Code Project (Stage 7)                            │
│   - Approved Test Suite (Stage 8)                                     │
│   - Approved Schema (Stage 4)                                         │
│   - Workspace environments configuration (Objective 2)                │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│                  DEPLOYMENT SERVICE                                    │
│                                                                       │
│   1. Deployment plan generation                                       │
│      - Sequence: schema → server functions → UI → health check        │
│      - Per environment: dev → staging → prod                          │
│      - Approval gates per environment                                  │
│   2. Bundle production-ready artifacts                                │
│   3. Per-environment execution                                        │
│      a. Run tests (Stage 8)                                           │
│      b. Apply schema migrations                                       │
│      c. Deploy server functions to runtime                            │
│      d. Deploy UI bundle                                              │
│      e. Run health checks                                             │
│      f. Mark environment deployed                                     │
│   4. Promotion: gate to next environment requires approval            │
│   5. Rollback: revert to previous deployment                          │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
                ┌────────────────────────┐
                │   Deployment Artifact   │
                │  - Plan                  │
                │  - Per-env status        │
                │  - Health metrics        │
                │  - Audit trail           │
                └─────────────────────────┘
                             │
                             ▼
                ┌────────────────────────┐
                │   Deployment Monitor    │
                │  - Live progress         │
                │  - Logs                  │
                │  - Health metrics        │
                │  - Rollback button       │
                └─────────────────────────┘
                             │
                             ▼
                  Live application at the
                  customer's URL
```

---

## 5. The Hard Parts

**5.1 The deployment plan**

Like prior stages, deployment starts with a plan artifact:

```yaml
deployment_plan:
  app_version: 'v0.0.1'
  source_artifacts:
    ui: ui_project_artifact_id
    server: server_code_artifact_id
    schema: schema_artifact_id
    tests: test_suite_artifact_id

  environments:
    - name: dev
      auto_deploy: true
      tests_required: false
      approvers: []
    - name: staging
      auto_deploy: false
      tests_required: true
      approvers: ['workspace_admin']
      notification_channels: ['slack']
    - name: prod
      auto_deploy: false
      tests_required: true
      approvers: ['architect', 'workspace_owner']
      mode: blue_green
      health_check:
        timeout_seconds: 60
        endpoints: ['/api/health', '/']
      notification_channels: ['slack', 'email']

  schema_migrations:
    - sequence: 1
      direction: forward
      reversible: true
      reasoning: 'Add deal_score column to contacts table'
```

The plan is reviewable. The user sees what will happen, in what order, with what approvals. They can adjust the plan (e.g., "tests required for dev too" or "use rolling deploy for prod instead of blue/green").

The plan reuses the workspace's environments configuration from Objective 2. The customer doesn't define environments here — they're already defined; this stage uses them.

**5.2 Schema migration coordination**

Schema changes from Stage 4 deploy alongside the rest of the app. Coordination matters:

**Forward-compatible changes** (additive: new columns, new tables, new indexes): deploy schema first; then code that uses it. Old code keeps running with the new schema; new code uses new structure.

**Backward-incompatible changes** (drop column, rename, change type): require careful sequencing. Standard pattern:

1. Phase 1: deploy code that handles BOTH old and new schemas
2. Phase 2: deploy schema change
3. Phase 3: deploy code that uses only new schema

For v1, the platform's heuristic: if a migration is destructive AND the deploy involves multi-instance rolling, the user is warned and asked to deploy in two phases manually. Automated multi-phase deployment is a future enhancement.

For atomic-deployable migrations (single instance, brief downtime acceptable): the platform deploys schema and code together within a transaction window; rollback on failure restores both.

**5.3 Per-environment execution**

For each environment in the plan:

1. **Pre-flight check**: environment ready (database accessible, runtime up, prior deployment stable)
2. **Run tests**: if required for this environment, run Stage 8 tests against an ephemeral instance of this environment's setup; failures abort
3. **Apply schema migrations**: in order; each in its own transaction; rollback on failure
4. **Deploy server functions**: bundle uploaded; runtime updates the deployed version; health endpoint verifies functions reachable
5. **Deploy UI**: bundle uploaded; CDN/static-host updates; cache invalidated
6. **Health check**: hit configured endpoints; verify expected responses
7. **Mark deployed**: environment record updated; notifications sent

Each step is recoverable: if step N fails, steps 1 through N-1 are still valid (or rolled back if they were destructive). The platform doesn't leave environments in indeterminate states.

**5.4 Approval gates between environments**

After dev deploys, the user (or configured approver) reviews and clicks "Promote to staging." After staging, "Promote to production." The platform doesn't auto-progress through environments unless explicitly configured.

For workspaces that want auto-progression (e.g., a dev workspace where every commit deploys to a single environment), the configuration is per-environment `auto_deploy: true`.

For high-stakes environments, the platform supports multi-approver requirements: production deploys may require both architect AND workspace owner, both must approve before proceeding.

**5.5 Rolling vs. blue/green**

Two deployment modes:

**Rolling** (default):

- The platform's runtime is multi-instance for production
- Updates go instance-by-instance; old version serves traffic during update
- One instance updated; health-checked; removed from rotation if failing
- Resource-efficient (no doubling of capacity)
- Brief windows where mixed-version state exists

**Blue/Green**:

- A second parallel environment ("green") spun up alongside the live one ("blue")
- Tests run against green
- Traffic switched atomically when green is ready
- Old (blue) kept warm for quick rollback
- Doubles resources during the deploy window

Blue/green is opt-in per environment. Recommended for production environments where mixed-version states are unacceptable (e.g., realtime collaboration apps). Rolling is fine for stateless API-driven apps.

**5.6 Health checks and validation**

Post-deploy, the platform runs health checks:

- Hit `/api/health` — expects 200 with `{"status": "healthy"}` or similar
- Hit a known UI route — expects 200 with valid HTML
- Hit each deployed server function via a synthetic invocation — expects expected response
- Verify schema reachable — basic SELECT against a known table

Failures within the configured timeout (default 60 seconds) trigger:

- Rollback (if rollback policy is auto-on-health-fail)
- Or alert (if rollback requires human decision)

The platform's default policy: rollback on health-fail in dev/staging; alert in production (humans decide rollback in prod). Configurable per workspace.

**5.7 Rollback**

Rollback is a single action:

- The platform maintains the prior deployment's artifacts
- Rollback reverts: schema (run reverse migrations if reversible), server code (redeploy old bundle), UI (redeploy old bundle)
- Health check after rollback
- Audit entry: who initiated, when, why

For schema changes that aren't reversible (e.g., the migration dropped a column with data), rollback is partial: code reverts; schema doesn't. The platform alerts loudly when this happens — "Code rolled back, but schema cannot be reverted automatically. Data may be missing."

The 7-day retention default keeps the prior version warm. Older versions can be recovered through a more involved procedure (in the runbook).

**5.8 Configuration management**

Per-environment configuration (different API keys, different feature flags, different rate limits per environment):

- Stored via SecretStorePort
- Per-environment overrides explicit in the deployment plan
- Generated server functions and UI components receive config via the platform's runtime
- Customers can edit config without redeploying (most config is hot-reloadable)

For things that require redeployment (e.g., compile-time feature flags, environment-specific build configurations), the deployment plan captures them and the user is aware of the redeployment requirement.

**5.9 Multi-instance coordination**

For production environments running multiple instances:

- The platform's runtime infrastructure (Objective 9) handles instance management
- Deployment coordinates across instances
- Rolling deploys: one instance at a time; health-check between
- Failed-instance: marked unhealthy; load balancer stops sending traffic; deployment continues with remaining
- All instances must reach the new version for the deployment to be marked "completed"

**5.10 Deployment monitoring UI**

The user watches the deployment in real-time:

- Per-environment status (queued, running, deployed, failed, rolled back)
- Per-step progress within environment (test, schema, server, UI, health-check)
- Streaming logs from the deployment process
- Health metrics post-deploy (request rate, error rate, latency)
- One-click rollback if something looks wrong

Notifications fire at lifecycle events: deploy started, deploy succeeded, deploy failed, rolled back. Channels: in-app, email, Slack/Discord (via integrations from Stage 7).

**5.11 The deploy "after" experience**

Once production is deployed, the customer's app is live. The platform doesn't disappear — it continues:

- Real-time monitoring of metrics, errors, performance
- Logs from server functions and UI accessible
- Audit trail of every API call, every function invocation
- The customer can investigate issues, find errors, debug

This monitoring capability is partly already in place (Objective 3: Observability Foundation). This stage's specific contribution is wiring the monitoring to surface deployment-specific views — "show me the metrics for the v0.0.1 deployment vs. v0.0.2."

**5.12 Quality signals**

Beyond Objective 20's generic signals:

- **Deployment plan acceptance rate**: how often is the AI-generated plan approved without modification?
- **Test failure rate**: how often do tests fail during deployment, blocking production?
- **Rollback rate**: how often do customers roll back deployments?
- **Mean time to deploy**: from approval to production-live
- **Health check failure rate**: how often does post-deploy health check fail?

These signals reveal whether the platform's generated apps deploy reliably.

---

## 6. Component Specifications

### 6.1 DeploymentService

```typescript
// packages/core/src/services/ai/deployment/deployment.service.ts

export class DeploymentService {
  constructor(
    private readonly authz: AuthorizationPort,
    private readonly artifacts: ArtifactService,
    private readonly generation: GenerationService,
    private readonly pipeline: StagePipelineService,
    private readonly environments: EnvironmentService, // from Objective 2
    private readonly runtime: RuntimePort, // from Objective 9
    private readonly testRunner: TestRunnerPort, // from Objective 28
    private readonly migrations: SchemaMigrationPort, // from Objective 11
    private readonly storage: StorageService,
    private readonly audit: AuditPort,
    private readonly logger: LoggerPort,
  ) {}

  /** Generate a deployment plan from approved artifacts. */
  async generateDeploymentPlan(ctx: RequestContext, input: GeneratePlanInput): Promise<Result<Artifact<DeploymentPlan>, AppError>>;

  /** Get a deployment plan. */
  async getDeploymentPlan(ctx: RequestContext, planId: string): Promise<Result<Artifact<DeploymentPlan>, AppError>>;

  /** Update the plan based on user edits. */
  async updateDeploymentPlan(ctx: RequestContext, planId: string, changes: PlanChanges): Promise<Result<Artifact<DeploymentPlan>, AppError>>;

  /** Submit the plan for approval. */
  async submitForApproval(ctx: RequestContext, planId: string): Promise<Result<Artifact<DeploymentPlan>, AppError>>;

  /** Initiate deployment for a specific environment. */
  async deployToEnvironment(ctx: RequestContext, planId: string, environmentName: string): Promise<Result<Deployment, AppError>>;

  /** Get deployment status. */
  async getDeployment(ctx: RequestContext, deploymentId: string): Promise<Result<Deployment, AppError>>;

  /** Stream deployment progress (for live UI). */
  streamDeploymentProgress(ctx: RequestContext, deploymentId: string): AsyncIterable<DeploymentEvent>;

  /** Approve promotion to next environment. */
  async approvePromotion(ctx: RequestContext, deploymentId: string, targetEnvironment: string): Promise<Result<Deployment, AppError>>;

  /** Roll back a deployment. */
  async rollback(ctx: RequestContext, deploymentId: string, reason?: string): Promise<Result<Deployment, AppError>>;

  /** Cancel an in-progress deployment. */
  async cancelDeployment(ctx: RequestContext, deploymentId: string): Promise<Result<Deployment, AppError>>;

  /** Get deployment history for a workspace. */
  async listDeployments(ctx: RequestContext, workspaceId: string, opts: ListOptions): Promise<Result<PaginatedResult<DeploymentSummary>, AppError>>;
}
```

### 6.2 The Deployment Plan Artifact

```typescript
interface DeploymentPlan {
  appVersion: string;
  workspaceId: string;

  sourceArtifacts: {
    uiProjectId: string;
    serverCodeProjectId: string;
    schemaId: string;
    testSuiteId: string;
  };

  environments: EnvironmentDeploymentConfig[];

  schemaMigrations: SchemaMigrationStep[];
  irreversibleOperations: IrreversibleOperation[];

  globalConfig: {
    rollbackRetentionDays: number;
    healthCheckTimeoutSeconds: number;
    notificationChannels: string[];
  };
}

interface EnvironmentDeploymentConfig {
  name: string;
  autoDeploy: boolean;
  testsRequired: boolean;
  approvers: string[]; // roles or user IDs
  approvalMode: 'any_of' | 'all_of';
  deployMode: 'rolling' | 'blue_green';
  healthCheck: HealthCheckConfig;
  notificationChannels: string[];
}

interface Deployment {
  id: string;
  planId: string;
  environment: string;
  status: 'pending' | 'running' | 'deployed' | 'failed' | 'rolled_back' | 'cancelled';

  progress: DeploymentProgress;

  startedAt: Date;
  completedAt?: Date;
  startedByUserId: string;

  steps: DeploymentStep[];
  healthCheckResults?: HealthCheckResults;
  rollbackTargetVersion?: string;
}

interface DeploymentStep {
  stepType: 'pre_flight' | 'tests' | 'schema' | 'server' | 'ui' | 'health_check' | 'cleanup';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: Date;
  completedAt?: Date;
  details?: Record<string, unknown>;
  errorMessage?: string;
}

interface DeploymentEvent {
  type: 'step_started' | 'step_completed' | 'step_failed' | 'log_line' | 'health_check_result' | 'rollback_started' | 'completed';
  timestamp: Date;
  data: Record<string, unknown>;
}
```

### 6.3 The Generation Prompts

In `packages/core/src/ai/prompts/deployment/`:

- `deployment-plan-generation.prompt.ts` — generate the plan from approved artifacts
- `migration-sequencing.prompt.ts` — order schema migrations correctly
- `health-check-config.prompt.ts` — generate health check endpoint config from UI/functions
- `rollback-feasibility.prompt.ts` — assess whether changes are rollback-safe
- `regeneration.prompt.ts` — regenerate the plan with feedback
- `orchestrator.prompt.ts` — top-level

The prompts are smaller and more deterministic than other stages — deployment plans follow patterns; the AI mostly fills in template-style decisions.

### 6.4 Deployment Execution

The deployment executor is a state machine:

```typescript
// packages/core/src/services/ai/deployment/deployment-executor.ts

export class DeploymentExecutor {
  async execute(deploymentId: string): Promise<void> {
    // 1. Load deployment + plan
    // 2. State machine through steps:
    //    pre_flight -> tests -> schema -> server -> ui -> health_check -> cleanup
    // 3. Each step:
    //    - Update status to running
    //    - Execute step logic
    //    - Stream events to subscribers (realtime layer)
    //    - On failure: stop; mark deployment failed; trigger rollback if configured
    // 4. On success: mark deployment deployed; emit completion notification
  }

  async rollback(deploymentId: string): Promise<void> {
    // 1. Load deployment + plan
    // 2. Reverse steps in order: ui -> server -> schema (if reversible)
    // 3. Run health check after rollback
    // 4. Mark rolled_back; emit notifications
  }
}
```

The executor uses Objective 9's runtime port for actual deployment operations; Objective 11's migration port for schema operations; Objective 28's test runner for pre-deploy tests.

### 6.5 Database Schema

```typescript
deployments: {
  ...standardColumns,
  workspace_id: uuid,
  plan_artifact_id: uuid,
  environment: string(100),
  status: enum,
  app_version: string(50),
  source_ui_project_id: uuid,
  source_server_code_project_id: uuid,
  source_schema_id: uuid,
  source_test_suite_id: uuid,
  started_at: timestamp,
  completed_at: timestamp?,
  started_by_user_id: uuid,
  approval_id: uuid?,
  rollback_target_deployment_id: uuid?,
  details: json,                            // step results, health check results, etc.
}
indexes: [workspace_id, environment, _created_at DESC], [workspace_id, status]

deployment_logs: {
  ...standardColumns,
  deployment_id: uuid,
  timestamp: timestamp,
  level: enum,                              // 'info', 'warn', 'error'
  step: string(50),
  message: text,
  details: json,
}
indexes: [deployment_id, timestamp]
```

### 6.6 The Deployment Monitor UI

Lives in `apps/web/src/ai-pipeline/deployment/`:

- `DeploymentPage.tsx` — main page; recent deployments list
- `panels/DeploymentPlanPanel.tsx` — review/edit plan
- `panels/DeploymentMonitorPanel.tsx` — live progress
- `panels/EnvironmentStatusPanel.tsx` — current state per environment
- `panels/LogsPanel.tsx` — streaming logs
- `panels/HealthMetricsPanel.tsx` — post-deploy metrics
- `panels/HistoryPanel.tsx` — past deployments
- `dialogs/PromoteDialog.tsx` — promote to next environment
- `dialogs/RollbackDialog.tsx` — confirm rollback
- `dialogs/CancelDeploymentDialog.tsx`

The page shows a clear "what's deployed where" view: each environment with its current version, status, last deploy time, and deploy button.

### 6.7 Audit Events

```
ai.deployment.plan_generated
ai.deployment.plan_edited
ai.deployment.plan_approved
ai.deployment.deployment_initiated
ai.deployment.environment_pre_flight_check
ai.deployment.tests_run
ai.deployment.tests_passed
ai.deployment.tests_failed
ai.deployment.schema_migration_started
ai.deployment.schema_migration_completed
ai.deployment.schema_migration_failed
ai.deployment.server_deploy_started
ai.deployment.server_deploy_completed
ai.deployment.ui_deploy_started
ai.deployment.ui_deploy_completed
ai.deployment.health_check_started
ai.deployment.health_check_passed
ai.deployment.health_check_failed
ai.deployment.environment_promoted
ai.deployment.deployment_completed
ai.deployment.deployment_failed
ai.deployment.deployment_cancelled
ai.deployment.rollback_initiated
ai.deployment.rollback_completed
ai.deployment.rollback_failed
```

Production deployments and rollbacks are audited at info level always; lower environments at debug.

### 6.8 Permissions

```
ai.deployment.create        — generate deployment plans
ai.deployment.read           — view deployments and plans
ai.deployment.deploy_dev    — execute deploys to dev
ai.deployment.deploy_staging — execute deploys to staging
ai.deployment.deploy_prod    — execute deploys to production
ai.deployment.approve       — approve plans
ai.deployment.rollback      — initiate rollback
ai.deployment.cancel         — cancel in-progress deployments
```

Default role mappings:

- `workspace_owner`: all
- `workspace_admin`: all
- `architect`: create, read, deploy_dev/staging/prod, approve, rollback, cancel
- `developer`: create, read, deploy_dev (and staging via approval), cancel own deployments
- `qa`: read; deploy_dev (for test verification)
- `business_analyst`, `reviewer`, `viewer`: read
- Custom roles configurable

### 6.9 Quality Signal Specifics

```typescript
interface DeploymentQualitySignals {
  deploymentId: string;

  // Plan
  planAcceptedFirstSubmission: boolean;
  planEditsBeforeApproval: number;

  // Execution
  testsPassedFirstAttempt: boolean;
  schemaMigrationFailures: number;

  // Outcome
  outcome: 'completed' | 'failed' | 'rolled_back' | 'cancelled';
  totalDurationMinutes: number;

  // Health
  healthCheckPassed: boolean;
  healthCheckTime: number;

  // Rollback
  rolledBack: boolean;
  rollbackReason?: string;
  rollbackInitiatedHoursAfterDeploy?: number;
}
```

### 6.10 Operational Runbooks

- `deployment-stuck.md` — diagnosing hung deployments
- `deployment-partial-failure.md` — recovering from mid-deploy failures
- `deployment-rollback-failed.md` — when rollback itself fails
- `deployment-schema-irreversible.md` — handling rollback when schema can't revert
- `deployment-health-check-flapping.md` — debugging intermittent post-deploy health failures
- `deployment-multi-instance-coordination.md` — instance-level deployment issues
- `deployment-config-drift.md` — when prod config diverges from plan

---

## 7. Implementation Order

1. **Deployment plan, deployment, and step schemas locked.**

2. **Database schema migrated.**

3. **Plan generation prompt** with test suite.

4. **Migration sequencing prompt.**

5. **Health check config prompt.**

6. **Rollback feasibility prompt.**

7. **DeploymentService skeleton.**

8. **DeploymentExecutor state machine.**

9. **Per-step execution logic** wiring Objective 9 runtime, Objective 11 migrations, Objective 28 tests.

10. **Pre-flight checks.**

11. **Test execution as a deploy step.**

12. **Schema migration step.**

13. **Server function deployment step.**

14. **UI deployment step.**

15. **Health check step.**

16. **Rolling deployment mode.**

17. **Blue/green deployment mode.**

18. **Rollback execution.**

19. **Per-environment approval gating.**

20. **Notification integration** (in-app, email, Slack/Discord).

21. **Deployment monitor UI** with real-time streaming.

22. **History and audit views.**

23. **Stage pipeline integration** (plan-level approval; deployment per environment).

24. **Quality signal recording.**

25. **Audit events emitted.**

26. **End-to-end test**: plan → approve → deploy dev → promote staging → tests pass → promote prod → live app.

27. **Rollback test**: deploy → rollback → verify previous version live.

28. **Cross-platform tests**: Linux and Windows deployment paths.

29. **Documentation, ADRs, runbooks.**

30. **Verify Definition of Done.**

---

## 8. ADRs to Write

- **ADR-0212: Per-Environment Approval Gates** — explicit progression; production approval discipline
- **ADR-0213: Tests Required for Production Deployment** — quality discipline
- **ADR-0214: Rolling Default, Blue/Green Opt-In** — resource efficiency vs. zero-downtime
- **ADR-0215: Schema Migrations Coordinated With Code Deploys** — atomic where possible; warnings for irreversible
- **ADR-0216: Rollback as First-Class Action** — single-click; bounded retention
- **ADR-0217: Health Checks Mandatory Post-Deploy** — verifies deployment actually worked
- **ADR-0218: Configuration via SecretStorePort, Per-Environment Overrides** — hot-reloadable where possible
- **ADR-0242: Pre-Deploy Vulnerability Scan Gate (Grype + Cached OSV DB)** — offline image + SBOM scan; severity policy gates promotion
- **ADR-0243: First-Party Deployment Orchestrator (supersedes ADR-0017)** — platform owns container build, registry, Compose runtime, edge proxy, rollout/rollback; no external PaaS dependency

---

## 9. Verification Steps

1. **Generate deployment plan** from approved artifacts; covers all environments configured for the workspace.

2. **Plan review**: user edits plan (e.g., adds a notification channel); changes persist.

3. **Plan approval**: per workspace config (typically architect or owner).

4. **Deploy to dev**: tests run (if configured), schema migrates, server deploys, UI deploys, health check passes; environment marked deployed.

5. **Promote to staging**: requires approval; tests run; deployment proceeds.

6. **Promote to production**: requires approval per workspace config; deployment proceeds with chosen mode (rolling or blue/green).

7. **Health check failure** in dev: deployment marked failed; rollback if configured; alerts sent.

8. **Health check failure** in production: alerts sent; rollback decision left to humans.

9. **Rollback**: single-action; reverts code; warns if schema not reversible; subsequent health check passes.

10. **Cancellation**: in-progress deployment cancelled cleanly; no half-deployed state.

11. **Schema migration coordination**: deploy includes schema change + dependent code; succeeds atomically.

12. **Schema migration failure mid-deploy**: rolls back the schema; code deploy aborted; deployment marked failed.

13. **Multi-instance rolling**: production with 3 instances; rolling deploy updates one at a time; all reach new version.

14. **Blue/green production**: green spun up; tests pass; traffic switched; blue kept warm; rollback works for 7 days.

15. **Notification channels**: deploy success notification sent via configured Slack and email channels.

16. **Configuration overrides**: prod uses different API keys than dev; correctly applied; secrets injected via SecretStorePort.

17. **Cross-platform**: deployment works on Linux runtime and Windows runtime equivalently.

18. **Deployment monitor UI**: shows live progress; logs stream; status updates in real-time.

19. **Deployment history**: last 100 deployments visible; filter by environment, status, time range.

20. **Per-environment approval routing**: dev auto; staging workspace_admin; prod architect+owner; respected.

21. **Tests blocking production**: failing test suite blocks prod deploy; user must address.

22. **Audit trail**: every deployment, every step, every rollback recorded.

23. **Provider failover for plan generation**: AI mid-flight failover works.

24. **Cost tracking**: per-deployment cost (plan generation + runtime resources) tracked.

25. **Quality signals**: outcome, duration, rollback rate recorded; per-environment dashboards.

26. **End-to-end timing**: full pipeline (plan → prod) within target time for typical app (< 30 minutes).

27. **CVE scan gate (clean)**: deploying a clean SBOM passes scan; promotion proceeds.

28. **CVE scan gate (vulnerable)**: injecting a known-vulnerable dependency yields a `critical` finding; prod promotion blocked; finding visible in deploy UI.

29. **Air-gapped scan**: with the platform offline from the public internet, scan still runs against the cached OSV DB.

30. **Container mode end-to-end**: a sample app builds via BuildKit, pushes to the local OCI registry, runs under Compose, is reachable via Caddy on HTTPS (LE staging cert), and rolls back to prior digest within 60s.

31. **Caddy upstream flip**: blue/green flip is atomic; no requests dropped during the swap (verified by a load-generator running through the cutover).

32. **Native deploy to Linux host (no Docker)**: a sample app deploys to a fresh Ubuntu VM with **only Node.js installed** — no Docker, no Coolify. Resulting service is managed by systemd, fronted by Caddy, and reachable on HTTPS.

33. **Native deploy to Windows host (no Docker)**: a sample app deploys to a fresh Windows Server with **only Node.js + IIS** — no Docker. Resulting service runs under `node-windows`, fronted by IIS+ARR, and reachable on HTTPS.

34. **Bare-metal physical machine deploy**: a sample app deploys to a registered physical-host target (no virtualization, no container runtime), reachable on HTTPS, rollback works.

35. **Multi-host rolling deploy**: a sample app deploys across a fleet of 3 Linux hosts (or 3 Windows hosts); rolling strategy drains and updates one host at a time; load-generator confirms zero downtime.

36. **Air-gapped native deploy**: target host has no internet egress; deploy succeeds using customer-supplied TLS cert and a pre-staged tarball.

37. **Rollback in native mode**: a deployed native service is rolled back; prior tarball + unit/IIS config reinstalled; service back on prior version within 60s.

If all 37 pass, the objective is met.

---

## 10. Definition of Done

**Schema & Types**

- [ ] DeploymentPlan, Deployment, DeploymentStep types
- [ ] All sub-structures locked

**Database**

- [ ] deployments and deployment_logs tables migrated on all three databases

**Prompts**

- [ ] Deployment plan generation
- [ ] Migration sequencing
- [ ] Health check config
- [ ] Rollback feasibility
- [ ] Regeneration
- [ ] Orchestrator
- [ ] Test suites per prompt

**Service Layer**

- [ ] DeploymentService implemented
- [ ] DeploymentExecutor state machine
- [ ] All deployment, promotion, rollback, cancel methods
- [ ] Stage pipeline integration

**Execution Steps**

- [ ] Pre-flight checks
- [ ] Test execution
- [ ] Schema migration
- [ ] Server function deployment
- [ ] UI deployment
- [ ] Health check
- [ ] Cleanup

**Deployment Modes**

- [ ] Rolling deployment
- [ ] Blue/green deployment
- [ ] Configurable per environment

**Rollback**

- [ ] One-action rollback
- [ ] 7-day retention default
- [ ] Schema irreversibility handling

**Notifications**

- [ ] In-app, email, Slack, Discord
- [ ] Configurable channels per environment

**UI**

- [ ] Deployment plan editor
- [ ] Deployment monitor with real-time streaming
- [ ] Environment status overview
- [ ] Logs panel
- [ ] Health metrics panel
- [ ] History panel
- [ ] Promote, rollback, cancel dialogs

**Quality & Observability**

- [ ] Quality signals recorded
- [ ] Per-prompt dashboards
- [ ] Stage-specific metrics
- [ ] Per-environment health dashboards

**Permissions**

- [ ] Stage permissions added
- [ ] Default role grants
- [ ] Per-environment deploy permissions

**Cross-Platform**

- [ ] Linux deployments work (platform host and customer-app host)
- [ ] Windows deployments work (platform host and customer-app host)
- [ ] All three database drivers supported

**First-Party Orchestrator — Common**

- [ ] `apps/deploy-orchestrator/` package implements `DeploymentPort`
- [ ] CycloneDX SBOM emitted per artifact in both container and native modes
- [ ] Per-app, per-env deploy-mode selection: `container` | `native`
- [ ] Target host registry per workspace environment (single-host or multi-host fleets)
- [ ] SSH transport for Linux hosts; WinRM transport for Windows hosts
- [ ] Rollback restores prior artifact + config within 60s in both modes
- [ ] Secrets injected from `SecretStorePort` at render time; redacted in streamed logs
- [ ] Audit events: `deploy.build.*`, `deploy.scan.*`, `deploy.rollout.*`, `deploy.rollback.*`, `deploy.host.*`
- [ ] ADR-0017 marked `Superseded by ADR-0243`

**First-Party Orchestrator — Container Mode**

- [ ] BuildKit container build via `docker buildx`
- [ ] Local OCI registry (`registry:2`) packaged with platform install; remote registry pluggable
- [ ] Docker Compose v2 renderer; one project per app+env
- [ ] Embedded Caddy edge proxy with on-demand Let's Encrypt TLS, tested against LE staging
- [ ] Rolling deploy: new container up → health check → upstream swap in Caddy → drain → remove
- [ ] Blue/green: two Compose projects, atomic upstream flip

**First-Party Orchestrator — Native Mode (no Docker required on target)**

- [ ] Build emits a signed tarball (Node.js bundle + manifest + SBOM); reproducible
- [ ] Linux native: systemd unit rendered and installed on target host; Caddy reverse proxy config rendered and reloaded
- [ ] Windows native: `node-windows` service rendered and installed; IIS site + ARR reverse proxy config rendered and reloaded
- [ ] Health check post-install hits `/health` from the orchestrator side
- [ ] Rolling deploy across host fleet: drain one host's traffic at the proxy, install new artifact, health-check, restore traffic, move on
- [ ] Blue/green native: two service unit names per env, atomic proxy flip
- [ ] Rollback re-installs prior tarball + prior unit/IIS config
- [ ] Native deploys work on hosts with **no internet egress** (no Let's Encrypt, no public registry); customer-supplied TLS cert path supported

**Vulnerability Scan Gate**

- [ ] `VulnerabilityScannerPort` defined in `packages/ports/vulnerability-scanner/`
- [ ] `adapter-scanner-grype` reference adapter; vendored binary; offline OSV DB cache
- [ ] SBOM scan + image scan run before every promotion
- [ ] Severity policy: `critical` blocks prod by default, `high` requires approval, configurable per workspace
- [ ] Scan results attached to deployment record; surfaced in deploy UI

**Documentation**

- [ ] ADRs 0212–0218 written and Accepted
- [ ] ADR-0242 (pre-deploy scan gate) written and Accepted
- [ ] ADR-0243 (first-party orchestrator; supersedes ADR-0017) written and Accepted
- [ ] All runbooks in Section 6.10 written
- [ ] Customer-facing deployment guide

**Dev-Grade Output (D-series, per [docs/roadmap/v2-future-scope.md](../docs/roadmap/v2-future-scope.md))**

- [ ] **D3 — Generated CI/CD config.** Every deployment plan emits a CI/CD config (GitHub Actions by default; GitLab CI as a documented alternative) into the generated project repo. The config runs the same test/build/migration pipeline the platform runs — so the dev's team can execute the pipeline themselves without re-binding to Lighthouse Studio. Verified by a fresh checkout of a generated project running the emitted workflow end-to-end on a clean runner.
- [ ] **D4 — Secrets boundary at deploy time.** Deployment writes secrets into the target environment's standard secret mechanism (env vars, cloud secret manager, k8s secrets) — no runtime callbacks to the platform's SecretStorePort to fetch app-runtime secrets. Generated apps remain runnable with the platform offline. Verified by deploying a sample app, taking the platform offline, and confirming the deployed app continues to serve requests and access its secrets.
- [ ] **D8 (deploy slice) — Observability hooks survive deployment.** Deployment plans wire `/health` into the platform's deployment monitor AND leave `/health` and `/metrics` accessible to the dev's own observability stack (Prometheus scrape target, OTel collector endpoint). Deployed apps remain observable when the platform is offline. Verified by deploying a sample app, taking the platform offline, and scraping `/metrics` from outside the platform.

**Verification**

- [ ] All 37 verification steps in Section 9 pass

---

## 11. Anti-Patterns to Refuse

- **Auto-progressing through environments without approval gates.** Production approval is a human decision.
- **Skipping tests for production deployments.** Tests run; failures block. Discipline.
- **Allowing rollback that the schema can't actually support without alerting loudly.** Surface clearly when rollback is partial.
- **Leaving environments in indeterminate states on failure.** Each step is recoverable; mid-deploy failure has a clear recovery path.
- **Running schema migrations without coordination with code deploys.** Atomic where possible; warned where not.
- **Hardcoded environment configurations in deployment plans.** Per-environment overrides via SecretStorePort.
- **Deployments that bypass the platform's auth/audit/observability infrastructure.** Everything goes through standard paths.
- **Auto-rollback on metric breaches without human confirmation.** Risky; humans decide rollback in production.
- **Cross-region or multi-region deploys.** Out of scope; single region per environment.
- **Third-party PaaS as the orchestrator.** Coolify/Dokploy/CapRover/etc. are not used at runtime; the platform owns the orchestrator (see ADR-0243 superseding ADR-0017).
- **Bypassing the CVE scan gate.** No "skip-scan" flag; severity policy is configurable but the gate itself is mandatory.
- **Calling external CVE/SBOM SaaS during deploy.** All scanning is offline against a cached OSV DB; air-gapped installs must remain functional.
- **Container-only thinking.** Native deploys to physical machines and VMs without Docker are first-class; "just put it in a container" is not an answer for customers without a container runtime.
- **Coupling the deploy plan to a single host topology.** Customers run fleets, single boxes, mixed Linux/Windows estates; the orchestrator handles all of these.
- **Letting deployments run for hours.** Bounded; long deployments indicate problems.
- **Surface-only health checks (just `/health` endpoint).** Multiple endpoints; functional verification, not just liveness.

---

## 12. Open Questions for Confirmation Before Starting

1. **Default rollback retention 7 days** — appropriate? Some teams want 30+ days. Recommendation: 7 days default; configurable up to 30 with storage cost implications.

2. **Auto-deploy to dev by default** — confirmed? Or should every environment require approval? Recommendation: auto-deploy to dev; explicit approval for staging+; configurable.

3. **Tests required for staging** — proposing yes. Acceptable, or should it be configurable from the start? Recommendation: required by default; can be disabled per workspace with an explicit acknowledgment.

4. **Blue/green resource implications** — doubles capacity during deploy. For small workspaces, this might be cost-prohibitive. Acceptable to require explicit opt-in?

5. **Production deployment approvers** — proposing architect+owner all_of by default. Some teams want one approver. Recommendation: customizable; default conservative.

6. **Schema rollback when irreversible** — proposing partial rollback (code reverts; schema doesn't) with loud alerting. Acceptable, or should the platform refuse to deploy irreversible changes without explicit acknowledgment?

7. **Deployment plan cost** — proposing $0.50-$2.00. Acceptable? The plan is mostly template-driven; cost should be low.

---

## 13. What Comes Next

With Objective 29 complete, the customer's app is **live in production**. They have a functioning, tested, deployed application — built without writing code, deployed without operating infrastructure.

But apps aren't done at deployment. Bugs surface in production. Users request features. Requirements evolve. The pipeline must support iteration.

**Objective 30: Stage 10 — Maintenance & Evolution** is the final stage. It closes the loop: production feedback (bug reports, error rates, user feedback) feeds back into the pipeline; specific stages can be re-engaged with feedback; updates flow through the full pipeline (re-test, re-deploy) without starting from scratch.

After Objective 30, the AI Build Pipeline is complete. Combined with the Data Management Module (Objectives 11-19) and the foundation (Objectives 1-10), the platform delivers the full vision: a structured AI-assisted development pipeline producing complete, deployable, maintainable applications.

---

_This document is the contract. Every checkbox in Section 10 must be true before moving on to Objective 30._
