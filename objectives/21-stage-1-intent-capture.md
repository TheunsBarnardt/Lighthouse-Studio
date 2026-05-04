# Objective 21: Stage 1 — Intent Capture

**Status:** Ready for development
**Prerequisites:** Objective 20 (AI Pipeline Foundation) complete
**Blocks:** Objective 22 (Stage 2: PRD); the AI pipeline's narrative arc starts here

---

## 1. Purpose

The first stage of the AI Build Pipeline. The user starts a conversation describing what they want to build; the platform produces a structured **Intent Brief** capturing goals, constraints, target users, success criteria, scope boundaries. The Intent Brief becomes the input to Stage 2 (PRD generation).

This is the user's first encounter with the platform's AI capability. Whether it feels magical or frustrating shapes their perception of everything downstream. Done well, the user spends 15 minutes in conversation and ends with a structured artifact they can confidently approve. Done poorly, the user spends 15 minutes fighting the AI and ends with garbage they have to manually rewrite.

The purpose isn't just to generate text. It's to **help the user clarify their own thinking**. A good intent capture conversation surfaces gaps the user hadn't noticed ("Who are the actual users? What does success look like? What's NOT in scope?"). The AI's job is partly extraction, partly socratic — pushing back gently when the user's intent is vague.

This objective produces the **first end-to-end user-facing AI feature**. By the end, a user can sign in, click "New project", have a conversation, see a structured intent brief generated, edit it, submit for approval, and have it become an artifact that future stages consume.

---

## 2. Scope

### In Scope

- **Conversation interface**: a chat UI specifically tuned for intent capture
- **Intent Brief artifact type**: structured schema for what an intent brief contains
- **Capture prompt set**: the prompts that drive the conversation toward complete intent
- **Gap detection**: AI flags when key information is missing
- **Brief generation**: from a complete-enough conversation, produce the structured artifact
- **Brief editing**: post-generation, the user can edit the structured fields directly
- **Approval routing**: the brief moves through approval per the workspace's configuration
- **Conversation persistence**: the conversation is preserved alongside the artifact (audit trail; debugging)
- **Brief templates**: starter conversation prompts ("I want to build a CRM", "I want to migrate this legacy system")
- **Multi-session capture**: the user can pause and resume a conversation across days
- **Reasoning visible**: the user sees why the AI extracted what it extracted; can correct misreadings
- **Examples and case studies**: a small library of high-quality intent briefs for inspiration
- ADRs

### Out of Scope (Belongs to Later Objectives)

- Voice input (deferred; text-first)
- Multi-language interfaces beyond English (the platform's i18n scaffolding from Objective 16 covers this when translations exist)
- Image / sketch input as part of intent capture (deferred; some users will want to sketch wireframes; future enhancement)
- Linking external documents (PDFs, design files) into the conversation context (deferred)
- Auto-progression to Stage 2 (PRD) — the user explicitly transitions; no auto-flow
- The PRD generation itself (Objective 22)
- Cross-team intent collaboration (multiple participants in one conversation) — deferred; v1 is one-author-at-a-time
- AI-suggested similar past projects ("we built something similar last quarter") — deferred until the platform has enough data

---

## 3. Locked Decisions

| Decision                | Choice                                                                                                                    | Rationale                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Conversation modality   | Text-based chat; streaming responses                                                                                      | Familiar; works on every device        |
| Conversation length     | Bounded — typically 5–20 turns; the AI signals when ready to generate                                                     | Forces convergence; avoids meandering  |
| Brief generation timing | User-initiated ("Generate Intent Brief" button) when AI signals readiness; manually triggerable earlier                   | User stays in control                  |
| Brief structure         | Locked schema: goals, target_users, success_criteria, constraints, in_scope, out_of_scope, assumptions, risks, references | Each field has rationale below         |
| Brief editing UX        | Dual-mode: structured form (each field a card) + raw markdown view                                                        | Different users prefer different paths |
| Approval routing        | Per the workspace's `intent_brief` stage in the approval routes config (Objective 6)                                      | Reuse                                  |
| Conversation storage    | In artifacts as conversation history; available in the brief's parentage                                                  | Forensic and reproducible              |
| Streaming               | Yes; uses Objective 20's streaming pipeline                                                                               | Feels alive                            |
| Capture prompt count    | 4–6 prompts at most: extract_goals, identify_users, clarify_scope, surface_assumptions, detect_gaps, finalize             | Focused; testable                      |
| Gap detection threshold | AI must flag at least one of: missing target users, missing success criteria, vague scope                                 | Forces the basics                      |
| First-time user UX      | Brief tutorial overlay on first conversation; dismissible                                                                 | Guidance without being annoying        |
| Templates               | 5–10 starter conversations covering common project types                                                                  | Reduces blank-page paralysis           |
| Resume support          | Conversations are auto-saved every turn; URL-resumable                                                                    | Mobile and life-friendly               |
| Cost estimate per brief | Target $0.10–$0.50 USD; budgeted accordingly                                                                              | Cost-aware                             |

---

## 4. Architectural Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                        USER (browser)                                  │
│                                                                       │
│   Intent Capture Page                                                  │
│   - Chat panel (left, primary)                                         │
│   - Brief preview panel (right, builds as conversation progresses)     │
│   - "Generate Brief" button (enabled when AI signals readiness)        │
│   - Templates picker (start of new conversation)                       │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ Streaming chat + REST CRUD
                               ▼
        ┌────────────────────────────────────────┐
        │      IntentCaptureService                │
        │                                          │
        │   - startConversation(template?)         │
        │   - sendMessage(conversationId, text)    │
        │   - generateBrief(conversationId)        │
        │   - editBrief(briefId, changes)          │
        │   - submitForApproval(briefId)           │
        └─────────────────┬──────────────────────┘
                          │
                          ▼
        ┌────────────────────────────────────────┐
        │  AI Pipeline Foundation (Objective 20)  │
        │                                          │
        │  - GenerationService (streaming)         │
        │  - PromptService (intent capture prompts)│
        │  - ArtifactService (brief, conversation) │
        │  - StagePipelineService (lifecycle)       │
        └────────────────────────────────────────┘
                          │
                          ▼
        ┌────────────────────────────────────────┐
        │   Foundation services                    │
        │   (auth, RBAC, audit, persistence,       │
        │    realtime, etc.)                       │
        └────────────────────────────────────────┘
```

The IntentCaptureService is a thin orchestrator over Objective 20's primitives. It holds the conversational logic specific to intent capture; everything else is shared infrastructure.

---

## 5. The Hard Parts

**5.1 The conversation isn't a free-form chat**

It's tempting to make this "just a chat with an AI." That fails: the AI rambles, the user rambles, you end up with a transcript no one wants to read. The platform structures the conversation:

- **Always working toward something specific**: every AI turn either asks a clarifying question, summarizes progress, or suggests moving forward
- **The right turn count**: enough to extract real intent (not 2-3 turns; that's surface-level), but not too many (15+ turns is fatigue territory)
- **Visible progress**: the brief preview panel updates as fields become clear
- **Explicit transitions**: AI says "I think I have enough; would you like me to generate the brief?" rather than running indefinitely

The conversation is **goal-directed** — the goal is to fill out the Intent Brief schema. The AI uses the schema as a checklist, asking about whichever fields haven't been clarified yet.

**5.2 The Intent Brief schema**

This shape is the contract. Every intent brief produced by the platform has these fields:

```typescript
interface IntentBrief {
  title: string; // 5-10 word summary
  description: string; // 1-2 paragraph summary

  goals: Goal[]; // what success looks like

  targetUsers: TargetUser[]; // who will use this

  successCriteria: SuccessCriterion[]; // how we'll know it worked

  constraints: Constraint[]; // hard limitations

  inScope: ScopeItem[]; // what's included
  outOfScope: ScopeItem[]; // what's deliberately not

  assumptions: Assumption[]; // what we're assuming
  risks: Risk[]; // what could go wrong
  references: Reference[]; // similar products, inspirations

  estimatedScope: 'small' | 'medium' | 'large' | 'xlarge'; // rough sizing
  estimatedTimelineWeeks: number | null; // user-provided or AI-suggested
}

interface Goal {
  goal: string;
  priority: 'must' | 'should' | 'could';
  rationale: string;
}

interface TargetUser {
  persona: string; // "Solo developer", "Enterprise BA", etc.
  needs: string;
  painPoints: string;
}

interface SuccessCriterion {
  criterion: string;
  measurable: boolean; // can we measure it?
  metric?: string; // if measurable, what's the metric?
}

interface Constraint {
  constraint: string;
  type: 'technical' | 'regulatory' | 'business' | 'team' | 'time' | 'budget';
  hard: boolean; // hard limit or preference?
}

interface Assumption {
  assumption: string;
  riskIfWrong: 'low' | 'medium' | 'high';
}

interface Risk {
  risk: string;
  likelihood: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  mitigation: string;
}
```

This shape forces real thinking. The user can't write "I want to build a CRM" and walk away — the schema demands target users (not just "businesses"), success criteria (measurable where possible), constraints, scope boundaries.

The shape is **not** infinitely extensible. Adding fields to the brief means adding them to every downstream prompt that consumes it. The platform's discipline is to keep the brief tight; if a customer needs something specialized, they add it as `metadata` (a freeform JSON field, intentionally NOT a first-class field).

**5.3 The capture prompts**

A small, focused set of prompts drives the conversation:

- **`extract_goals`**: from the conversation so far, what goals are stated or implied?
- **`identify_users`**: who is this for? What are their needs and pain points?
- **`clarify_scope`**: what's in, what's out, what's deliberately deferred?
- **`surface_assumptions`**: what is the user assuming that should be explicit?
- **`detect_gaps`**: what fields of the brief are still unclear or missing?
- **`finalize_brief`**: produce the final structured brief from the complete conversation

Each prompt takes the conversation history (or a relevant slice) plus any partial brief state and returns either:

- More conversation (a clarifying question to ask the user)
- An update to the brief state (some fields are now confidently filled)
- A signal that the brief is ready to generate

The orchestrator (IntentCaptureService) decides which prompt to invoke each turn based on the conversation state and the brief completeness.

**5.4 Streaming chat with reasoning**

The chat UI shows:

- The user's message
- The AI's response (streamed, character-by-character or token-by-token)
- A subtle "reasoning" expandable section beneath each AI turn — "why did the AI ask this?"
- The brief preview panel updating in real-time as fields are determined

The reasoning is generated alongside the visible response (Objective 20 makes this structural). Most users skim it; some users find it helpful to understand what the AI is thinking. Critical for debugging when the AI misunderstands.

The streaming is end-to-end: provider's stream → platform's SSE → SDK delivery → React component rendering.

**5.5 Editing after generation**

After the AI generates a structured brief, the user inevitably wants to edit. Two views:

- **Structured view**: each field is a card; the user edits inline. Forms with validation. Most users prefer this.
- **Raw markdown view**: the brief is rendered as markdown; user edits the source. Some power users prefer this.

Both views read/write the same underlying artifact. Switching between them is instant.

Edits create new artifact versions (per Objective 20's versioning). The conversation history is preserved with each version; the user can see "this brief was generated from this conversation, then edited like this, then approved."

**5.6 Approval routing in the solo vs. enterprise pattern**

Per Objective 6's configurable approval routing:

- **Solo workflow** (workspace approval routes set the `intent_brief` stage to `workspace_owner`): the user submits and approves themselves; one click, both actions
- **Small team** (set to "any user with `business_analyst` role"): the user submits; any BA can approve
- **Enterprise** (set to "all users with `business_analyst` role"): all configured BAs must approve before the brief moves to Stage 2

The same engine handles all three; the configuration determines behavior. This is the platform's master thesis made concrete: the same flow works at every scale, configured per workspace.

**5.7 The brief preview panel**

A live-updating sidebar that builds as the conversation progresses. Each section of the brief schema is a card:

- **Empty** (light gray) — not yet discussed
- **Tentative** (yellow border) — AI has a draft based on conversation; subject to refinement
- **Confident** (green border) — AI has high confidence the field is captured

The user sees progress visually. They know what's still unclear; they can prompt themselves to discuss the empty sections.

For each tentative/confident card, hovering shows the conversation excerpts that informed it. Click to jump to that point in the conversation.

**5.8 Templates as starter conversations**

Templates are pre-canned starter prompts that seed the conversation:

```yaml
template: 'Build a CRM'
starter_message: "I want to build a customer relationship management tool for [my business / a specific client / something else]. The main pain point I'm trying to solve is..."
suggested_focus_areas:
  - 'What kind of customers / contacts are we tracking?'
  - 'What workflows do users do most often?'
  - 'How does this integrate with existing tools?'
```

Templates aren't constraints — they're starting points. The user can deviate freely. They reduce the "blank page" friction for users who don't know how to start.

The platform ships with 5-10 templates covering common project types (CRM, blog, task tracker, e-commerce, internal tool, customer portal, etc.). Workspaces can define their own templates.

**5.9 First-time user experience**

A user landing on the intent capture page for the first time sees a brief tutorial overlay:

- "What is intent capture?"
- "How does this fit into the build pipeline?"
- "Tips for productive conversations"

Dismissible. Skipped automatically on subsequent visits. Re-accessible from a help menu.

For users coming from the AI pipeline overview (the marketing/onboarding page), no overlay — they've already been introduced.

**5.10 Cost-awareness**

Each conversation costs roughly $0.10–$0.50 in AI tokens. Across a thousand active users, that's real money. The platform:

- Shows the user a subtle cost indicator (an icon with hover tooltip; not in their face)
- Caps conversations at 25 turns (longer triggers a "are you sure?" — usually means the AI is going in circles or the user should generate the brief and edit)
- Caches AI responses where possible (stable conversation state + same prompt = cache hit)
- Per-workspace token budget enforced via Objective 20's CostTrackingService

Workspaces can adjust caps per their preferences. The defaults aim at "comfortable for typical use, surfaces unusual usage."

**5.11 Multi-session capture**

A user starts a conversation, gets interrupted, comes back tomorrow. The platform:

- Auto-saves the conversation after every turn
- The conversation has a stable URL the user can bookmark
- "My intent capture conversations" lists in-progress conversations
- A conversation expires after 30 days of inactivity (cleanup); the user gets a notification at 25 days

Resumed conversations re-load the brief preview state. The AI's context window includes the prior conversation; if the conversation is very long, summarization compresses earlier turns to stay within token budget.

**5.12 Quality signals specific to this stage**

Beyond the generic quality signals from Objective 20:

- **Time-to-completion**: how long from "start conversation" to "approved brief"?
- **Turn count**: more turns = more context but possibly fatigue; tracking this informs prompt iteration
- **Edit volume after generation**: how much did the user edit the AI's output?
- **Field completeness scores**: did all fields end up populated, or were some left vague?
- **Downstream rejection rate**: did Stage 2's PRD generation succeed? If PRDs from this brief get rejected often, the brief was likely insufficient

These feed back into prompt iteration. A prompt regression is detected when, e.g., briefs from this prompt version cause more PRD rejections than the prior version's briefs.

---

## 6. Component Specifications

### 6.1 IntentCaptureService

```typescript
// packages/core/src/services/ai/intent-capture/intent-capture.service.ts

export class IntentCaptureService {
  constructor(
    private readonly authz: AuthorizationPort,
    private readonly artifacts: ArtifactService,
    private readonly generation: GenerationService,
    private readonly pipeline: StagePipelineService,
    private readonly audit: AuditPort,
    private readonly logger: LoggerPort,
  ) {}

  /** Start a new conversation (optionally from a template). */
  async startConversation(ctx: RequestContext, input: StartConversationInput): Promise<Result<Conversation, AppError>>;

  /** Send a message; AI responds with streaming. */
  sendMessage(ctx: RequestContext, conversationId: string, message: string): AsyncIterable<ConversationEvent>;

  /** Get the current brief draft state for a conversation. */
  async getBriefDraft(ctx: RequestContext, conversationId: string): Promise<Result<BriefDraft, AppError>>;

  /** Generate the final structured brief from a conversation. */
  async generateBrief(ctx: RequestContext, conversationId: string): Promise<Result<Artifact<IntentBrief>, AppError>>;

  /** Edit an existing brief (creates a new version). */
  async editBrief(ctx: RequestContext, briefId: string, changes: BriefEdit): Promise<Result<Artifact<IntentBrief>, AppError>>;

  /** Submit a brief for approval (lifecycle transition). */
  async submitForApproval(ctx: RequestContext, briefId: string): Promise<Result<Artifact<IntentBrief>, AppError>>;

  /** List the user's conversations. */
  async listConversations(ctx: RequestContext, opts: ListOptions): Promise<Result<PaginatedResult<ConversationSummary>, AppError>>;

  /** Resume a conversation. */
  async getConversation(ctx: RequestContext, conversationId: string): Promise<Result<Conversation, AppError>>;
}
```

Each method follows the canonical service pattern. `sendMessage` is an `AsyncIterable` to support streaming.

### 6.2 The Conversation Model

```typescript
interface Conversation {
  id: string;
  workspaceId: string;
  initiatedByUserId: string;
  templateId?: string;
  status: 'active' | 'completed' | 'abandoned' | 'expired';

  messages: ConversationMessage[];

  briefDraft: BriefDraft; // current draft state
  briefArtifactId?: string; // once generated, references the artifact

  totalTokensUsed: number;
  totalCostUsd: number;

  createdAt: Date;
  lastActiveAt: Date;
  completedAt?: Date;
}

interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  reasoning?: ReasoningRecord;
  briefStateBefore?: BriefDraft; // state of the brief before this turn
  briefStateAfter?: BriefDraft; // state after
  timestamp: Date;
  tokensUsed?: number;
  costUsd?: number;
}

interface BriefDraft {
  fields: Record<keyof IntentBrief, FieldStatus>;
  // Each field has: status (empty/tentative/confident), value (current draft), confidence (0-1)
}
```

Conversations are stored as artifacts with a special type (`type: 'intent_conversation'`). The artifact's `content` is the full Conversation object. Versioning per Objective 20.

### 6.3 The Capture Prompt Set

In `packages/core/src/ai/prompts/intent-capture/`:

- `intent-capture/extract-goals.prompt.ts`
- `intent-capture/identify-users.prompt.ts`
- `intent-capture/clarify-scope.prompt.ts`
- `intent-capture/surface-assumptions.prompt.ts`
- `intent-capture/detect-gaps.prompt.ts`
- `intent-capture/finalize-brief.prompt.ts`
- `intent-capture/orchestrator.prompt.ts` // decides which sub-prompt to invoke

Each follows Objective 20's `definePrompt` API. Each has its own test suite with golden inputs and assertions about what should be extracted.

The orchestrator is the high-level prompt that runs every conversation turn:

- Takes the conversation so far + the current brief draft
- Decides what to do next: ask a clarifying question, suggest moving on, propose finalizing
- Returns the next assistant message + an updated brief draft
- Calls the specific extraction prompts as tools when it needs to update specific fields

This pattern (orchestrator + specialized sub-prompts) keeps each prompt focused and testable while allowing rich behavior.

### 6.4 Tools the AI Has Access To

For Stage 1 specifically, the AI's tools are read-only:

- **`get_brief_draft`**: returns the current state of the brief draft
- **`update_brief_field`**: proposes an update to a specific field (the orchestrator commits or rejects based on confidence)
- **`get_workspace_context`**: information about the workspace (existing schemas, recent projects, etc.) — useful when the user references "like our other CRM"
- **`search_templates`**: search the library of intent brief examples for similar projects
- **`get_conversation_summary`**: when the conversation is long, request a summary of what's been said so far

No write tools. No external API calls. The intent capture stage is a closed loop between user, AI, and platform context.

### 6.5 The Intent Capture UI

Lives in `apps/web/src/ai-pipeline/intent-capture/`:

- `IntentCapturePage.tsx` — main page; layout shell
- `panels/ChatPanel.tsx` — the conversation interface
- `panels/BriefPreviewPanel.tsx` — the live-updating brief preview
- `components/MessageBubble.tsx` — single message render with reasoning expansion
- `components/StreamingMessage.tsx` — handles streaming AI responses
- `components/BriefFieldCard.tsx` — single field card in the preview (empty/tentative/confident states)
- `dialogs/TemplatesDialog.tsx` — template picker for new conversations
- `dialogs/GenerateBriefDialog.tsx` — confirmation when generating from incomplete conversation
- `dialogs/SubmitForApprovalDialog.tsx`
- `dialogs/EditBriefDialog.tsx`
- `views/StructuredBriefView.tsx` — structured editing
- `views/MarkdownBriefView.tsx` — markdown editing

Plus a list view: `IntentCaptureList.tsx` showing the user's conversations and briefs.

### 6.6 Database Schema

New types added to the artifacts table (no new tables needed; artifacts is generic):

```typescript
// Artifacts of type 'intent_conversation' have content matching the Conversation interface
// Artifacts of type 'intent_brief' have content matching the IntentBrief interface
```

The intent_brief artifact's `parentArtifactIds` references the `intent_conversation` artifact it was generated from. Stage 2's PRD artifacts will reference the intent_brief artifact as their parent.

A small auxiliary table for templates:

```typescript
intent_brief_templates: {
  ...standardColumns,
  workspace_id: uuid?,                      // null = installation-wide / built-in
  name: string(255),
  description: text,
  category: string(100),
  starter_message: text,
  suggested_focus_areas: json,              // string array
  built_in: boolean,
  created_by_user_id: uuid?,
}
unique: [workspace_id, name]
```

Built-in templates ship with the platform; workspace-defined templates are workspace-scoped.

### 6.7 Audit Events

```
ai.intent_capture.conversation_started
ai.intent_capture.message_sent (sampled, not on every message)
ai.intent_capture.brief_generated
ai.intent_capture.brief_edited
ai.intent_capture.brief_submitted
ai.intent_capture.brief_approved
ai.intent_capture.brief_rejected
ai.intent_capture.conversation_abandoned
ai.intent_capture.conversation_expired
ai.intent_capture.template_used
```

The artifact lifecycle events from Objective 20 cover most of this; the stage-specific events add convo-related context.

### 6.8 Permissions

```
ai.intent_capture.create   — start a new conversation, generate briefs
ai.intent_capture.approve  — approve briefs (subject to approval routing)
ai.intent_capture.read     — view briefs
ai.intent_capture.delete   — archive own conversations
```

Default role mappings:

- `workspace_owner`, `workspace_admin`: all
- `business_analyst`: create, approve, read
- `architect`, `developer`: create, read
- `qa`, `reviewer`, `viewer`: read
- Custom roles configurable

### 6.9 Quality Signals

Recorded as the conversation and brief progress:

```typescript
interface IntentCaptureQualitySignals {
  conversationId: string;
  briefId?: string;

  turnCount: number;
  durationMinutes: number;

  fieldCompletenessAtGeneration: Record<keyof IntentBrief, 'empty' | 'tentative' | 'confident'>;
  editsAfterGeneration: number; // count of distinct field edits
  totalEditCharCount: number;

  approvedFirstSubmit: boolean;
  rejectionReasons?: string[];

  templateUsed?: string;
}
```

These plus the per-prompt quality signals from Objective 20 power the dashboards.

### 6.10 Operational Runbooks

- `intent-capture-prompt-quality-degraded.md` — when the prompt's outputs degrade after a model update
- `intent-capture-runaway-conversation.md` — when a conversation hits the turn limit; intervention options
- `intent-capture-conversation-stuck.md` — when the AI is going in circles; triggers and recovery
- `intent-capture-brief-validation-fails.md` — when the AI generates structurally-invalid briefs; what to do

---

## 7. Implementation Order

1. **Intent Brief schema** locked down in TypeScript types and zod schemas.

2. **Intent Brief Templates table** migrated; built-in templates seeded.

3. **Capture prompts** (extract_goals, identify_users, etc.) authored as `definePrompt` modules with test suites.

4. **Orchestrator prompt** that ties them together.

5. **IntentCaptureService skeleton** — start, send (non-streaming first), generate, edit, submit.

6. **Conversation persistence** as artifacts with type `intent_conversation`.

7. **Brief generation** producing artifacts with type `intent_brief`; parentage set.

8. **Stage pipeline integration** — submit → approval routing → approve/reject.

9. **Streaming chat** end-to-end (provider stream → SSE → SDK → UI).

10. **Reasoning visible in UI** — beneath each AI message.

11. **Brief preview panel** updating in real-time.

12. **Structured + markdown brief editing.**

13. **Templates picker** with built-in templates.

14. **Multi-session resume** — auto-save, URL-resumable, expiration.

15. **Cost tracking** integrated.

16. **First-time-user tutorial overlay.**

17. **Quality signals recording.**

18. **Conformance tests** across providers (verify equivalent quality on Anthropic, OpenAI).

19. **End-to-end test**: full flow from conversation start to brief approval.

20. **Documentation, ADRs, runbooks.**

21. **Verify Definition of Done.**

---

## 8. ADRs to Write

- **ADR-0159: The Intent Brief Schema as Locked Contract** — what's in, what's out, why; downstream stages depend on this shape
- **ADR-0160: Orchestrator + Sub-Prompts Pattern** — testability; focused prompts; complex behavior emerges from composition
- **ADR-0161: Conversation as an Artifact Type** — versioning, audit, replay; reuses Objective 20 infrastructure
- **ADR-0162: Bounded Conversation Length** — turn caps protect users from circular AI; cost discipline
- **ADR-0163: Templates as Starter Conversations, Not Constraints** — reduce friction without limiting creativity
- **ADR-0164: Brief Preview as Live UI** — visible progress; reduces "did the AI hear me?" anxiety

---

## 9. Verification Steps

1. **Start a conversation** from a template; first AI message arrives via streaming.

2. **Have a 5–10 turn conversation** about a project; the brief preview panel shows progress as fields move from empty → tentative → confident.

3. **Generate the brief** when AI signals readiness; structured artifact created.

4. **Edit the brief** in structured view; changes persist; new version recorded.

5. **Edit the brief** in markdown view; changes persist; new version recorded.

6. **Submit for approval** (solo workflow): user is the approver; one click submits and approves.

7. **Submit for approval** (enterprise workflow): submission waits for configured approvers.

8. **Approve a brief**: status transitions; downstream stages can now consume it.

9. **Reject a brief** with feedback: user can revise and resubmit.

10. **Resume conversation** from a saved URL after closing the browser.

11. **Multi-day conversation**: pick up after 24 hours; context preserved.

12. **AI signals readiness** after enough information gathered; ready signal visible.

13. **Force-generate from incomplete conversation**: warning dialog shown; user proceeds; brief has empty/tentative fields.

14. **Reasoning visible** beneath each AI message; expandable; understandable.

15. **Cost indicator** shows current cost; updates per turn.

16. **Conversation cap** hits at 25 turns; intervention dialog shown.

17. **Templates** load correctly; starter messages seed the conversation.

18. **First-time user tutorial** shows on first conversation; dismissible; not shown subsequently.

19. **Streaming feels alive**: text appears progressively, not in one chunk.

20. **Quality signals** recorded: turn count, time to completion, field completeness, edit volume.

21. **Provider failover** transparent: if Anthropic 500s mid-conversation, OpenAI continues; conversation feels uninterrupted.

22. **Output schema validation**: AI's brief output validated against schema; retries on malformed; surfaces error if persistent.

23. **PII redaction**: a user mentions "my customer alice@acme.com"; AI works with redacted version; UI shows real values to the user but not to the provider.

24. **Cross-database**: works on Postgres, MSSQL, Mongo workspaces equivalently.

25. **Audit events**: every lifecycle action emits expected entries.

26. **Performance**: streaming feels responsive; first token < 2 seconds; sustained throughput typical for the provider.

If all 26 pass, the objective is met.

---

## 10. Definition of Done

**Schema & Types**

- [ ] IntentBrief schema locked in TypeScript types + zod
- [ ] Conversation type
- [ ] BriefDraft type
- [ ] All migrations applied

**Prompts**

- [ ] All capture prompts authored
- [ ] Orchestrator prompt
- [ ] Test suites per prompt
- [ ] CI runs prompt tests

**Service Layer**

- [ ] IntentCaptureService implemented
- [ ] Streaming sendMessage end-to-end
- [ ] Brief generation with schema validation
- [ ] Edit operations
- [ ] Lifecycle (submit, approve, reject) via StagePipelineService
- [ ] Multi-session conversations with auto-save and resume

**UI**

- [ ] IntentCapturePage
- [ ] Chat panel with streaming
- [ ] Brief preview panel with live updates
- [ ] Structured editing view
- [ ] Markdown editing view
- [ ] Templates picker
- [ ] First-time tutorial overlay
- [ ] List of user's conversations and briefs

**Templates**

- [ ] 5–10 built-in templates committed
- [ ] Workspace-defined template support

**Tools**

- [ ] All read-only AI tools implemented (get_brief_draft, update_brief_field, get_workspace_context, search_templates, get_conversation_summary)

**Quality & Observability**

- [ ] Quality signals recorded
- [ ] Per-prompt quality dashboards
- [ ] Stage-specific metrics
- [ ] Audit events emitted

**Permissions**

- [ ] Stage permissions added to vocabulary
- [ ] Default role grants updated

**Cost Awareness**

- [ ] Per-conversation cost tracked
- [ ] Per-conversation cost indicator in UI
- [ ] Conversation cap (25 turns) with intervention

**Cross-Database**

- [ ] Conformance tests pass on all three databases

**Documentation**

- [ ] ADRs 0159–0164 written and Accepted
- [ ] All runbooks in Section 6.10 written
- [ ] Customer-facing intent capture guide
- [ ] Prompt authoring example using the orchestrator pattern

**Verification**

- [ ] All 26 verification steps in Section 9 pass

---

## 11. Anti-Patterns to Refuse

- **Letting the conversation become unbounded chat.** The platform structures it; turn caps protect users.
- **Generating a brief without surfacing reasoning.** Reasoning is non-optional; users see why the AI extracted what it extracted.
- **Skipping the schema validation on AI output.** Malformed briefs cause downstream chaos; validate then retry.
- **Treating templates as constraints.** They're starting points; deviation is encouraged.
- **Auto-progressing to Stage 2.** The user explicitly transitions; respect their pace.
- **Using write tools in this stage.** Stage 1 is read-only; intent capture doesn't touch the schema or codebase.
- **Hardcoding intent capture in the AI Pipeline.** Stage 1 is a stage; the orchestrator pattern + foundation make it pluggable.
- **Allowing the brief schema to balloon.** Stays tight; expansions go to `metadata` field; first-class fields require an objective.
- **Skipping multi-session resume.** Real users get interrupted; the platform respects their time.
- **Silent context window overflow.** When conversations exceed token budget, summarization compresses earlier turns; this is logged and visible to the user (not invisible).
- **Letting prompt regressions through CI.** Tests must pass; quality dashboards catch silent drops.

---

## 12. Open Questions for Confirmation Before Starting

1. **Conversation cap of 25 turns** — appropriate? Some platforms cap lower (10), some higher (50). Recommendation: 25 with override option.

2. **Auto-save cadence** — proposing every turn. Acceptable or excessive (storage)?

3. **Brief schema field count** — proposing 10 fields. Some users will want more (e.g., explicit budget, team capacity). Recommendation: keep tight; add via `metadata` for cases that don't justify a first-class field.

4. **Template library scope** — proposing 5–10 templates. Worth shipping more (20+)? Or fewer high-quality?

5. **Conversation expiration** — proposing 30 days. Acceptable? Storage cost should be minimal.

6. **Confidence visualization** — proposing tentative/confident states. Some users may want explicit confidence percentages. Recommendation: tentative/confident is enough; percentages over-promise precision.

7. **Reasoning expansion default** — proposing collapsed by default; user can expand. Power users may want it always-expanded; UI preference saved per-user.

---

## 13. What Comes Next

With Objective 21 complete, the user has a working **first stage** of the AI pipeline. They can sign in, start a conversation, get a structured intent brief, and approve it. The brief becomes the input to Stage 2.

**Objective 22: Stage 2 — Requirements (PRD)** is next. The intent brief is the input; the output is a structured Product Requirements Document with sections, acceptance criteria, and testable specifications. The same patterns: capture prompts, structured artifact, approval routing, downstream chaining.

The remaining stages (23–30) follow the same template:

- **Stage 3: Design Tokens** — visual language from PRD
- **Stage 4: Schema** — schema synthesis (uses Objective 11's Schema Designer as surface)
- **Stage 5: Data Migration** — handling existing data
- **Stage 6: UI Generation** — components from tokens + schema
- **Stage 7: Code Generation** — server-side logic
- **Stage 8: Test Generation** — test suites
- **Stage 9: Deployment** — through environments
- **Stage 10: Maintenance** — feedback loops

Each stage is its own objective; each follows the canonical service pattern from Objective 8; each builds on Objective 20's AI foundation. By the end, the platform delivers the master plan's full vision: structured AI-assisted development that works for solo developers and Microsoft enterprise houses alike.

---

_This document is the contract. Every checkbox in Section 10 must be true before moving on to Objective 22._
