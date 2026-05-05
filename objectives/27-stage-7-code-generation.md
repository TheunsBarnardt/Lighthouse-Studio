# Objective 27: Stage 7 — Code Generation (Server-Side Logic)

**Status:** Ready for development
**Prerequisites:** Objectives 19 (Public SDK), 20 (AI Pipeline Foundation), 22 (Stage 2: PRD), 24 (Stage 4: Schema), 26 (Stage 6: UI Generation) complete
**Blocks:** Objective 28 (Stage 8: Test Generation — tests this code), Objective 29 (Stage 9: Deployment)

---

## 1. Purpose

The UI generated in Stage 6 calls APIs. Some of those APIs are auto-generated (CRUD via Objective 12) and need no custom code. Some require **custom server-side logic** — calculating deal scores in a CRM, publishing posts on a schedule in a blog, aggregating dashboard data nightly, sending notifications when conditions trigger, integrating with third-party APIs.

This stage generates that custom code: **edge functions** (request-response handlers), **scheduled jobs** (cron-style background tasks), **event handlers** (subscribers to platform events like row-changed, file-uploaded), **integration adapters** (wrappers around third-party APIs the customer wants to use), and **complex validators / transformations** (business logic too involved for the auto-generated API to express).

The output runs on the platform's runtime — sandboxed, observable, audited, deployed through the same environment pipeline as everything else. The customer doesn't manage servers; they describe what should happen, the AI generates code, the platform runs it.

A good code generation stage:

- **Stays small** — most apps need 5-20 custom functions, not 500. The platform resists generating sprawl
- **Is composable with platform primitives** — uses the SDK, the platform's audit, the platform's auth, the platform's observability
- **Is sandboxed** — the customer's code can't escape its limits; can't access other workspaces' data; can't exhaust shared resources
- **Is observable** — every invocation traced, timed, costed
- **Is testable** — accompanied by Stage 8's tests; verified before deployment
- **Respects the existing architecture** — doesn't create parallel patterns; uses platform conventions

This is the most security-sensitive AI stage. Generated code that runs server-side is the highest-risk output the platform produces. The sandbox is the line of defense.

---

## 2. Scope

### In Scope

- **Edge function generation**: HTTP request handlers triggered by API calls
- **Scheduled job generation**: cron-style tasks running on a schedule
- **Event handler generation**: handlers for platform events (row-changed, file-uploaded, user-signed-up, etc.)
- **Integration adapters**: wrappers for common third-party APIs (Stripe, Twilio, SendGrid, OAuth providers, etc.)
- **Custom validators**: business logic validators that supplement schema validation
- **Custom transformations**: data transformations beyond what the platform's transformation library covers
- **Sandboxed runtime**: code runs in isolation; resource-limited; time-bounded
- **Code review UI**: similar to Stage 6's; review generated functions before deploying
- **Function manifest**: structured catalog of generated functions, their triggers, their permissions
- **Permission integration**: each function declares required permissions; runtime enforces
- **Secrets management**: third-party API keys via SecretStorePort; never in generated code
- **Observability**: traces, metrics, logs per invocation
- **Testing hooks**: Stage 8 generates tests; this stage produces test-friendly code (dependency injection, no hard-coded externals)
- **Versioning**: every function version preserved; rollback to prior version possible
- **Approval routing**: server-side code is sensitive; routes per workspace's `server_code` configuration (typically architect)
- ADRs

### Out of Scope (Belongs to Later Objectives)

- Long-running services / persistent processes (deferred — edge functions are request-response or scheduled; not always-on services)
- WebSocket handlers beyond what the platform's realtime layer already provides (deferred)
- Custom database queries beyond what the SDK exposes (deferred — use the query console instead)
- Customer-managed runtime infrastructure (out of scope; the platform owns the runtime)
- Code generation for client-side outside the React app produced in Stage 6 (out of scope; if you need a different client, you write it)
- Plugin system for third-party-developed integrations (deferred — built-in integrations only in v1)
- Custom AI model invocations from edge functions (deferred — possible but introduces complexity)
- Stateful function execution (no in-process state survives invocations; functions are stateless)

---

## 3. Locked Decisions

| Decision             | Choice                                                                                                     | Rationale                                                 |
| -------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Runtime              | Node.js 22+ in a sandboxed worker; specific isolation library determined by Objective 10's security review | Standard, fast, well-supported; isolation prevents escape |
| Language             | TypeScript only                                                                                            | Type safety; same as platform; same as Stage 6 UI         |
| Function shape       | Pure-function-style: `async function handler(input, context): Output`                                      | Testable; predictable                                     |
| Triggers             | HTTP, schedule (cron), event (platform-emitted), manual (admin-invoked)                                    | Cover common patterns                                     |
| Cold start budget    | 500ms (warm); 2 seconds (cold)                                                                             | Sane defaults                                             |
| Execution time limit | 30 seconds default; up to 5 minutes with explicit permission                                               | Bounded; longer goes through job queue                    |
| Memory limit         | 256 MB default; configurable                                                                               | Bounded                                                   |
| Network access       | Outbound only; allowlist per integration; no inbound except via platform API                               | Defensive                                                 |
| File system access   | None for normal functions; per-function tmpfs for those that need it                                       | Isolation                                                 |
| Secrets access       | Via injected context; never in source code                                                                 | Defensive                                                 |
| Function storage     | Source code in artifacts; deployed bundles in storage; metadata in platform DB                             | Standard                                                  |
| Function manifest    | Per-workspace; declares all functions, triggers, permissions                                               | Inspection                                                |
| Cost target          | $1–$10 per generation across an app's full server code                                                     | Cost-aware                                                |
| Approval routing     | Per workspace's `server_code` stage; typically architect approval                                          | Reuse                                                     |

---

## 4. Architectural Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                  INPUTS (from prior stages)                            │
│                                                                       │
│   - Approved PRD (what the app does)                                  │
│   - Schema (data shape)                                               │
│   - UI Project (which functions the UI calls)                         │
│   - SDK types (typed access to data plane)                            │
│   - Available integrations catalog                                    │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│                  CODE GENERATION SERVICE                               │
│                                                                       │
│   1. Function inventory — what functions are needed?                  │
│      a. Scan UI for SDK calls to non-auto-generated endpoints         │
│      b. Read PRD for "the system should..." requirements              │
│      c. Identify scheduled jobs, event handlers, integrations         │
│   2. Per-function generation                                          │
│   3. Per-function validation:                                         │
│      a. TypeScript compilation                                        │
│      b. Static analysis (no escape attempts, no eval)                │
│      c. Resource hint validation                                      │
│   4. Function manifest assembly                                       │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
                ┌────────────────────────┐
                │   Functions Artifact    │
                │  - Source code           │
                │  - Manifest              │
                │  - Per-function          │
                │    metadata              │
                └─────────────────────────┘
                             │
                             ▼
                ┌────────────────────────┐
                │   Code Review UI         │
                │  - Per-function review   │
                │  - Static analysis       │
                │    results               │
                │  - Test stub previews    │
                └─────────────────────────┘
                             │
                             ▼
                  Approved code → Stage 8 (Test Generation)
                  → Stage 9 (Deployment to runtime)
```

---

## 5. The Hard Parts

**5.1 Function inventory: what code is actually needed?**

The biggest risk: generating too much. AI loves to generate; without discipline, the output is 50 functions when the app needs 5. The inventory step is the discipline:

The platform identifies functions from three sources:

**1. UI calls to non-auto-generated endpoints**: scan the UI project for SDK calls. Every call to `platform.data('table').<crud_op>()` is auto-generated; no function needed. Every call to `platform.functions.<name>()` (or similar pattern for custom RPC) needs a function. The UI manifest from Stage 6 makes this explicit — pages declare which functions they invoke.

**2. PRD "the system should..." requirements**: language patterns like "When X happens, Y should...", "Every day at midnight...", "The system sends an email when..." indicate scheduled jobs or event handlers. The AI extracts these explicitly from PRD requirements.

**3. Integration declarations**: the PRD or workspace settings declare integrations (Stripe for payments, SendGrid for emails). Each integration may need adapter functions.

The inventory is itself an artifact — a list of functions to generate, with rationale for each. The user reviews the inventory before any code is generated. They can add, remove, or merge entries.

**5.2 Per-function generation pattern**

Each function is its own artifact, generated by a focused prompt:

- Function name (snake_case)
- Trigger type (http, schedule, event, manual)
- Trigger parameters (URL path, cron expression, event filter)
- Input schema (zod)
- Output schema (zod)
- Required permissions
- Required secrets
- Implementation (TypeScript)
- Reasoning

The implementation is the substantive output. It uses:

- The SDK for data operations (typed; same as Stage 6 UI)
- Injected context for secrets, user identity, request metadata
- Standard logger (platform-provided)
- Standard error types

Functions don't import arbitrary npm packages. They use a curated set of libraries the platform pre-installs in the runtime: SDK, lodash, date-fns, zod, the standard transformation library. Adding new libraries to the curated set is a platform-team action, not per-workspace.

**5.3 The sandbox runtime**

Functions run in a sandbox with hard limits:

**Isolation**:

- Process-level isolation (one Node process per function execution; not threads)
- No shared memory with platform processes
- No filesystem access except per-function tmpfs (if explicitly granted)
- No network access except outbound to the integration allowlist

**Resource limits**:

- 30-second wall-clock default; configurable up to 5 minutes
- 256 MB memory default; configurable
- CPU bounded by the host's allocations
- File descriptors limited

**Network controls**:

- Outbound HTTPS only by default
- Per-function allowlist of permitted hostnames
- No inbound (functions are invoked by the platform's runtime, not directly)

**Secret injection**:

- Secrets passed via context, not environment, not files
- Each secret has a permission requirement; functions must declare which secrets they need

The specific isolation library (gVisor, Firecracker, Node's vm module with hardening, Deno's permissions, or other) is determined by Objective 10's security review. The choice trades off isolation strength vs. cold-start cost.

**5.4 Function shape and conventions**

Every function follows the same shape:

```typescript
// Generated by AI; reviewed by user; deployed via Stage 9.

import type { FunctionContext } from '@platform/runtime';

interface Input {
  contactId: string;
  newScore: number;
}

interface Output {
  success: boolean;
  contactId: string;
  previousScore: number;
}

export async function updateContactScore(input: Input, ctx: FunctionContext): Promise<Output> {
  const { sdk, logger, secrets } = ctx;

  logger.info('Updating contact score', { contactId: input.contactId });

  const contact = await sdk
    .data('contacts')
    .where({ id: { _eq: input.contactId } })
    .one();

  if (!contact) {
    throw new NotFoundError(`Contact ${input.contactId} not found`);
  }

  const previousScore = contact.score;

  await sdk
    .data('contacts')
    .where({ id: { _eq: input.contactId } })
    .update({ score: input.newScore });

  // Trigger downstream effect
  if (input.newScore > 80 && previousScore <= 80) {
    await sdk.functions.notifyHighValueContact({ contactId: input.contactId });
  }

  return {
    success: true,
    contactId: input.contactId,
    previousScore,
  };
}

// Manifest entry (generated alongside)
export const manifest = {
  name: 'update_contact_score',
  trigger: { type: 'http', method: 'POST', path: '/contacts/:id/score' },
  permissions: ['data_table.read', 'data_table.update'],
  secrets: [],
  rateLimit: { requestsPerMinute: 100 },
  timeout: 30000,
};
```

Generated code follows this shape. The shape is enforced via TypeScript types and lint rules; functions that don't conform fail validation.

**5.5 Integration adapters**

Common third-party integrations have a curated catalog:

- **Stripe**: payment processing, subscription management
- **SendGrid / Postmark**: transactional email
- **Twilio**: SMS, voice
- **OAuth providers**: Google, GitHub, etc.
- **Webhooks**: outbound webhook delivery (with retry, signature, idempotency)
- **Slack / Discord**: notification posting
- **AWS S3 / R2 / B2**: external storage beyond platform's storage layer

Each integration has:

- A pre-built adapter (TypeScript module, audited, secure)
- Required configuration (API keys via secrets)
- Standard methods exposed
- Usage examples in the documentation

Generated functions that use integrations import from the adapter library:

```typescript
import { stripe } from '@platform/integrations/stripe';

export async function createCheckoutSession(input, ctx) {
  const { secrets } = ctx;
  const session = await stripe(secrets.stripeApiKey).checkout.sessions.create({
    line_items: [...],
    mode: 'subscription',
  });
  return { url: session.url };
}
```

The customer doesn't write integration plumbing; they get tested adapters with consistent error handling and observability.

For integrations not in the catalog, the platform provides a generic HTTPS-call helper. Customers wanting deeper custom integrations write their own outside the platform (or wait for the platform to add them).

**5.6 Permission and secret declarations**

Every function declares:

- **Permissions it requires**: enforced at invocation. If the calling user lacks permission, the function isn't invoked; 403 returned.
- **Secrets it needs**: enforced at deployment. The function won't deploy if the workspace doesn't have those secrets configured.

Declarations are part of the function's manifest entry; the AI generates them based on the implementation.

A code review step verifies declarations are accurate: if the implementation calls `sdk.data('users').update(...)` but doesn't declare `data_table.update`, validation fails. Static analysis catches this.

**5.7 Static analysis to prevent escape attempts**

Beyond TypeScript compilation, generated code passes through static analysis:

- **No `eval`, `Function()`, or dynamic code execution**: forbidden
- **No `child_process`, `cluster`, or process-spawning**: forbidden
- **No `fs` access beyond declared tmpfs**: forbidden
- **No `net`, `dgram`, raw socket access**: forbidden (HTTPS via approved fetch only)
- **No `crypto` low-level access**: forbidden (use the platform's crypto helpers)
- **Imports limited to the allowlist**: enforced

Failures are flagged; the AI is prompted to revise. Persistent failures surface to the user with the violation details.

The static analysis is the second line of defense (the sandbox is the first). Defense in depth.

**5.8 Per-function generation, with shared context**

Each function generates independently. They share:

- The schema (so all functions know the data shape)
- The SDK types (so all calls are typed)
- The platform's helpers (logger, error types, etc.)

But they don't share state. Each function is independently testable, deployable, regenerable.

For functions that naturally compose ("create a user, then send a welcome email"), the AI chains them via SDK calls — `notifyNewUser` is its own function, and `signupHandler` invokes it via `sdk.functions.notifyNewUser(...)`. Composition through clear interfaces, not shared state.

**5.9 The code review UI**

Like Stage 6, with code-review-specific additions:

- **Function inventory view**: see all generated functions, grouped by trigger type
- **Code viewer**: source code with syntax highlighting
- **Manifest viewer**: trigger config, permissions, secrets
- **Static analysis report**: any flagged issues
- **Reasoning panel**: why this function exists, why this implementation
- **Test stub preview**: stub of what Stage 8 will generate (preview before commit)
- **Approve / Reject / Regenerate**: per function

The diff view (when regenerating) is critical here — server code changes have larger blast radius than UI changes; review needs to be careful.

**5.10 Versioning and rollback**

Function versions are first-class:

- Each generation creates a new version
- Old versions are preserved indefinitely
- The deployed version is always known
- Rollback to a prior version: a single action
- Rollbacks audit-tracked

This matters because generated code WILL have bugs. Customers need to roll back without engineering effort.

**5.11 Quality signals**

Beyond Objective 20's generic signals:

- **Function acceptance rate**: how many generated functions are approved without regeneration?
- **Static analysis pass rate**: how often does generated code pass static analysis on first try?
- **TypeScript compilation rate**: same
- **Runtime failure rate post-deployment**: do generated functions fail at runtime?
- **Edit volume after approval**: how much do users edit functions post-approval?
- **Permission declaration accuracy**: do declared permissions match actual usage?
- **Cost per function generation**: tokens consumed; cost tracked

These signals reveal which prompts produce server-side code that holds up.

---

## 6. Component Specifications

### 6.1 CodeGenerationService

```typescript
// packages/core/src/services/ai/code-generation/code-generation.service.ts

export class CodeGenerationService {
  constructor(
    private readonly authz: AuthorizationPort,
    private readonly artifacts: ArtifactService,
    private readonly generation: GenerationService,
    private readonly pipeline: StagePipelineService,
    private readonly typeChecker: TypeChecker,
    private readonly staticAnalyzer: StaticAnalyzer,
    private readonly integrations: IntegrationCatalog,
    private readonly audit: AuditPort,
    private readonly logger: LoggerPort,
  ) {}

  /** Generate the function inventory from prior stages. */
  async generateInventory(ctx: RequestContext, input: GenerateInventoryInput): Promise<Result<Artifact<FunctionInventory>, AppError>>;

  /** Generate full server code (all functions in inventory). */
  async generateAll(ctx: RequestContext, inventoryArtifactId: string): Promise<Result<Artifact<ServerCodeProject>, AppError>>;

  /** Generate a single function. */
  async generateFunction(ctx: RequestContext, inventoryArtifactId: string, functionSpec: FunctionSpec): Promise<Result<Artifact<ServerFunction>, AppError>>;

  /** Regenerate a function with feedback. */
  async regenerateFunction(ctx: RequestContext, functionArtifactId: string, feedback?: string): Promise<Result<Artifact<ServerFunction>, AppError>>;

  /** Get a function. */
  async getFunction(ctx: RequestContext, functionArtifactId: string): Promise<Result<Artifact<ServerFunction>, AppError>>;

  /** Approve a function. */
  async approveFunction(ctx: RequestContext, functionArtifactId: string): Promise<Result<ServerFunction, AppError>>;

  /** Approve the project. */
  async approveProject(ctx: RequestContext, projectId: string): Promise<Result<ServerCodeProject, AppError>>;

  /** Validate a function (static analysis, type check, etc.). */
  async validateFunction(ctx: RequestContext, functionArtifactId: string): Promise<Result<ValidationReport, AppError>>;

  /** Roll back to a previous version. */
  async rollbackFunction(ctx: RequestContext, functionArtifactId: string, targetVersion: number): Promise<Result<ServerFunction, AppError>>;

  /** Export the project. */
  async exportProject(ctx: RequestContext, projectId: string): Promise<Result<{ downloadUrl: string }, AppError>>;
}
```

### 6.2 The Server Code Project Artifact

```typescript
interface ServerCodeProject {
  prdArtifactId: string;
  schemaArtifactId: string;
  uiProjectArtifactId: string;

  inventoryArtifactId: string;

  functionArtifactIds: string[];

  manifest: ServerManifest;

  buildConfig: ServerBuildConfig;
  validationReport: ValidationReport;
}

interface FunctionInventory {
  functions: FunctionSpec[];
  rationale: string; // why these functions
  inferredFromUi: string[]; // function names extracted from UI calls
  inferredFromPrd: string[]; // function names extracted from PRD requirements
  inferredFromIntegrations: string[]; // function names from integration declarations
}

interface FunctionSpec {
  name: string;
  triggerType: 'http' | 'schedule' | 'event' | 'manual';
  triggerConfig: TriggerConfig;
  description: string;
  inputs: FieldDefinition[];
  outputs: FieldDefinition[];
  requiredPermissions: string[];
  requiredSecrets: string[];
  estimatedComplexity: 'low' | 'medium' | 'high';
}

interface ServerFunction {
  id: string;
  projectId: string;
  spec: FunctionSpec;
  files: ProjectFile[]; // typically 1-3 files: implementation, types, manifest
  reasoning: ReasoningRecord;
  validationReport: FunctionValidationReport;
  qualitySignals: ServerCodeQualitySignals;
}

interface ServerManifest {
  workspaceId: string;
  functions: FunctionManifestEntry[];
  integrationsUsed: string[];
  totalEstimatedRuntimeCostMonthly: number;
}

interface FunctionManifestEntry {
  name: string;
  triggerType: 'http' | 'schedule' | 'event' | 'manual';
  triggerConfig: TriggerConfig;
  permissions: string[];
  secrets: string[];
  rateLimit: RateLimitConfig;
  timeout: number;
  memoryLimit: number;
  artifactId: string;
  version: number;
}
```

### 6.3 The Generation Prompts

In `packages/core/src/ai/prompts/code-generation/`:

- `inventory-extraction.prompt.ts` — extract function inventory from UI + PRD
- `http-function.prompt.ts` — generate HTTP-triggered functions
- `scheduled-function.prompt.ts` — generate cron-triggered functions
- `event-function.prompt.ts` — generate event-triggered functions
- `integration-function.prompt.ts` — generate functions using integrations
- `function-manifest.prompt.ts` — generate manifest entries
- `permission-derivation.prompt.ts` — analyze code to derive required permissions
- `regeneration.prompt.ts` — regenerate with feedback
- `static-fix.prompt.ts` — regenerate to fix static analysis violations
- `orchestrator.prompt.ts` — top-level

### 6.4 The Static Analyzer

```typescript
// packages/core/src/services/ai/code-generation/static-analyzer.ts

export class StaticAnalyzer {
  analyze(source: string): StaticAnalysisReport;
}

interface StaticAnalysisReport {
  passed: boolean;
  violations: StaticViolation[];
  warnings: string[];
}

interface StaticViolation {
  type: 'forbidden_import' | 'forbidden_call' | 'missing_permission_declaration' | 'unsafe_pattern' | 'sandbox_escape_attempt';
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning';
}
```

Implementation: AST-based analysis using TypeScript compiler API. Walks the AST; checks for forbidden patterns; catches sandbox escapes.

The forbidden patterns list is curated; updated as new escape vectors are identified. The list is part of the platform's security posture; reviewed in Objective 10's security gate.

### 6.5 The Integration Catalog

```typescript
// packages/core/src/services/ai/code-generation/integration-catalog.ts

export class IntegrationCatalog {
  list(): IntegrationDescriptor[];
  get(integrationId: string): IntegrationDescriptor | null;
  validateUsage(integrationId: string, code: string): ValidationResult;
}

interface IntegrationDescriptor {
  id: string;
  name: string;
  description: string;
  module: string; // import path
  configSchema: JsonSchema; // what config / secrets it needs
  examples: CodeExample[];
  documentation: string;
  category: 'payment' | 'communication' | 'identity' | 'storage' | 'analytics' | 'other';
}
```

The catalog ships with the integrations listed in Section 5.5. Adding new integrations is a platform-team action; each new integration goes through security review.

### 6.6 The Sandbox Runtime

```typescript
// packages/runtime/sandbox/src/

export interface SandboxRunner {
  execute(input: SandboxInput): Promise<SandboxResult>;
}

interface SandboxInput {
  bundlePath: string; // path to the function bundle
  entryPoint: string; // function name to invoke
  arguments: unknown;
  context: FunctionContext;
  limits: ResourceLimits;
}

interface ResourceLimits {
  timeoutMs: number;
  memoryMb: number;
  networkAllowlist: string[]; // permitted outbound hostnames
  filesystemReadOnlyPaths?: string[];
  filesystemWritablePaths?: string[]; // tmpfs only
}

interface SandboxResult {
  status: 'completed' | 'timeout' | 'memory_exceeded' | 'crashed' | 'rejected';
  output?: unknown;
  error?: SerializedError;
  metrics: SandboxMetrics;
}
```

The actual implementation depends on Objective 10's security review. Options:

- **gVisor**: strong isolation; userspace kernel. Higher cold-start cost; strongest security.
- **Firecracker**: VM-level isolation; designed for serverless. Strong security; moderate cold-start cost.
- **Node `vm` module + hardening**: lower isolation; lower cold-start cost. Insufficient on its own; would need additional layers.
- **Deno's permission model**: solid built-in isolation; cold-start cost manageable.

The platform picks based on the security review's recommendations. The runtime port abstracts over the choice; switching is possible if the chosen approach has issues.

### 6.7 The Code Review UI

Lives in `apps/web/src/ai-pipeline/code-generation/`:

- `CodeGenerationPage.tsx` — main page; layout shell
- `panels/InventoryPanel.tsx` — list of functions to generate
- `panels/FunctionTreePanel.tsx` — generated functions grouped by trigger type
- `panels/FunctionViewPanel.tsx` — single function detail
- `panels/CodeViewerPanel.tsx` — source code
- `panels/ManifestViewerPanel.tsx` — manifest entry
- `panels/StaticAnalysisPanel.tsx` — violations and warnings
- `panels/TestStubPreviewPanel.tsx` — preview of what Stage 8 will generate
- `dialogs/RegenerateFunctionDialog.tsx`
- `dialogs/RollbackFunctionDialog.tsx`
- `dialogs/ApproveProjectDialog.tsx`

The user navigates the function inventory; reviews each function's code, manifest, and analysis; approves per function.

### 6.8 Audit Events

```
ai.code_generation.inventory_generated
ai.code_generation.function_generated
ai.code_generation.function_regenerated
ai.code_generation.static_analysis_violation
ai.code_generation.typecheck_failure
ai.code_generation.function_approved
ai.code_generation.function_rejected
ai.code_generation.function_rolled_back
ai.code_generation.project_approved
ai.code_generation.exported
```

### 6.9 Permissions

```
ai.code_generation.create
ai.code_generation.read
ai.code_generation.regenerate
ai.code_generation.approve
ai.code_generation.rollback
ai.code_generation.export
```

Default role mappings:

- `workspace_owner`, `workspace_admin`: all
- `architect`: all
- `developer`: create, read, regenerate, export
- `business_analyst`: read
- `qa`, `reviewer`, `viewer`: read
- Custom roles configurable

For production environments, `approve` typically restricted to architect/owner.

### 6.10 Quality Signal Specifics

```typescript
interface ServerCodeQualitySignals {
  functionArtifactId: string;

  // Generation quality
  initialStaticAnalysisPass: boolean;
  finalStaticAnalysisPass: boolean;
  initialTypeCheckPass: boolean;
  finalTypeCheckPass: boolean;

  // Permission accuracy
  declaredPermissionsAccurate: boolean;
  derivedPermissionsAdded: number;

  // Editing
  acceptedFirstPass: boolean;
  totalRegenerations: number;
  charsEditedAfterApproval: number;

  // Runtime (post-deployment)
  invocationsTotal: number;
  invocationsFailed: number;
  invocationsTimedOut: number;
  rolledBack: boolean;
}
```

### 6.11 Operational Runbooks

- `code-generation-static-analysis-failures.md` — when many functions fail static analysis
- `code-generation-sandbox-escape-detected.md` — security incident response
- `code-generation-runtime-failures.md` — diagnosing function failures post-deployment
- `code-generation-rollback.md` — rolling back a deployed function
- `code-generation-integration-credentials.md` — managing third-party API keys
- `code-generation-rate-limit-tuning.md` — adjusting per-function limits

---

## 7. Implementation Order

1. **Function inventory schema** locked.

2. **ServerFunction artifact schema.**

3. **Function manifest schema.**

4. **Inventory extraction prompt** with test suite.

5. **Per-function generation prompts** (http, scheduled, event, integration) with test suites.

6. **Manifest generation prompt.**

7. **Permission derivation prompt** (analyze code, derive permissions).

8. **CodeGenerationService skeleton.**

9. **Static analyzer** with the forbidden patterns list.

10. **TypeScript validation.**

11. **Integration catalog** with initial integrations.

12. **Per-function generation end-to-end.**

13. **Validation pipeline** (static + types + permission accuracy).

14. **Sandbox runtime** — coordinate with Objective 10's security review for chosen isolation.

15. **Code review UI** with all panels.

16. **Function inventory review and editing.**

17. **Per-function approval flow.**

18. **Stage pipeline integration** (function-level approval, project approval).

19. **Versioning and rollback.**

20. **Project export.**

21. **Quality signal recording.**

22. **Audit events emitted.**

23. **End-to-end test**: PRD + UI → inventory → functions → all pass validation → approval → ready for deployment.

24. **Documentation, ADRs, runbooks.**

25. **Verify Definition of Done.**

---

## 8. ADRs to Write

- **ADR-0198: Node.js + TypeScript as Server Runtime** — alternatives considered; alignment with stack
- **ADR-0199: Per-Function Generation, Function Inventory First** — discipline against sprawl
- **ADR-0200: Sandboxed Runtime with Hard Limits** — security posture; isolation library determined by security review
- **ADR-0201: Curated Integration Catalog** — pre-built, audited, secure adapters; not arbitrary npm
- **ADR-0202: Static Analysis as Second Line of Defense** — beyond TypeScript; forbidden patterns
- **ADR-0203: Permissions Declared and Verified** — declared in manifest; enforced at invocation; verified via static analysis
- **ADR-0204: Versioning with Rollback** — every version preserved; rollback is a single action
- **ADR-0205: Generated Code IP & License Posture** — what license generated repos ship under; per-workspace configurability; AI-assisted-authorship declaration in NOTICE; third-party content provenance from prompts/templates
- **ADR-0206: Generated App Observability Defaults** — structured JSON logs, `/health`, `/metrics`, OTel spans enabled by default; disable-by-config; rationale for "monitorable when platform offline"

---

## 9. Verification Steps

1. **Generate inventory** from a CRM PRD + UI: produces a list of 5-15 functions covering deal scoring, notifications, integrations.

2. **Per-function generation**: each function has source, manifest, reasoning.

3. **TypeScript compiles** for all generated functions.

4. **Static analysis passes**: no forbidden patterns; no escape attempts.

5. **Permission declaration accurate**: declared permissions match actual SDK calls.

6. **HTTP function**: generated; correct trigger config; SDK integration works.

7. **Scheduled function**: cron expression valid; runs at correct intervals.

8. **Event function**: triggered by platform event correctly.

9. **Integration adapter usage**: function imports from `@platform/integrations/<name>`; credentials via secrets.

10. **Sandbox enforcement**: a generated function attempting `eval` fails static analysis; if somehow deployed, fails at runtime with sandbox violation.

11. **Resource limits enforced**: function exceeding 30s wall-clock killed; memory beyond 256MB killed.

12. **Network allowlist**: function attempting outbound to non-allowlisted host fails.

13. **Function inventory edit**: user adds/removes/merges functions before generation.

14. **Per-function regeneration**: regenerate one function with feedback; only that function changes.

15. **Versioning**: new version created on regeneration; old preserved.

16. **Rollback**: roll back a deployed function to previous version; deployment updates.

17. **Code review UI**: navigate functions; view code/manifest/analysis; approve.

18. **Approval routing**: per workspace config (architect approval for production environments).

19. **Project export**: produces a ready-to-deploy bundle.

20. **Cost tracking**: per-function generation cost recorded.

21. **Cross-database**: server code works equivalently with Postgres/MSSQL/Mongo schemas (via SDK abstraction).

22. **Audit events**: all lifecycle actions emit expected entries.

23. **Quality signals**: static analysis pass rate, type check pass rate, permission accuracy recorded.

24. **Provider failover**: generation mid-flight fails over to backup provider; result attributed correctly.

25. **Sandbox isolation verified**: integration tests confirm a function cannot access another workspace's data, cannot escape the sandbox, cannot exhaust shared resources.

26. **Integration error handling**: function calling Stripe with bad credentials produces a clean error, not a crash.

If all 26 pass, the objective is met.

---

## 10. Definition of Done

**Schema & Types**

- [ ] FunctionInventory artifact type
- [ ] ServerFunction artifact type
- [ ] ServerCodeProject artifact type
- [ ] All sub-structures locked

**Prompts**

- [ ] Inventory extraction prompt
- [ ] HTTP function prompt
- [ ] Scheduled function prompt
- [ ] Event function prompt
- [ ] Integration function prompt
- [ ] Manifest generation prompt
- [ ] Permission derivation prompt
- [ ] Regeneration prompts
- [ ] Static-fix prompt
- [ ] Orchestrator
- [ ] Test suites per prompt

**Service Layer**

- [ ] CodeGenerationService implemented
- [ ] All inventory, generation, validation methods
- [ ] Approval flow
- [ ] Versioning and rollback

**Validation**

- [ ] StaticAnalyzer with forbidden patterns
- [ ] TypeScript validation
- [ ] Permission accuracy validation
- [ ] Manifest validation

**Integration Catalog**

- [ ] Initial integrations: Stripe, SendGrid/Postmark, Twilio, OAuth providers, webhook delivery, S3-compatible
- [ ] Each integration documented and tested
- [ ] Integration credentials via SecretStorePort

**Sandbox Runtime**

- [ ] Isolation library chosen (per Objective 10's security review)
- [ ] Resource limits enforced (timeout, memory, network)
- [ ] Secret injection via context
- [ ] Network allowlist per function

**UI**

- [ ] Code generation page
- [ ] Inventory panel with edit
- [ ] Function tree
- [ ] Function detail with code/manifest/analysis
- [ ] Regenerate, rollback, approve dialogs

**Quality & Observability**

- [ ] Quality signals recorded
- [ ] Per-prompt dashboards
- [ ] Stage-specific metrics
- [ ] Sandbox violation alerts

**Permissions**

- [ ] Stage permissions added
- [ ] Default role grants

**Cross-Database**

- [ ] Functions work with all three database drivers via SDK

**Documentation**

- [ ] ADRs 0198–0204 written and Accepted
- [ ] All runbooks in Section 6.11 written
- [ ] Customer-facing code generation guide
- [ ] Integration usage examples

**Dev-Grade Output (D-series, per [docs/roadmap/v2-future-scope.md](../docs/roadmap/v2-future-scope.md))**

- [ ] **D1 — Standalone runnable.** Generated server code project clones from git and runs locally with `npm install && npm run dev` (or equivalent) without Lighthouse Studio running. Verified by an automated test that bootstraps a generated project in a clean environment and exercises a representative function.
- [ ] **D4 — Secrets management.** Generated functions read secrets from environment variables / standard secret stores; no platform-coupled secret resolution baked into emitted code. Local `.env.example` shipped with every generated project; secret names match the platform's SecretStorePort contract so platform-deployed and standalone-deployed runs are configuration-compatible.
- [ ] **D5 — Local dev experience.** Generated project ships with hot-reload dev script, seed/fixture loader, and a `.devcontainer.json` so VS Code (or any container-aware IDE) opens with a consistent environment. Verified by the same standalone-bootstrap test plus a devcontainer lint.
- [ ] **D7 — LICENSE & NOTICE emission.** Generated server code project ships with a `LICENSE` file (configurable per workspace; default MIT, alternatives Apache-2.0 or a proprietary template) and a `NOTICE` file declaring AI-assisted authorship and any third-party content provenance from prompts/templates. Verified by automated test asserting both files exist with the configured content in every generated project. ADR documents the IP position.
- [ ] **D8 — Generated app observability primitives.** Generated server code emits structured JSON logs (level configurable via env var), exposes `/health` (liveness + readiness) and `/metrics` (Prometheus-format) endpoints by default, and emits OpenTelemetry-compatible spans on request paths. Disable-by-config available; enabled-by-default. Verified by a standalone-bootstrap test that exercises all three surfaces with the platform offline — the dev's ops team must be able to monitor the deployed app without depending on Lighthouse Studio.

**Verification**

- [ ] All 26 verification steps in Section 9 pass

---

## 11. Anti-Patterns to Refuse

- **Generating sprawl: 50 functions when 5 suffice.** Inventory step + user review prevents this.
- **Allowing arbitrary npm imports.** Curated allowlist; new libraries via platform-team action.
- **Trusting permissions declared by AI without verification.** Static analysis verifies declarations match implementation.
- **Skipping the sandbox.** All functions sandboxed; defense in depth.
- **Hardcoded secrets in generated code.** Always via context injection.
- **Functions calling each other via direct imports.** Always via SDK; never via cross-function imports.
- **Letting functions exceed time limits without surfacing.** Timeouts are killings, audited, observable.
- **Allowing `eval`, dynamic code, or other escape vectors.** Static analysis catches; sandbox is the second line.
- **Custom integration adapters generated by AI on the fly.** Curated catalog only; new integrations are platform-team work.
- **Skipping approval routing for "minor" functions.** Server code approval is non-negotiable.
- **Letting UI generation in Stage 6 reference functions that don't exist yet.** Inventory step coordinates.
- **Stateful functions or functions sharing memory.** Stateless, independently testable.

---

## 12. Open Questions for Confirmation Before Starting

1. **Node.js vs. Deno vs. Bun for runtime** — proposing Node.js for ecosystem maturity. Deno's permission model is appealing for security; Bun is fast but young. Recommendation: Node.js with hardened sandboxing; revisit if security review prefers Deno.

2. **Sandbox isolation specifics** — proposing the choice happens during Objective 10's security review. Acceptable, or pre-decide here?

3. **Integration catalog initial contents** — proposing 7+ integrations (Stripe, SendGrid, Twilio, OAuth, webhook, S3). Sufficient for v1, or include more (Slack, Discord, HubSpot)?

4. **Long-running services explicitly excluded** — confirmed? Some workflows want always-on services. Recommendation: out of scope; if needed, customer writes outside the platform.

5. **Edge function cold start budget** — proposing 2 seconds cold; 500ms warm. Acceptable, or stricter?

6. **Memory limit default** — proposing 256MB. Some workflows need more; configurable up to 1GB. Acceptable?

7. **Function naming convention** — proposing snake_case for function names; camelCase in JS code. Consistent or confusing?

---

## 13. What Comes Next

With Objective 27 complete, the customer's app has both UI (Stage 6) and server-side logic (Stage 7). The platform's infrastructure runs everything: data plane, auth, storage, custom functions. The customer hasn't written a line of code; the platform generated it; they reviewed and approved.

**Objective 28: Stage 8 — Test Generation** is next. From the PRD's acceptance criteria + the UI components + the server functions, generate the test suite. Unit tests for functions, integration tests for SDK usage, end-to-end tests for user workflows. The tests verify the AI's work; without them, the customer ships untested AI-generated code (a non-starter for serious adoption).

The remaining stages chain forward:

- **29: Deployment** — through environments from Objective 2
- **30: Maintenance & Evolution** — feedback loops, regeneration, change management

---

_This document is the contract. Every checkbox in Section 10 must be true before moving on to Objective 28._
