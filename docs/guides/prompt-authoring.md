# Prompt Authoring Guide

This guide explains how to author AI prompts using the platform's `definePrompt` API. Read Objective 20 (AI Pipeline Foundation) before making changes in this area.

---

## The `definePrompt` API

Every prompt in the pipeline is defined using `definePrompt`, which lives in `packages/core/src/ai/prompts/`. The function signature is:

```typescript
import { definePrompt } from '@platform/core/ai';
import { z } from 'zod';

export const myPrompt = definePrompt({
  // Required fields
  name: 'stage.substage.operation',          // Dot-separated identifier
  version: '1.0.0',                          // Semantic version
  systemPrompt: `You are a...`,              // The system-level instruction
  userPromptTemplate: `Given: {{input}}`,    // Template with {{variable}} placeholders
  inputSchema: z.object({                    // Zod schema for template variables
    input: z.string(),
  }),
  outputSchema: z.object({                   // Zod schema for structured output
    result: z.string(),
    reasoning: z.string(),                   // reasoning is ALWAYS required (see below)
  }),
  reasoning: {                               // Reasoning configuration
    capture: true,                           // Must be true
    field: 'reasoning',                      // Field in outputSchema that holds reasoning
  },

  // Optional fields
  estimatedInputTokens: 500,                 // Expected input token count
  estimatedOutputTokens: 200,                // Expected output token count
  tags: ['intent-capture', 'brief'],         // For filtering in observability
});
```

---

## The `reasoning` Field is Mandatory

Every prompt must capture AI reasoning as part of its structured output. This is not optional — it is a platform-wide contract (Objective 20).

**Why it matters:**
- Reasoning is stored alongside every AI artifact, making the pipeline auditable.
- When a user reviews an AI-generated brief or PRD, they can see why the AI made a particular decision.
- Reasoning enables quality review and prompt improvement over time.
- Missing reasoning is a bug, not a style choice.

**How to implement it:**

1. Add a `reasoning` field to your `outputSchema`:

   ```typescript
   outputSchema: z.object({
     briefSections: z.array(BriefSectionSchema),
     reasoning: z.string().describe('Explain the decisions made in generating these sections'),
   }),
   ```

2. Reference the field in the `reasoning` config:

   ```typescript
   reasoning: {
     capture: true,
     field: 'reasoning',
   },
   ```

3. Instruct the model to populate it in the system prompt:

   ```
   Always populate the "reasoning" field with a concise explanation of:
   - The key decisions you made
   - Assumptions you applied
   - Any ambiguities you encountered and how you resolved them
   ```

If you find an existing prompt that does not have a `reasoning` field, that is a bug. Fix it or open a tracked issue.

---

## Version Bumping Rules

Prompts follow semantic versioning. The version in `definePrompt` must be incremented when a prompt changes.

| Change type                                         | Version bump |
|-----------------------------------------------------|--------------|
| Typo fix, rephrasing that does not change behavior  | Patch (1.0.0 → 1.0.1) |
| Adding/removing/renaming a field in `outputSchema`  | Minor (1.0.0 → 1.1.0) |
| Changing the schema in a breaking way               | Minor (with migration) |
| Major behavioral overhaul (new approach, new model) | Major (1.0.0 → 2.0.0) |

Version history is preserved in the database (`ai_usage_records.prompt_version`), so old records can always be correlated to the prompt version that generated them.

---

## Writing Effective System Prompts

A good system prompt has four parts:

### 1. Role

Define who the AI is in this context:

```
You are an expert business analyst specialising in software product requirements.
```

Be specific. "You are a helpful assistant" is too vague and leads to generic outputs.

### 2. Context

Explain the situation and what the AI has access to:

```
You are operating as part of a structured AI build pipeline. You have been given
a raw project description from a customer and a set of clarifying answers they
provided in a conversation.
```

### 3. Constraints

Define what the AI must and must not do:

```
You MUST:
- Output only valid JSON matching the provided schema
- Populate the "reasoning" field with your decision rationale
- Flag any ambiguities as "assumptions" in the relevant section

You MUST NOT:
- Invent technical requirements not supported by the provided information
- Include pricing, timeline estimates, or implementation details
```

Constraints are enforced in the system prompt because they apply universally, not per-call.

### 4. Output Format

Describe the expected output structure, even if you are using structured output (the model benefits from the description in both the schema and the prose):

```
Output a JSON object with the following structure:
- "sections": array of brief section objects
- "assumptions": list of assumptions you applied
- "reasoning": explanation of your decisions
```

---

## Template Variables

The `userPromptTemplate` uses `{{variable}}` syntax for interpolation. Variables must be declared in `inputSchema`:

```typescript
userPromptTemplate: `
Project description: {{projectDescription}}

Conversation turns: {{conversationJson}}

Generate a structured brief.
`,
inputSchema: z.object({
  projectDescription: z.string().max(5000),
  conversationJson: z.string(),  // serialized JSON of turn array
}),
```

Keep templates focused. If you find yourself passing more than 5 variables, the prompt may be doing too much — consider splitting it.

For multi-turn contexts (conversations), serialise the turn array to JSON and pass as a single string. Do not attempt to reconstruct the conversation structure inside the template.

---

## Output Schema Design

Keep output schemas focused and flat where possible. Deeply nested schemas are harder to validate and harder for the model to populate correctly.

**Good:**

```typescript
outputSchema: z.object({
  title: z.string(),
  summary: z.string().max(500),
  sections: z.array(z.object({
    heading: z.string(),
    content: z.string(),
  })),
  reasoning: z.string(),
}),
```

**Avoid:**

```typescript
// Too nested; hard for model to populate correctly
outputSchema: z.object({
  document: z.object({
    metadata: z.object({
      title: z.object({ text: z.string(), formatted: z.string() }),
    }),
  }),
}),
```

Use `.describe()` on fields to give the model context:

```typescript
z.string().describe('A concise project title, max 10 words')
```

This description is included in the JSON schema sent to the model as a tool definition.

---

## Testing Prompts

Every prompt requires a test suite with golden input/output pairs. Tests live in `packages/core/src/ai/prompts/<stage>/<prompt>.test.ts`.

```typescript
import { describe, it, expect } from 'vitest';
import { runPromptTest } from '@platform/core/ai/testing';
import { myPrompt } from './my-prompt';

describe('myPrompt', () => {
  it('generates a brief from a project description', async () => {
    const result = await runPromptTest(myPrompt, {
      input: {
        projectDescription: 'A task management app for remote teams',
        conversationJson: JSON.stringify([]),
      },
      // Mock the provider response
      mockResponse: {
        sections: [{ heading: 'Overview', content: '...' }],
        reasoning: 'The project description is clear enough to generate...',
      },
    });

    expect(result.isOk()).toBe(true);
    expect(result.value.sections).toHaveLength(1);
    expect(result.value.reasoning).toBeTruthy();
  });
});
```

**Important:** Use `runPromptTest` with mocked responses in unit tests. Never call real AI providers in unit tests — it is slow, costly, and flaky. Reserve live provider tests for the integration test suite, run deliberately.

---

## Cost Estimation

Every prompt should include estimated token counts:

```typescript
estimatedInputTokens: 1200,   // system prompt + template + average input
estimatedOutputTokens: 400,   // typical output for this prompt
```

To estimate:
1. Count the tokens in the system prompt (use a tokenizer: `npx tiktoken count "<text>"`).
2. Add the average input data size in tokens.
3. For output, run the prompt against 5 representative inputs and average the output lengths.

These estimates are used by the workspace token budgeting system (ADR-0246) to check budget before invoking a prompt. An overestimate is safe; a large underestimate can lead to budget surprises.

---

## Common Anti-Patterns

**Over-complex prompts.** A single prompt that tries to generate a full PRD in one call is fragile and expensive. Use the orchestrator + sub-prompts pattern (ADR-0248): one sub-prompt per logical section.

**Under-specified output schemas.** If the output schema is too loose (`z.record(z.unknown())`), the model will hallucinate field names and the validator will not catch it. Define every field.

**Missing reasoning capture.** As above — this is a bug. Every prompt must capture reasoning.

**Hardcoding examples that should be templates.** If you write examples into the system prompt (few-shot examples are effective), make sure they are clearly marked as examples and do not reflect real customer data.

**Testing with real providers.** Unit tests must use mocked responses. Running against real providers in the unit test suite adds cost and latency and makes CI flaky.

**Not bumping the version.** If you change a prompt's behavior and do not bump the version, historical usage records become uncorrelated. Always bump.
