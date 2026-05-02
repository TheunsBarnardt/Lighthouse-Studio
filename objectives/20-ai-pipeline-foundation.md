# Objective 20: AI Pipeline Foundation

**Status:** Ready for development
**Prerequisites:** All foundation objectives (1–10) complete; Objective 11 (Schema Designer) for Stage 4 integration
**Blocks:** Every AI pipeline stage objective (21–30)

---

## 1. Purpose

Establish the shared infrastructure that every AI Build Pipeline stage will use. Just as Objective 1.5 defined the abstractions before any feature code, this objective defines the abstractions before any AI stage code. The risk this prevents is each stage independently inventing how to call AI providers, structure prompts, store artifacts, capture reasoning, route approvals — a fractured codebase where one bug exists ten different ways.

This objective produces the **AI substrate**: provider abstraction, prompt management system, artifact model, reasoning capture, approval routing integration, observability. By the end, building Stage 1 (Intent Capture) is a matter of writing the stage-specific logic on top of complete shared infrastructure — the same way building a feature service in the data plane was made trivial by the canonical service pattern.

The other thing this objective locks in: the platform's **AI usage policy**. Which providers are supported, how secrets are managed, how PII flows (or doesn't) into prompts, how customer data is handled by AI providers, what the platform claims about training data and what it doesn't. These are policy decisions that affect every stage; deciding them once, here, is the right discipline.

---

## 2. Scope

### In Scope

- **AI provider abstraction**: a port that supports Anthropic, OpenAI, Azure OpenAI, AWS Bedrock, and self-hosted (Ollama, vLLM) backends behind one interface
- **Prompt management system**: prompts as versioned, reviewable, testable artifacts (not strings inline in code)
- **Artifact model**: every AI-generated thing (PRD, design token set, schema, component, etc.) is an Artifact with a stable identity, version history, reasoning, and lifecycle
- **Reasoning capture**: every AI generation includes structured reasoning attached as metadata; teaches users over time
- **Approval routing integration**: artifacts move through stages via the approval routing engine from Objective 6
- **Stage state machine**: the pipeline as a defined state machine; clear transitions; no fake-it-until-you-make-it states
- **Token budgeting**: per-workspace AI token budgets; soft and hard limits; cost tracking
- **Streaming responses**: AI responses can stream; the platform supports this end-to-end
- **Tool use**: AI calls tools (read schema, search docs, fetch examples); tools are typed and audited
- **Sandbox for AI execution**: any code AI generates that runs server-side runs sandboxed
- **Conversation history**: per-stage, per-artifact conversation context preserved
- **Quality evaluation**: every artifact has metadata about quality signals (was it accepted, edited heavily, rejected)
- **Caching of AI outputs**: same input + same prompt = same output (within reason); reduce cost
- **PII handling discipline**: customer PII never sent to non-customer-controlled AI providers without explicit consent
- **Provider failover**: if Anthropic is down, fall back to OpenAI (or whichever the customer has configured)
- **Observability**: per-stage metrics, traces, logs; cost tracking; quality tracking
- ADRs

### Out of Scope (Belongs to Later Objectives)

- Specific stage implementations (Stages 1–10 each their own objective)
- AI fine-tuning workflows (deferred; the platform uses general models, not custom-trained ones)
- Vector embedding management beyond what's needed for RAG over the platform's own artifacts (the customer's full vector search needs are out of scope here)
- Multi-modal generation beyond text and structured output (image generation, voice deferred until clear value emerges)
- Custom model hosting infrastructure (we support self-hosted via Ollama/vLLM but don't operate that infrastructure for customers)
- AI safety / content filtering beyond what providers natively provide (the platform inherits the provider's filtering; doesn't add its own layer)
- A "playground" UI for prompt experimentation (deferred; useful but not v1; engineers iterate via the codebase)

---

## 3. Locked Decisions

| Decision                      | Choice                                                                                                                           | Rationale                                                      |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Primary AI provider           | Anthropic Claude (via the official SDK)                                                                                          | Maintainer's choice; quality; alignment with platform's values |
| Secondary providers supported | OpenAI, Azure OpenAI, AWS Bedrock, Ollama, vLLM                                                                                  | Customer flexibility; vendor diversity for resilience          |
| Provider abstraction          | An `AIProviderPort` that hides provider-specific APIs                                                                            | Standard hexagonal pattern                                     |
| Streaming protocol            | Server-Sent Events from the platform's API; the API converts provider-specific streams to a common format                        | Consistent client experience regardless of provider            |
| Token counting                | tiktoken (OpenAI) + provider-specific where needed; abstracted behind a `TokenCounterPort`                                       | Consistent budgeting math                                      |
| Artifact storage              | Same database as the platform; with per-workspace logical isolation                                                              | Consistent with rest of platform                               |
| Reasoning storage             | Inline JSON in the artifact's metadata; queryable via standard tooling                                                           | First-class, not afterthought                                  |
| Prompt management             | Prompts as TypeScript files in `packages/core/src/ai/prompts/`; versioned via git; not stored in DB                              | Reviewable, testable, diffable                                 |
| Prompt evaluation             | A test suite per prompt with golden-output checks and regression detection                                                       | Prompts are code; code has tests                               |
| Tool definition               | Typed tool definitions in TypeScript; auto-converted to provider-specific schemas                                                | One source of truth                                            |
| Tool execution                | Sandboxed; tool calls audited; rate-limited per stage                                                                            | Defensive                                                      |
| AI configuration scope        | Per-workspace + per-stage overrides; installation defaults                                                                       | Flexibility without footguns                                   |
| Cost tracking unit            | "Tokens" plus "USD-equivalent" computed from per-provider pricing                                                                | Customer-relevant                                              |
| Cost limits                   | Per-workspace hard cap; per-user soft warning; per-stage budget allocation                                                       | Defense against runaway usage                                  |
| Caching strategy              | Hash of (provider, model, prompt, parameters); 24-hour TTL; explicitly bypassable                                                | Reduces cost; safe defaults                                    |
| PII redaction in prompts      | Mandatory; via the same registry from Objective 7; redaction happens before sending                                              | Customer trust; compliance                                     |
| Provider key storage          | Via SecretStorePort (per-workspace keys for customer's own provider accounts; platform default keys for installation-scoped use) | Per Objective 5                                                |
| Default model temperatures    | Per-stage configured; temperatures > 0.5 require explicit justification                                                          | Determinism by default                                         |

---

## 4. Architectural Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                      AI BUILD PIPELINE STAGES                          │
│                                                                       │
│  Stage 1   Stage 2   Stage 3   ...   Stage 10                        │
│  (Intent)  (PRD)     (Tokens)        (Maintain)                       │
│                                                                       │
│  Each stage:                                                           │
│  - Consumes artifacts from prior stages                                │
│  - Produces artifacts of its type                                      │
│  - Routes approvals via the approval engine                            │
│  - Uses prompts; emits reasoning; tracks quality                       │
└─────────────────────────────────┬────────────────────────────────────┘
                                  │
                                  ▼
        ┌──────────────────────────────────────────────────┐
        │         AI Pipeline Foundation (this objective)   │
        │                                                    │
        │   Services:                                        │
        │   - ArtifactService (CRUD + lifecycle)             │
        │   - StagePipelineService (state machine)            │
        │   - PromptService (load + render)                   │
        │   - GenerationService (call AI provider)            │
        │   - ToolRegistry (typed AI tools)                   │
        │   - CostTrackingService                             │
        │                                                    │
        │   Ports:                                            │
        │   - AIProviderPort                                  │
        │   - TokenCounterPort                                │
        │   - PromptStorePort (loads from packages/core)      │
        │   - ArtifactRepositoryPort                          │
        │                                                    │
        │   Adapters:                                         │
        │   - aiprovider-anthropic                            │
        │   - aiprovider-openai                               │
        │   - aiprovider-azure-openai                         │
        │   - aiprovider-bedrock                              │
        │   - aiprovider-ollama                               │
        │   - aiprovider-vllm                                 │
        └──────────────────────────────────────────────────┘
                                  │
                                  ▼
        ┌──────────────────────────────────────────────────┐
        │   Foundation services (already complete):          │
        │   - AuthorizationPort (Objective 6)                 │
        │   - AuditPort (Objective 7)                         │
        │   - ApprovalRoutingEngine (Objective 6)             │
        │   - SecretStorePort (Objective 5)                   │
        │   - JobQueuePort (Objective 1.5)                    │
        │   - PersonalDataRegistry (Objective 7)              │
        └──────────────────────────────────────────────────┘
```

The shared foundation here is what makes building Stage 1 a matter of "write the prompt + the stage-specific orchestration"; everything else is in place.

---

## 5. The Hard Parts

**5.1 The artifact model — every AI output is an Artifact**

An Artifact is **the** noun of the AI build pipeline. Every stage produces them; every stage consumes them. Stable identity, version history, reasoning, lifecycle:

```typescript
export interface Artifact {
  id: string; // UUID v7; survives renames and edits
  workspaceId: string;
  stage: StageName; // 'intent', 'prd', 'design_tokens', etc.
  type: string; // stage-specific subtype, e.g., 'intent_brief', 'prd_section', 'token_set'
  parentArtifactIds: string[]; // upstream artifacts this was derived from
  childArtifactIds: string[]; // downstream artifacts derived from this

  status: ArtifactStatus; // draft, awaiting_approval, approved, rejected, archived
  currentVersion: number;

  content: ArtifactContent; // the actual artifact data; shape per type
  reasoning: ReasoningRecord; // why this content; what the AI was thinking
  qualitySignals: QualitySignals; // edits, rejections, time-to-approve

  generatedBy: GenerationRecord; // model, prompt version, tokens used, cost
  approvalId?: string; // FK to approvals table from Objective 6

  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null; // null = system/AI generated
  approvedAt?: Date;
  approvedByUserId?: string;
}

export interface ArtifactContent {
  // Discriminated by type; e.g.:
  // intent_brief: { goals, constraints, success_criteria, target_personas }
  // prd: { sections: { name, content, acceptance_criteria }[] }
  // token_set: { colors, typography, spacing, ... }
}

export interface ReasoningRecord {
  // Structured "why this artifact looks like this":
  rationale: string; // human-readable explanation
  alternatives_considered: string[]; // what was considered and rejected
  assumptions: string[]; // what was assumed
  uncertainties: string[]; // what was uncertain; flagged for review
  source_artifacts: string[]; // which upstream artifacts informed this
}
```

Reasoning isn't an afterthought. Every prompt requires the AI to produce reasoning alongside the content. This serves three purposes:

1. **Auditability**: when a deployment causes a production incident, a reviewer can trace back through the reasoning chain to find where the wrong assumption was made
2. **Teaching**: users see not just the output but the thinking; over time, this builds judgment
3. **Improvement**: reasoning patterns that frequently lead to rejected artifacts inform prompt iteration

**5.2 The prompt management system**

Prompts as code, not strings. They live in `packages/core/src/ai/prompts/` as TypeScript modules:

```typescript
// packages/core/src/ai/prompts/intent-capture/extract-goals.prompt.ts

import { definePrompt } from '@platform/ai-core';

export const extractGoals = definePrompt({
  id: 'intent_capture.extract_goals',
  version: '1.3.0', // semver per prompt
  description: 'Extracts user goals from a freeform conversation',

  inputs: z.object({
    conversation: z.array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      }),
    ),
    domainContext: z.string().optional(),
  }),

  outputs: z.object({
    goals: z.array(
      z.object({
        goal: z.string(),
        priority: z.enum(['must', 'should', 'could']),
        rationale: z.string(),
      }),
    ),
    reasoning: ReasoningSchema,
  }),

  modelConfig: {
    provider: 'anthropic', // can be overridden by workspace config
    model: 'claude-opus-4-7',
    temperature: 0.2,
    maxTokens: 4000,
  },

  systemPrompt: `You are a senior business analyst...`,

  userPromptTemplate: ({ conversation, domainContext }) => `
    Given the following conversation:
    
    ${conversation.map((m) => `${m.role}: ${m.content}`).join('\n')}
    
    ${domainContext ? `Context: ${domainContext}` : ''}
    
    Extract the user's goals...
  `,

  examples: [
    // Few-shot examples for in-context learning
  ],

  tests: [
    {
      input: {
        /* ... */
      },
      assertions: [{ type: 'output_matches_schema' }, { type: 'contains_goal_with_priority', priority: 'must' }],
    },
  ],
});
```

Properties of this approach:

- **Versioned**: every prompt has a semver. Bumping the version is a deliberate act
- **Testable**: each prompt has its own test suite; CI runs them against a small sample on every PR
- **Reviewable**: prompts go through code review like any other code
- **Diffable**: changes to prompts are visible in git
- **Inputs and outputs are schemas**: the platform validates inputs before sending and outputs after receiving; malformed responses retry once then fail with a typed error
- **Few-shot examples co-located**: teaching examples live next to the prompt that uses them

**5.3 The state machine: stage transitions**

Each artifact moves through states:

```
draft → awaiting_approval → approved → archived (eventually)
                  ↓
              rejected → draft (revised)
```

Transitions are governed by the approval routing engine from Objective 6. Solo workflows: the user is both creator and approver; transitions are immediate. Enterprise workflows: BAs approve PRD; architects approve schemas; etc.

The `StagePipelineService` exposes these transitions:

```typescript
export class StagePipelineService {
  async submitForApproval(ctx: RequestContext, artifactId: string): Promise<Result<Artifact, AppError>>;
  async approve(ctx: RequestContext, artifactId: string, comment?: string): Promise<Result<Artifact, AppError>>;
  async reject(ctx: RequestContext, artifactId: string, reason: string): Promise<Result<Artifact, AppError>>;
  async revise(ctx: RequestContext, artifactId: string, changes: ArtifactRevision): Promise<Result<Artifact, AppError>>;
}
```

Each transition is audited. Each generates an artifact event that the realtime layer can deliver to subscribed clients (so a UI showing the pipeline status updates live).

**5.4 Tool use — typed and audited**

AI models call tools to read schemas, search docs, fetch examples, etc. The platform defines tools as typed TypeScript:

```typescript
// packages/core/src/ai/tools/read-schema.tool.ts

export const readSchema = defineTool({
  id: 'read_schema',
  description: "Read the customer's current schema for a workspace",

  parameters: z.object({
    schemaId: z.string(),
  }),

  returns: z.object({
    schema: SchemaSchema,
  }),

  permissions: ['schema.read'],

  async execute(ctx: RequestContext, params): Promise<Result<unknown, AppError>> {
    return await schemaService.getSchema(ctx, params.schemaId);
  },
});
```

When a prompt is sent to a provider that supports tool use (Anthropic, OpenAI), the tools are auto-converted to provider-specific schemas. When the AI calls a tool, the platform:

1. Verifies the AI's caller (the user invoking this stage) has the required permissions
2. Audits the tool call (with parameters)
3. Executes the tool
4. Audits the response
5. Returns to the AI

Tools that have side effects (write tools) are not automatically included; the stage must explicitly opt in. Most stages use only read tools; write tools are limited to specific stages (Stage 4 schema writes via the approval flow, etc.).

**5.5 Cost tracking — token-aware**

AI is expensive at scale. Per workspace:

- Hard limit: monthly token budget (configurable per workspace)
- Soft warning at 80% of budget
- Per-stage budget allocation: stages can consume up to their share; runaway usage in one stage doesn't kill another's budget
- Per-user soft limit: warns the user when their personal usage in a stage exceeds typical patterns

Cost calculations:

- Track input tokens, output tokens, tool-use tokens separately
- Multiply by per-provider pricing (configured in the platform; updated as providers adjust)
- Aggregate per (workspace, stage, user, day, month)
- Surface in dashboards (Grafana panel for AI usage)
- Surface in customer-facing UI (workspace billing-style page)

Cost data is in `ai_usage_records`:

```typescript
ai_usage_records: {
  ...standardColumns,
  workspace_id: uuid,
  user_id: uuid?,
  stage: string,
  artifact_id: uuid?,
  prompt_id: string,
  prompt_version: string,
  provider: string,
  model: string,
  input_tokens: int,
  output_tokens: int,
  tool_use_tokens: int,
  cost_usd: decimal(10,6),
  duration_ms: int,
  cached: boolean,
  status: enum('succeeded', 'failed', 'timeout', 'budget_exceeded'),
}
indexes: [workspace_id, _created_at DESC], [workspace_id, stage, _created_at DESC]
```

**5.6 PII redaction in prompts**

Customer data must not flow naively to AI providers. The platform's policy:

- The personal data registry from Objective 7 lists every PII column
- Before any value from a PII column is included in a prompt, it is **redacted** (replaced with `<email_redacted>`, `<name_redacted>`, etc.)
- The AI works with redacted values; the customer-facing UI shows real values
- For workspaces that explicitly consent (a workspace setting): unredacted values can flow to AI providers, but ONLY to providers the workspace has configured with their own credentials (not the platform's default keys)
- Self-hosted AI providers (Ollama, vLLM) running on the customer's infrastructure are exempt — there's no third party

This is the platform's policy; documented; opt-in for unredacted; never automatic.

**5.7 Caching — same input, same output**

Many AI calls are deterministic given the input. The platform caches results:

- Cache key: hash of `(provider, model, system_prompt, user_prompt, parameters)`
- Cache TTL: 24 hours by default; configurable per prompt (some prompts intentionally non-cacheable)
- Cache backed by a `ai_response_cache` table in the platform's primary DB
- Cache hits don't count against the workspace token budget; they cost only the platform's storage

For prompts where determinism matters (e.g., schema synthesis), `temperature: 0` plus caching means two users in the same workspace generating from the same input get the same artifact. For prompts where creativity matters (e.g., design tokens), temperature is higher and caching may have less effect.

**5.8 Streaming responses**

For interactive stages (Intent Capture's conversational mode, especially), the AI's response should stream rather than wait for full completion. The platform supports this end-to-end:

1. The provider's stream is converted to a platform-internal `AsyncIterable<GenerationEvent>`
2. The platform's API streams these via Server-Sent Events to the client
3. The SDK delivers them via async iteration to the customer's app

Events:

- `text_delta`: a chunk of text was generated
- `tool_call_start`: the AI called a tool
- `tool_call_complete`: the tool returned
- `done`: the generation is complete; final token counts and cost
- `error`: something went wrong

The customer's UI can show typing-indicator-style live updates. The reasoning is captured at the end (after the full response is generated; reasoning is a structured object, not a streamed field).

**5.9 Provider failover**

If Anthropic is down (rare but possible), the platform falls back to a configured secondary provider. The configuration:

- Per-workspace primary provider (default: platform-installed)
- Per-workspace fallback provider (optional)
- Per-prompt override (some prompts work better on specific models; the prompt definition can specify)

Failover policy:

- Try primary
- On 500-class errors or timeouts: retry once
- On still-failing: try fallback (if configured)
- On still-failing: surface the error to the user

The failover is logged; the cost tracking attributes correctly to whichever provider actually generated the artifact.

**5.10 Sandboxing AI-generated code**

When a stage produces executable code (Stage 7 in particular), the code may need to run in a sandbox before being deployed. The platform supports this via:

- A `CodeSandboxPort` (defined here; first implementation in Stage 7's objective)
- Adapters: Docker-based sandbox, Firecracker-based sandbox, or workspace-based isolation
- Resource limits: CPU, memory, network, disk
- Time limits: execution timeout

Security is critical: AI code can include hallucinated package imports, infinite loops, attempts to escape the sandbox. The sandbox is the line of defense.

For now, this objective defines the port; the actual sandbox adapter implementations are deferred to the stages that need them.

**5.11 Quality signals: tracking what works**

Every artifact has quality signals automatically tracked:

- Was it accepted on first submit, or rejected and revised?
- How many revisions before approval?
- How much was edited (diff size between AI output and approved version)?
- Time-to-approval
- Did it cause downstream issues (artifact in stage N+1 was rejected because this artifact was wrong)?

These signals feed into:

- Per-prompt quality dashboards (which prompts produce most rejections?)
- Per-stage quality dashboards
- Per-model quality dashboards (does Anthropic outperform OpenAI on schema synthesis?)
- Continuous prompt improvement: low-quality prompts get reviewed; high-quality patterns get studied

Quality data is in `artifact_quality_records`:

```typescript
artifact_quality_records: {
  ...standardColumns,
  artifact_id: uuid,
  workspace_id: uuid,
  stage: string,
  prompt_id: string,
  prompt_version: string,
  provider: string,
  model: string,
  outcome: enum('accepted_first_pass', 'accepted_after_revisions', 'rejected', 'abandoned'),
  revision_count: int,
  edit_distance: int?,                  // Levenshtein-style on content where applicable
  time_to_approval_seconds: int?,
  rejected_with_feedback: text?,
  caused_downstream_issue: boolean,
}
indexes: [workspace_id, stage, prompt_id, prompt_version], [outcome, _created_at]
```

These records inform the platform team's prompt iteration. They're also surfaced (anonymized, aggregated) in customer-facing dashboards: "Your team's PRD acceptance rate is 73%; the platform average is 68%; common revision themes: ..."

---

## 6. Component Specifications

### 6.1 The AIProviderPort

```typescript
// packages/ports/ai/src/ai-provider.port.ts

export interface AIProviderPort {
  /** Identifier (anthropic, openai, etc.). */
  readonly id: string;

  /** Capabilities (tool use, streaming, image input, etc.). */
  readonly capabilities: AIProviderCapabilities;

  /** List of available models from this provider. */
  listModels(): Promise<Result<ModelInfo[], AppError>>;

  /** Generate a completion. */
  generate(request: GenerationRequest): Promise<Result<GenerationResponse, AppError>>;

  /** Generate a completion with streaming output. */
  generateStream(request: GenerationRequest): AsyncIterable<GenerationEvent>;

  /** Count tokens for a given text + model. */
  countTokens(text: string, model: string): Promise<Result<number, AppError>>;

  /** Check provider health. */
  healthCheck(): Promise<Result<HealthStatus, AppError>>;
}

export interface GenerationRequest {
  model: string;
  systemPrompt?: string;
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  outputSchema?: JsonSchema; // for structured output mode
  metadata: GenerationMetadata; // workspace, user, prompt id, for tracing
}
```

Adapters per provider implement this. The provider-specific differences (API key format, base URL, response shapes) are hidden inside the adapter.

### 6.2 PromptService

```typescript
// packages/core/src/services/ai/prompt.service.ts

export class PromptService {
  /** Load a prompt by id; resolves the version pinned by the workspace's config. */
  async load(ctx: RequestContext, promptId: string): Promise<Result<LoadedPrompt, AppError>>;

  /** Render a prompt with inputs; applies PII redaction. */
  async render(ctx: RequestContext, promptId: string, inputs: unknown): Promise<Result<RenderedPrompt, AppError>>;

  /** Run a prompt's test suite (used in CI). */
  async runTests(promptId: string): Promise<Result<PromptTestResult, AppError>>;
}

export interface LoadedPrompt {
  id: string;
  version: string;
  systemPrompt: string;
  modelConfig: ModelConfig;
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
  tools?: string[]; // tool ids
  examples?: Example[];
}

export interface RenderedPrompt {
  systemPrompt: string;
  userPrompt: string;
  toolDefinitions: ToolDefinition[];
  redactionLog: RedactionRecord[]; // what was redacted; for audit
}
```

### 6.3 GenerationService

```typescript
// packages/core/src/services/ai/generation.service.ts

export class GenerationService {
  constructor(
    private readonly authz: AuthorizationPort,
    private readonly providers: AIProviderPort[],
    private readonly prompts: PromptService,
    private readonly cache: AICachePort,
    private readonly costTracking: CostTrackingService,
    private readonly tools: ToolRegistry,
    private readonly audit: AuditPort,
    private readonly logger: LoggerPort,
  ) {}

  async generate(input: GenerateInput): Promise<Result<GenerationResult, AppError>>;

  generateStream(input: GenerateInput): AsyncIterable<GenerationEvent>;
}

export interface GenerateInput {
  ctx: RequestContext;
  promptId: string;
  inputs: unknown;
  cacheControl?: 'use_cache' | 'bypass_cache' | 'cache_only';
  workspaceProviderOverride?: string;
}
```

The orchestrator. For each call:

1. Authorize (`ai.generate` permission for the stage)
2. Render the prompt with PII redaction
3. Check cache; if hit, return
4. Check token budget; if exceeded, return error
5. Resolve provider (workspace config or override)
6. Send request; handle streaming
7. On tool use: dispatch to the tool registry; audit tool calls; loop until done
8. Validate output against schema
9. Cache the response
10. Record cost
11. Emit audit event
12. Return

### 6.4 ArtifactService

```typescript
// packages/core/src/services/ai/artifact.service.ts

export class ArtifactService {
  async create(ctx: RequestContext, input: CreateArtifactInput): Promise<Result<Artifact, AppError>>;
  async get(ctx: RequestContext, artifactId: string): Promise<Result<Artifact, AppError>>;
  async listByStage(ctx: RequestContext, stage: StageName, opts: ListOptions): Promise<Result<PaginatedResult<Artifact>, AppError>>;
  async listByParent(ctx: RequestContext, parentArtifactId: string): Promise<Result<Artifact[], AppError>>;
  async update(ctx: RequestContext, artifactId: string, changes: ArtifactUpdate): Promise<Result<Artifact, AppError>>;
  async archive(ctx: RequestContext, artifactId: string): Promise<Result<void, AppError>>;

  // Lifecycle (delegated to StagePipelineService for actual approval routing)
  async submitForApproval(ctx: RequestContext, artifactId: string): Promise<Result<Artifact, AppError>>;
  async approve(ctx: RequestContext, artifactId: string, comment?: string): Promise<Result<Artifact, AppError>>;
  async reject(ctx: RequestContext, artifactId: string, reason: string): Promise<Result<Artifact, AppError>>;

  // Quality signals
  async recordQualitySignal(ctx: RequestContext, artifactId: string, signal: QualitySignal): Promise<Result<void, AppError>>;
}
```

### 6.5 CostTrackingService

```typescript
export class CostTrackingService {
  /** Check if a workspace is within budget for a stage. */
  async checkBudget(workspaceId: string, stage: StageName, estimatedTokens: number): Promise<Result<BudgetStatus, AppError>>;

  /** Record actual usage. */
  async recordUsage(record: AiUsageRecord): Promise<Result<void, AppError>>;

  /** Aggregate usage for a workspace. */
  async getWorkspaceUsage(workspaceId: string, opts: UsageQueryOptions): Promise<Result<UsageSummary, AppError>>;

  /** Set or update workspace budget. */
  async setBudget(ctx: RequestContext, workspaceId: string, budget: WorkspaceBudget): Promise<Result<void, AppError>>;
}
```

### 6.6 ToolRegistry

```typescript
export class ToolRegistry {
  /** Register a tool. */
  register(tool: ToolDefinition): void;

  /** Get a tool by id. */
  get(toolId: string): ToolDefinition | null;

  /** Execute a tool call from the AI. */
  async executeCall(ctx: RequestContext, toolId: string, parameters: unknown): Promise<Result<unknown, AppError>>;
}
```

Tools registered at platform startup; the registry is the lookup point during generation.

### 6.7 Database Schema

```typescript
artifacts: {
  ...standardColumns,
  workspace_id: uuid,
  stage: string,
  type: string,
  parent_artifact_ids: json,             // string array
  status: enum,
  current_version: int,
  content: json,                          // shape depends on type
  reasoning: json,
  generated_by: json,                     // model, prompt id, etc.
  approval_id: uuid?,                     // FK to approvals
  approved_at: timestamp?,
  approved_by_user_id: uuid?,
}
indexes: [workspace_id, stage, status, _created_at DESC]

artifact_versions: {
  ...standardColumns,
  artifact_id: uuid,
  version: int,
  content: json,                           // immutable snapshot
  reasoning: json,
  change_summary: text,
  edited_by_user_id: uuid?,
}
unique: [artifact_id, version]

ai_usage_records: {
  ...standardColumns,
  workspace_id: uuid,
  user_id: uuid?,
  stage: string,
  artifact_id: uuid?,
  prompt_id: string,
  prompt_version: string,
  provider: string,
  model: string,
  input_tokens: int,
  output_tokens: int,
  tool_use_tokens: int,
  cost_usd: decimal,
  duration_ms: int,
  cached: boolean,
  status: enum,
}
indexes: [workspace_id, _created_at DESC], [workspace_id, stage, _created_at DESC]

ai_response_cache: {
  ...standardColumns,
  cache_key_hash: char(64),
  prompt_id: string,
  prompt_version: string,
  provider: string,
  model: string,
  inputs_hash: char(64),
  response: json,
  expires_at: timestamp,
}
unique: [cache_key_hash]
indexes: [expires_at]

artifact_quality_records: {
  ...standardColumns,
  artifact_id: uuid,
  workspace_id: uuid,
  stage: string,
  prompt_id: string,
  prompt_version: string,
  outcome: enum,
  revision_count: int,
  edit_distance: int?,
  time_to_approval_seconds: int?,
  rejected_with_feedback: text?,
  caused_downstream_issue: boolean,
}
indexes: [workspace_id, stage, prompt_id], [outcome, _created_at DESC]

ai_workspace_config: {
  ...standardColumns,
  workspace_id: uuid PK,
  primary_provider: string,
  fallback_provider: string?,
  monthly_budget_usd: decimal,
  per_stage_budget_pct: json,
  pii_redaction_enabled: boolean,
  pii_redaction_override_consent: boolean,
  custom_provider_credentials: json,    // encrypted, references SecretStorePort
}
```

### 6.8 Audit Events

```
ai.artifact.created
ai.artifact.updated
ai.artifact.submitted_for_approval
ai.artifact.approved
ai.artifact.rejected
ai.artifact.revised
ai.artifact.archived

ai.generation.started
ai.generation.completed
ai.generation.failed
ai.generation.cached_hit
ai.generation.timeout

ai.tool.called (with tool id and parameters; audited even on cached generations)
ai.tool.failed

ai.budget.warning_80
ai.budget.warning_95
ai.budget.exceeded
ai.budget.updated

ai.prompt.test_failed (CI, prompt regression)
ai.quality.recorded
```

### 6.9 Observability

Per-stage and per-prompt metrics:

- `platform_ai_generations_total{workspace, stage, prompt, status}` — counter
- `platform_ai_generation_duration_seconds{provider, model}` — histogram
- `platform_ai_tokens_consumed_total{workspace, type}` — counter (type: input/output/tool)
- `platform_ai_cost_usd_total{workspace, stage}` — counter
- `platform_ai_cache_hits_total{prompt}` — counter
- `platform_ai_quality_outcome_total{stage, prompt, outcome}` — counter
- `platform_ai_provider_failures_total{provider}` — counter
- `platform_ai_failover_total{from, to}` — counter
- `platform_ai_pii_redactions_total{category}` — counter

Slow generations (> 30s) emit warnings; > 60s emit errors. Cost spikes (a workspace consuming 10x its average per hour) emit warnings.

### 6.10 Operational Runbooks

New files in `docs/runbooks/`:

- `ai-provider-outage.md` — what to do when Anthropic / OpenAI is down; failover procedures
- `ai-budget-exceeded.md` — workspace at 100%; how to extend; how to identify consumption
- `ai-quality-regression.md` — diagnosing when a prompt's quality drops after a change
- `ai-pii-leak-incident.md` — incident response if PII flowed to a provider unintentionally
- `ai-cost-anomaly.md` — spotting and investigating unusual cost spikes
- `ai-cache-invalidation.md` — when and how to bust the cache
- `ai-provider-credential-rotation.md` — rotating per-workspace provider keys

---

## 7. Implementation Order

1. **AIProviderPort interface and conformance tests.**

2. **aiprovider-anthropic adapter** (the primary provider). Verify with simple generation.

3. **aiprovider-openai adapter** (the fallback). Same conformance tests.

4. **Prompt definition system** — `definePrompt`, `definePromptTest`. Loading and rendering.

5. **PII redaction in prompt rendering** — uses the personal data registry from Objective 7.

6. **PromptService** with load, render, test runner.

7. **CostTrackingService** with budget checks and usage recording.

8. **AICachePort + database-backed adapter.**

9. **GenerationService** orchestrating prompt → render → cache → provider → tool calls → output.

10. **ToolRegistry + initial tool definitions** (read-schema, search-docs, list-artifacts, etc.).

11. **Tool sandboxing** — read tools have no sandbox; write tools require explicit configuration.

12. **Streaming generation** end-to-end (server-sent events from API to client).

13. **ArtifactService + storage schema migrations** on all three databases.

14. **StagePipelineService** integrating with approval routing engine.

15. **Quality signal recording** on artifact lifecycle events.

16. **Observability** — metrics, traces, logs, dashboards.

17. **Provider failover logic.**

18. **Workspace AI configuration** UI panel (basic; full UI in stage objectives).

19. **Conformance tests** across providers.

20. **Documentation** — prompt authoring guide, ADRs, runbooks.

21. **Verify Definition of Done.**

---

## 8. ADRs to Write

- **ADR-0151: AIProviderPort Abstraction** — why hide provider differences; how providers diverge; what the port preserves
- **ADR-0152: Prompts as Code, Not Database Strings** — versioning, testing, reviewability
- **ADR-0153: Reasoning as First-Class Artifact Metadata** — auditability, teaching, improvement; non-optional
- **ADR-0154: PII Redaction Mandatory by Default** — privacy-preserving by default; opt-in for unredacted with workspace's own credentials
- **ADR-0155: Caching AI Responses** — same-input determinism; 24-hour TTL; cost reduction
- **ADR-0156: Tool Use Typed and Audited** — typed definitions; permission-gated; audited
- **ADR-0157: Per-Workspace Token Budgets** — cost control; soft warnings; hard limits
- **ADR-0158: Quality Signals as Continuous Improvement** — tracking what works; feeding prompt iteration

---

## 9. Verification Steps

1. **Anthropic adapter** generates a simple completion successfully.

2. **OpenAI adapter** generates a completion successfully against the same conformance tests.

3. **Prompt loading** loads a prompt by id with version resolution.

4. **Prompt rendering with PII redaction** — input including a PII column value gets redacted before sending; redaction log populated.

5. **Cache hit** — same input twice; second call hits cache; cost record reflects cache hit.

6. **Cache bypass** — explicit bypass parameter forces fresh generation.

7. **Cost tracking** — generation records usage; aggregation correct; budget check fires when over limit.

8. **Tool use** — a prompt with `read_schema` tool successfully calls the tool; tool call audited.

9. **Tool permission denied** — a tool requiring `schema.read` is called by a user without permission; tool returns error to AI; AI handles gracefully.

10. **Streaming generation** — text deltas arrive as SSE; final cost reported; reasoning captured at end.

11. **Artifact CRUD** — create, get, list, update, archive all work; conformance on all three databases.

12. **Artifact lifecycle** — submit for approval; approve via routing engine; status transitions correctly.

13. **Approval routing integration** — solo workspace: instant; enterprise: routes to configured approver.

14. **Quality signal recording** — artifact approved on first pass records `accepted_first_pass`; revised twice records `accepted_after_revisions` with revision count.

15. **Provider failover** — primary provider returns 500; platform retries fallback; final result attributed correctly.

16. **Streaming with tool use** — long-running generation involving tool calls streams correctly; user sees progressive output.

17. **Output schema validation** — provider returns malformed output; platform retries once with stricter prompt; second failure returns typed error.

18. **PII opt-out behavior** — workspace configured with redaction off + custom provider credentials; values flow unredacted; audit reflects this.

19. **Prompt test suite** runs in CI; passes on initial prompts.

20. **Audit events** — every generation, tool call, lifecycle event produces the expected entries.

21. **Cost dashboards** — Grafana panel shows per-workspace usage and cost.

22. **Cross-database conformance** — artifacts, usage records, cache work identically on Postgres, MSSQL, Mongo.

23. **Observability flows** — span per generation; metric per provider; logs correlated.

If all 23 pass, the objective is met.

---

## 10. Definition of Done

**Ports & Adapters**

- [ ] AIProviderPort defined with conformance tests
- [ ] aiprovider-anthropic adapter
- [ ] aiprovider-openai adapter
- [ ] aiprovider-azure-openai adapter
- [ ] aiprovider-bedrock adapter
- [ ] aiprovider-ollama adapter
- [ ] aiprovider-vllm adapter

**Services**

- [ ] PromptService (load, render, test)
- [ ] GenerationService (orchestrator)
- [ ] ArtifactService (CRUD + lifecycle)
- [ ] StagePipelineService (state machine + approval routing)
- [ ] CostTrackingService
- [ ] ToolRegistry

**Database Schema**

- [ ] All AI-specific tables migrated on all three databases
- [ ] PII redaction integrated with personal data registry

**Prompt System**

- [ ] `definePrompt` API
- [ ] Prompt versioning
- [ ] Prompt test framework
- [ ] CI runs prompt tests

**Tool System**

- [ ] `defineTool` API
- [ ] Initial tool definitions (read-schema, search-docs, etc.)
- [ ] Tool execution with permission checks and audit

**Streaming**

- [ ] Provider stream → platform stream conversion
- [ ] Server-Sent Events from platform API
- [ ] SDK integration (forward-compatible with Objective 19's SDK)

**Caching**

- [ ] AICachePort + database adapter
- [ ] Cache hit / bypass behavior

**Cost & Budget**

- [ ] Per-workspace budgets
- [ ] Per-stage allocations
- [ ] Soft + hard limits with warnings
- [ ] Usage aggregation

**Quality Tracking**

- [ ] Quality signal recording on lifecycle events
- [ ] Edit distance computation
- [ ] Outcome categorization

**Provider Resilience**

- [ ] Failover logic
- [ ] Retry logic
- [ ] Health checks

**Audit & Observability**

- [ ] All audit events emitted
- [ ] All metrics emitted
- [ ] Grafana dashboards for AI usage

**Documentation**

- [ ] ADRs 0151–0158 written and Accepted
- [ ] All runbooks in Section 6.10 written
- [ ] Prompt authoring guide
- [ ] Tool authoring guide

**Verification**

- [ ] All 23 verification steps in Section 9 pass

---

## 11. Anti-Patterns to Refuse

- **Inline prompt strings in service code.** Prompts live in `packages/core/src/ai/prompts/`. Service code references them by id.
- **PII flowing to AI providers without explicit consent.** Mandatory redaction; opt-out requires workspace consent + customer-controlled credentials.
- **Tool calls without audit.** Every tool call audited. Even cached generations don't suppress the tool call audit.
- **Skipping output schema validation.** Malformed outputs cause downstream bugs; validate then retry.
- **Cost tracking after the fact.** Real-time during the generation; budget check before sending; failover if budget exceeded.
- **Raw `fetch` calls to provider APIs in service code.** Always through the AIProviderPort.
- **Silent fallback to a different provider without recording it.** Failover logged + metric incremented + cost attributed correctly.
- **Skipping the reasoning structure.** Every generation includes reasoning. Customers see it; the platform tracks it.
- **Caching prompts with non-deterministic outputs.** Some prompts (creative work) shouldn't cache. Per-prompt cache control.
- **Treating quality signals as nice-to-have.** They feed continuous improvement. Track from day one.
- **Allowing AI to call write-tools without explicit stage opt-in.** Default tools are read-only.
- **Building a "playground" UI before having strong abstractions.** The abstractions ship first; playgrounds are for later iteration.

---

## 12. Open Questions for Confirmation Before Starting

1. **Primary provider Anthropic** — confirmed? Many platforms default to OpenAI; Anthropic is the maintainer's choice. Supabase doesn't take a stand here, but the platform should.

2. **PII redaction mandatory by default** — confirmed? Some teams find it limiting (the AI works less well with fully-redacted data). The opt-out is workspace-level + customer-controlled credentials.

3. **Per-workspace token budget default** — proposing $50/month USD-equivalent default. Adjustable per workspace. Acceptable starting point?

4. **Cache TTL default 24 hours** — appropriate? Some prompts may benefit from longer (template-style) or shorter (rapidly-changing context). Per-prompt override available.

5. **Quality signal collection scope** — confirmed all signals from Section 5.11 are tracked? Some teams find granular tracking creepy. Recommendation: yes; aggregated/anonymized in dashboards; never customer-identifying outside their own workspace.

6. **Tools that can write data** — proposing default-off for write tools; explicit per-stage opt-in. Acceptable?

7. **Prompt versioning strategy** — proposing semver per prompt; major bump for incompatible changes. Confirmed?

---

## 13. What Comes Next

With Objective 20 complete, the AI Build Pipeline has its substrate. Each stage can focus on its domain: capturing intent, generating PRDs, synthesizing schemas, etc. The shared concerns — providers, prompts, artifacts, reasoning, approvals, costs, quality, audit — are taken care of.

**Objective 21: Stage 1 — Intent Capture** is next. The first user-visible AI feature. Conversational; produces structured intent briefs; routes to a BA approval (or workspace owner in solo mode); becomes the input for Stage 2 (PRD).

The remaining stages (22–30) follow the same pattern: each uses this foundation; each consumes upstream artifacts; each produces artifacts for downstream; each is approval-routed.

After all stages ship, the platform is the full vision: data management module + AI build pipeline. Two products on one foundation, sold to two markets — Microsoft houses needing modern data tooling, and displaced enterprise professionals building their own ventures.

---

_This document is the contract. Every checkbox in Section 10 must be true before any AI pipeline stage begins._
