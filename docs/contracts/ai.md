# Contract: AI Generation Port

## Purpose

Provides a uniform interface over large language model providers for text
generation, tool use, and streaming output. The platform's AI Build Pipeline
(Objectives 20–30) routes all model calls through this port so that provider
details, token accounting, and capability differences are isolated from the
pipeline orchestration layer.

Defined in `@platform/ports-ai`.

---

## Methods

### AiGenerationPort

#### generate(request: AiRequest): Promise<Result<AiResponse, AiError>>

Submits a message array to the model and awaits a complete response.

```typescript
interface AiRequest {
  messages: AiMessage[];
  model?: string; // Provider-specific model ID; passed through unchanged
  maxTokens?: number; // Hard token cap on the response
  temperature?: number; // 0.0 (deterministic) – 1.0 (creative); adapter default if omitted
  system?: string; // System prompt; prepended before messages
  tools?: AiTool[]; // Available tools for tool_use responses
}

interface AiMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface AiTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>; // JSON Schema object
}

interface AiResponse {
  content: string;
  reasoning?: string; // Chain-of-thought or extended thinking; see below
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  model: string; // Actual model used (may differ from request.model)
  stopReason: 'end_turn' | 'max_tokens' | 'tool_use';
}
```

**Pre-conditions:**

- `messages` must contain at least one element.
- `messages` must alternate roles correctly if the adapter enforces it (some
  providers reject consecutive same-role messages).
- `model`, if provided, must be a valid identifier for the configured provider.
  The port does not validate or normalize model names.
- `maxTokens`, if provided, must be > 0.
- `tools`, if provided, must have unique `name` values within the array.

**Post-conditions:**

- On `ok(response)`:
  - `content` holds the model's text output. May be empty if `stopReason` is
    `tool_use`.
  - `reasoning` holds the model's chain-of-thought or extended thinking output
    when the provider makes it available. This field is **mandatory to capture**
    when non-empty; do not discard it. See the reasoning capture rule below.
  - `usage.inputTokens` and `usage.outputTokens` are accurate and suitable for
    cost accounting. These must be persisted per-request (Objective 20).
  - `model` reflects the model that actually responded. Log this for audit.
- On `err(AiError)`: the request failed. No tokens were consumed (or the
  consumed amount is unknown).

---

#### stream(request: AiRequest): AsyncIterable<AiStreamChunk>

Streams the response incrementally as tokens are generated.

```typescript
interface AiStreamChunk {
  delta: string; // Incremental text since the last chunk
  done: boolean; // True on the final chunk; subsequent iteration ends
}
```

**Pre-conditions:** Same as `generate`.

**Post-conditions:**

- Yields chunks in order. Concatenating all `delta` values produces the complete
  response text.
- The final chunk has `done: true` and may have an empty `delta`.
- Token usage and reasoning are not available from the stream interface. If you
  need them, use `generate` instead.
- Errors during streaming are thrown as exceptions from the async iterator.
  Callers must wrap `for await` loops in try/catch.

---

#### supports(feature: AiFeature): boolean

Queries whether the adapter implements an optional capability.

```typescript
type AiFeature =
  | 'streaming' // stream() yields meaningful incremental chunks
  | 'tool_use' // AiRequest.tools is respected; stopReason can be 'tool_use'
  | 'vision' // Message content can include image data (not yet in the type)
  | 'reasoning'; // AiResponse.reasoning is populated
```

**Pre-conditions:** None.

**Post-conditions:** Returns `true` only when the adapter reliably implements the
feature for the configured model. Callers that require a feature should call
`supports()` at startup and fail fast rather than discovering the absence at
runtime.

---

## Error Codes

```typescript
type AiErrorCode =
  | 'RATE_LIMITED' // Provider rate limit; retry with back-off
  | 'CONTEXT_EXCEEDED' // Input exceeds model context window
  | 'INVALID_REQUEST' // Malformed request (bad model ID, tool schema, etc.)
  | 'PROVIDER_ERROR' // Provider returned a 5xx or equivalent
  | 'UNKNOWN';
```

---

## Capability Flags

| Adapter                 | streaming | tool_use | vision | reasoning |
| ----------------------- | --------- | -------- | ------ | --------- |
| ai-claude-cli           | Partial\* | Yes      | No     | Yes       |
| Anthropic API (planned) | Yes       | Yes      | Yes    | Yes       |
| Azure OpenAI (planned)  | Yes       | Yes      | Yes    | No        |
| EchoAiAdapter (test)    | Yes       | No       | No     | No        |

\* The `ai-claude-cli` adapter shells out to the `claude` CLI binary and captures
stdout. Streaming support depends on CLI output mode; validate with
`supports('streaming')` before using the stream interface against this adapter.

---

## Reasoning Capture — Mandatory Rule

Every AI response that includes a `reasoning` field must have that value
persisted. This is a first-class platform requirement (Objective 20), not an
optional enhancement.

When writing code that calls `generate`:

1. Check `response.reasoning`; if non-empty, include it in the stored artifact.
2. Do not strip, truncate, or discard reasoning to save storage.
3. The reasoning is part of the artifact's provenance. Audit and replay depend
   on it.

If you find AI generation code that silently drops `reasoning`, treat it as a
bug and open an issue.

---

## Token Usage — Mandatory Rule

`response.usage.inputTokens` and `response.usage.outputTokens` must be
recorded for every successful `generate` call. The cost accounting system
(Objective 20) aggregates these per workspace per billing period. Dropping usage
data means the workspace's budget tracking is incorrect.

Pattern:

```typescript
const result = await ai.generate(request);
if (result.isOk()) {
  await costTracker.record(ctx.workspaceId, {
    inputTokens: result.value.usage.inputTokens,
    outputTokens: result.value.usage.outputTokens,
    model: result.value.model,
    stage: 'prd-generation',
  });
}
```

---

## Performance Expectations

- `generate` latency is entirely provider-dependent. Budget 5–60 seconds for
  typical pipeline stages. Do not set HTTP timeouts below 120 seconds.
- `stream` should begin yielding within 2–5 seconds for most providers. Use
  streaming for user-facing generation to provide visible progress.
- The `ai-claude-cli` adapter has higher process-spawn overhead (~200–500 ms)
  compared to a direct API call. This is acceptable for pipeline stages; it is
  not acceptable for latency-sensitive paths.
- The EchoAiAdapter resolves synchronously with negligible overhead. Use it in
  tests where real generation is not needed.

---

## Known Adapter Divergences

### ai-claude-cli

- Shells out to the `claude` binary. The binary must be installed and on `PATH`.
  Absence of the binary causes `INVALID_REQUEST` at call time, not at
  registration time.
- Model names are passed as `--model` flags. Invalid model names may cause the
  CLI to error rather than returning a structured `AiError`; the adapter maps
  non-zero exit codes to `PROVIDER_ERROR`.
- `reasoning` is parsed from the CLI's JSON output when available. The parsing
  is fragile with respect to CLI version changes; pin the CLI version in
  production.

### EchoAiAdapter

- Returns `"Echo: {last user message content}"` as `content`.
- `reasoning` is always `undefined`.
- `usage` always returns `{ inputTokens: 0, outputTokens: 0 }`.
- Never returns an error unless configured with `simulateError: AiErrorCode`.
- `supports()` returns `true` for `streaming` and `false` for everything else.
- Use this adapter in unit tests that exercise pipeline orchestration logic
  without incurring real API costs. Do not use it to test prompt quality.

### Future: Anthropic API direct

- Will support all four features including `vision`.
- Token usage will come from the API response headers/body directly — more
  reliable than CLI parsing.

### Future: Azure OpenAI

- `reasoning` is not available on GPT-series models; `supports('reasoning')`
  will return `false`.
- Model names follow Azure deployment names, not OpenAI model IDs. The adapter
  does not translate; callers must use the Azure deployment name in `model`.

---

## Usage Examples

```typescript
// Basic generation
const result = await ai.generate({
  messages: [{ role: 'user', content: 'Summarize this PRD in three bullet points.' }],
  system: 'You are a concise technical writer.',
  model: 'claude-opus-4-5',
  maxTokens: 512,
});

if (result.isErr()) {
  return err(mapAiError(result.error));
}

const { content, reasoning, usage, model } = result.value;

// Mandatory: record usage
await costTracker.record(ctx.workspaceId, { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, model });

// Mandatory: preserve reasoning
const artifact = { content, reasoning: reasoning ?? null, generatedAt: new Date() };

// Streaming to a client
if (ai.supports('streaming')) {
  for await (const chunk of ai.stream(request)) {
    sendToClient(chunk.delta);
    if (chunk.done) break;
  }
}

// Tool use
const toolResult = await ai.generate({
  messages: [{ role: 'user', content: 'What is the schema of the users table?' }],
  tools: [
    {
      name: 'get_table_schema',
      description: 'Returns the column definitions for a database table.',
      inputSchema: { type: 'object', properties: { tableName: { type: 'string' } }, required: ['tableName'] },
    },
  ],
});
if (toolResult.isOk() && toolResult.value.stopReason === 'tool_use') {
  // Dispatch the tool call and continue the conversation
}
```

---

## Common Misuse

**Discarding `reasoning`.** The platform spec is explicit: reasoning is
first-class. Dropping it is a bug, not a space-saving measure.

**Not recording token usage.** Every `generate` call must feed into cost
tracking. Missing this causes workspace budget drift and makes the cost dashboard
inaccurate.

**Hardcoding model names.** Model identifiers are provider-specific and change
over time. Read the configured model from the workspace or pipeline settings;
do not hardcode `"claude-opus-4-5"` throughout the codebase.

**Using EchoAiAdapter to test prompt quality.** The Echo adapter ignores the
prompt entirely. Tests that assert on response content quality must use a real
provider (in an integration test) or a seeded stub that returns pre-recorded
responses.

**Not checking `supports()` before using streaming.** The `ai-claude-cli`
adapter's streaming support is conditional. Always guard streaming code paths
with `ai.supports('streaming')`.

**Catching exceptions instead of reading the Result.** `generate` returns a
`Result` for all expected error paths. Only wrap in try/catch for truly
unexpected exceptions (e.g., serialization bugs). Do not write
`try { await ai.generate(...) } catch { ... }` as the primary error-handling
pattern.

**Setting aggressive timeouts.** LLM generation can take 30–60 seconds for
long prompts. HTTP or `Promise.race` timeouts below 120 seconds will produce
spurious failures in production.
