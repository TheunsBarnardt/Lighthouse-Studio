# Prompt Authoring Guide

This guide covers how to write, version, test, and ship prompts for the AI Build Pipeline using the `definePrompt` API. Read this before writing any prompt. Prompts are code — they go through review, version control, and CI the same way as any other TypeScript.

---

## File location

Every prompt lives in:

```
packages/core/src/ai/prompts/<stage>/<name>.prompt.ts
```

Stage directory names match the `StageName` enum:

| Stage            | Directory           |
| ---------------- | ------------------- |
| Intent Capture   | `intent-capture/`   |
| PRD Generation   | `prd/`              |
| Design Tokens    | `design-tokens/`    |
| Schema Synthesis | `schema/`           |
| Server Functions | `server-functions/` |
| UI Components    | `ui-components/`    |
| Testing          | `testing/`          |
| Deployment       | `deployment/`       |
| Integrations     | `integrations/`     |
| Maintenance      | `maintenance/`      |

Example:

```
packages/core/src/ai/prompts/intent-capture/extract-goals.prompt.ts
packages/core/src/ai/prompts/prd/generate-section.prompt.ts
packages/core/src/ai/prompts/schema/synthesize-from-prd.prompt.ts
```

One prompt per file. Do not put multiple `definePrompt` calls in the same file.

---

## The `definePrompt` API

```typescript
import { definePrompt, ReasoningSchema } from '@platform/ai-core';
import { z } from 'zod';

export const extractGoals = definePrompt({
  // --- Identity ---
  id: 'intent_capture.extract_goals', // dot-namespaced; matches directory path
  version: '1.0.0', // semver; see Versioning below
  description: 'Extracts user goals from a freeform conversation',

  // --- Input/Output Schemas ---
  inputs: z.object({
    conversation: z
      .array(
        z.object({
          role: z.enum(['user', 'assistant']),
          content: z.string().max(10_000), // always bound unbounded strings
        }),
      )
      .min(1)
      .max(50), // always bound arrays
    domainContext: z.string().max(2_000).optional(),
  }),

  outputs: z.object({
    goals: z
      .array(
        z.object({
          goal: z.string(),
          priority: z.enum(['must', 'should', 'could']),
          rationale: z.string(),
        }),
      )
      .min(1),
    reasoning: ReasoningSchema, // required in every output schema; see below
  }),

  // --- Model Configuration ---
  modelConfig: {
    provider: 'anthropic', // default; overridable by workspace config
    model: 'claude-opus-4-7',
    temperature: 0.2, // keep low; temperatures > 0.5 require justification
    maxTokens: 4000,
  },

  // --- Token Budget ---
  tokenBudget: {
    inputBudget: 8000, // expected max input tokens for this prompt
    outputBudget: 4000, // expected max output tokens
    costBudgetUsdPerCall: 0.05, // CI fails if average exceeds this by > 20%
  },

  // --- Prompts ---
  systemPrompt: `You are a senior business analyst specialising in software requirements.
Your job is to extract clear, prioritised goals from a user's description of what they want to build.
Be specific. Do not invent goals the user did not express. When uncertain, mark a goal as 'could'.`,

  userPromptTemplate: ({ conversation, domainContext }) =>
    `
Given the following conversation between a user and the platform:

${conversation.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n')}

${domainContext ? `Additional context: ${domainContext}` : ''}

Extract the user's goals. Return structured output matching the schema.
For each goal include your reasoning for the priority classification.
Include your overall reasoning in the 'reasoning' field.
`.trim(),

  // --- Few-Shot Examples ---
  examples: [
    {
      input: {
        conversation: [{ role: 'user', content: 'I want to build a task tracker for my remote team.' }],
      },
      output: {
        goals: [
          { goal: 'Allow team members to create and assign tasks', priority: 'must', rationale: 'Core function of a task tracker.' },
          { goal: 'Support remote collaboration', priority: 'must', rationale: 'Explicitly stated by user.' },
        ],
        reasoning: {
          rationale: 'User wants task management for a remote team.',
          alternatives_considered: [],
          assumptions: ['Team is < 100 people based on lack of scale mention'],
          uncertainties: ['Whether real-time updates are required'],
          source_artifacts: [],
        },
      },
    },
  ],

  // --- Tests ---
  tests: [
    {
      description: 'extracts at least one must-priority goal from a clear requirement',
      input: {
        conversation: [{ role: 'user', content: 'I need users to be able to log in with their Google account.' }],
      },
      assertions: [{ type: 'output_matches_schema' }, { type: 'contains_field', field: 'reasoning' }, { type: 'contains_goal_with_priority', priority: 'must' }, { type: 'reasoning_not_empty' }],
    },
    {
      description: 'handles empty domain context without error',
      input: {
        conversation: [
          { role: 'user', content: 'Build me a blog.' },
          { role: 'assistant', content: 'What kind of blog?' },
          { role: 'user', content: 'A personal one for writing articles.' },
        ],
      },
      assertions: [{ type: 'output_matches_schema' }, { type: 'goals_count_gte', count: 1 }],
    },
  ],
});
```

---

## Versioning

Every prompt has a semver `version` field. Bump it deliberately — every bump creates a new segment in `artifact_quality_records` and invalidates the cache for the old version.

| Change type                                                  | Version bump | Example           |
| ------------------------------------------------------------ | ------------ | ----------------- |
| Wording tweak that doesn't change output structure           | Patch        | `1.0.0` → `1.0.1` |
| New output field added (backward compatible)                 | Minor        | `1.0.1` → `1.1.0` |
| Input schema changed, output schema changed, meaning changed | Major        | `1.1.0` → `2.0.0` |

**Never reuse a version number.** If you roll back a change, the rolled-back file must bear a version number that has never been used before (typically a new patch or minor). Records in `artifact_quality_records` with the old version number are already in the database; a new deployment of the same version would pollute those records with new quality signals.

---

## The `ReasoningSchema` — Mandatory

Every output schema must include `reasoning: ReasoningSchema`. This is enforced by CI (see `ADR-0160`). If you omit it, the reasoning-capture gate fails and the PR cannot merge.

`ReasoningSchema` is imported from `@platform/ai-core`:

```typescript
import { ReasoningSchema } from '@platform/ai-core';
```

It expands to:

```typescript
z.object({
  rationale: z.string().min(1),
  alternatives_considered: z.array(z.string()),
  assumptions: z.array(z.string()),
  uncertainties: z.array(z.string()),
  source_artifacts: z.array(z.string()), // artifact IDs that influenced this output
});
```

The system prompt must instruct the AI to populate this field. Boilerplate you can adapt:

```
Return your reasoning in the 'reasoning' field. Include:
- rationale: why this output looks the way it does
- alternatives_considered: other approaches you evaluated
- assumptions: things you assumed that the user did not state
- uncertainties: things you were unsure about; flag for human review
- source_artifacts: any artifact IDs from upstream stages that informed this output
```

---

## Naming Conventions

| Property    | Convention                | Example                        |
| ----------- | ------------------------- | ------------------------------ |
| `id`        | `<stage>.<verb>_<noun>`   | `intent_capture.extract_goals` |
| File name   | `<verb>-<noun>.prompt.ts` | `extract-goals.prompt.ts`      |
| Export name | camelCase noun phrase     | `extractGoals`                 |

The `id` must be unique across the entire platform. Use the stage prefix to namespace it.

---

## Input Schema Rules

These rules prevent unbounded inputs from generating runaway costs:

1. **All `z.string()` fields must have `.max()`** — pick a reasonable upper bound for the use case. `10_000` is a generous default for user-facing text; reduce it where appropriate.
2. **All `z.array()` fields must have `.max()`** — prevent callers from passing thousands of items.
3. **PII columns must not be passed as raw values** — use context variables or summaries. The personal data registry from Objective 7 governs which fields are PII. If a prompt genuinely needs PII, the workspace must have `pii_redaction_override_consent = true` and custom provider credentials. Document this explicitly in the prompt's description.

---

## Model Configuration

```typescript
modelConfig: {
  provider: 'anthropic',    // default; workspace config can override
  model: 'claude-opus-4-7',
  temperature: 0.2,         // 0 for deterministic; > 0.5 requires justification in PR
  maxTokens: 4000,
  cacheTtlSeconds: 86400,   // optional; defaults to 24 hours; set null to disable caching
}
```

**Temperature guidance:**

- Extraction tasks (goals, requirements, schema fields): `0.1`–`0.2`
- Synthesis tasks (PRD sections, schema design): `0.2`–`0.3`
- Creative tasks (design tokens, UI component names): `0.4`–`0.5`
- Temperatures above `0.5` require a comment in the PR explaining why determinism is intentionally sacrificed

To disable caching for a prompt where outputs must always be fresh:

```typescript
modelConfig: {
  cacheTtlSeconds: 0,  // or null
}
```

---

## Writing Tests

The `tests` array is executed by `PromptService.runTests` in CI. Each test has:

- `description` — human-readable name for the test case
- `input` — an object matching the prompt's `inputs` schema
- `assertions` — an array of assertion objects

**Available assertion types:**

| Type                          | Description                                                                                          |
| ----------------------------- | ---------------------------------------------------------------------------------------------------- |
| `output_matches_schema`       | Output validates against the `outputs` Zod schema. Always include this.                              |
| `contains_field`              | Output contains a named top-level field.                                                             |
| `reasoning_not_empty`         | `reasoning.rationale` is non-empty. Always include this.                                             |
| `goals_count_gte`             | (Domain-specific) `goals.length >= count`                                                            |
| `contains_goal_with_priority` | At least one goal has the given priority                                                             |
| `no_pii_in_output`            | Output does not contain strings matching PII patterns (for prompts that process PII-adjacent inputs) |
| `cost_within_budget`          | Token count is within the prompt's declared `tokenBudget`                                            |

In CI, tests run against mocked provider responses by default. Run live tests intentionally:

```bash
PROMPT_TEST_LIVE=true pnpm test packages/core/src/ai/prompts/<stage>/<name>.prompt.ts
```

Do not commit code that calls live providers in the default test path. Live tests cost money and make CI non-deterministic.

---

## CI Integration

Every prompt participates in three CI gates:

### 1. Schema validation gate

`PromptService.runTests` validates that each test's output matches the `outputs` Zod schema. A missing field or wrong type fails this gate.

### 2. Reasoning-capture gate (ADR-0160)

CI rejects any prompt file where `outputs` does not include `reasoning: ReasoningSchema`, and any test assertion set that does not include `reasoning_not_empty`. This is a hard gate — not a warning.

### 3. Cost regression gate (ADR-0161)

CI runs golden inputs against the new prompt version and computes average `input_tokens + output_tokens`. If this average exceeds the prompt's declared `tokenBudget.costBudgetUsdPerCall` by more than 20%, or exceeds the previous version's average by more than 20%, CI fails.

To update the budget (e.g., after intentionally expanding the prompt), amend `tokenBudget.costBudgetUsdPerCall` in the prompt file and document the justification in the PR description. For substantial increases, file an ADR amendment to the cost budget ADR.

---

## PII Handling

Never include raw values from PII-tagged columns in prompt inputs. Instead:

**Use context variables:**

Pass a summary or a non-identifying label. For example, instead of passing `email: "alice@example.com"`, pass `userIdentifier: "<email_redacted>"` or omit the field if the AI does not need it.

**Use domain context strings:**

For prompts that need to reference a user, pass a workspace-scoped identifier (UUID) rather than the user's name or email. The AI can reference "user abc123" without needing the real name.

**If PII is genuinely required:**

The prompt's `description` must state: "Requires unredacted PII; workspace must have `pii_redaction_override_consent = true`." The caller must check this consent flag before calling `GenerationService.generate` with raw PII values. Document the fields in the prompt's `inputs` description.

For all other prompts, `PromptService.render` automatically redacts PII columns based on the personal data registry. The `redactionLog` in the returned `RenderedPrompt` confirms what was redacted.

---

## Checklist Before Opening a PR

- [ ] File is at `packages/core/src/ai/prompts/<stage>/<name>.prompt.ts`
- [ ] `id` follows `<stage>.<verb>_<noun>` convention and is unique
- [ ] `version` is correctly bumped (patch/minor/major)
- [ ] `outputs` schema includes `reasoning: ReasoningSchema`
- [ ] System prompt instructs the AI to populate `reasoning`
- [ ] All `z.string()` fields have `.max()`; all `z.array()` fields have `.max()`
- [ ] `temperature` is `<= 0.5` or has a documented justification
- [ ] `tokenBudget` is declared and realistic
- [ ] At least two `tests` entries are present
- [ ] Every test includes `output_matches_schema` and `reasoning_not_empty` assertions
- [ ] `pnpm test packages/core/src/ai/prompts/<stage>/<name>.prompt.ts` passes locally
- [ ] No hardcoded PII values in `examples` or `tests` (use synthetic data)
