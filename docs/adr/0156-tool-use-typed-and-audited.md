# ADR-0156: Tool Use Typed and Audited

**Status:** Accepted
**Date:** 2026-05-06
**Objective:** 20 (AI Pipeline Foundation)

## Context

AI providers support tool use (function calling): the model can invoke platform-defined functions during a generation step. The AI Build Pipeline uses this for structured queries (fetch schema, read artifact, count rows), writes (create artifact, insert schema record), and external lookups (search documentation, validate a URL). Tool use expands what the model can do but introduces risk: a model invoking a write tool with hallucinated parameters can corrupt data.

Decisions are needed on: how tools are defined, how their parameters are validated, how their execution is constrained, and how tool calls are recorded for audit. The existing service layer already requires authorization checks and audit emission (Objective 8); tool calls must participate in the same discipline.

## Decision

Tools are defined using the `defineTool` API:

```typescript
export const fetchSchemaTool = defineTool({
  id: 'fetch-schema',
  description: 'Retrieve the current schema for a workspace datasource',
  parameters: z.object({
    datasourceId: z.string().uuid(),
    includeIndexes: z.boolean().default(false),
  }),
  permissions: ['schema.read'],
  writesToPlatform: false,
  execute: async (params, ctx) => {
    // typed, sandboxed execution
  },
});
```

The `permissions` array declares what platform permissions the tool requires. The tool executor checks these permissions against `ctx` before invoking `execute`. Write tools (those with `writesToPlatform: true`) are disabled by default and must be explicitly enabled per pipeline stage in the stage configuration.

Tool parameter schemas (Zod) are auto-converted to provider-specific function schemas at adapter call time: OpenAI's JSON Schema format for OpenAI/Azure/vLLM, Anthropic's `input_schema` for Anthropic, Bedrock's per-model format. Core code deals only with the Zod schema.

Every tool call is audited. The audit record captures: tool id, serialized input parameters, serialized result (truncated to 4 KB), success/failure, and duration. This uses the same audit infrastructure as service method calls (Objective 8).

## Consequences

**Easier:**

- Type safety on tool parameters is enforced both at TypeScript compile time and at runtime via Zod validation; a hallucinated parameter value that fails the schema is caught before `execute` is called
- Provider schema generation is handled by the adapter; prompt authors define tools once and they work across all providers
- Write tool protection is explicit and opt-in per stage; read-only stages cannot accidentally invoke write tools even if the model attempts to
- Full audit trail of tool calls is available alongside service-level audit events, enabling complete reconstruction of what a pipeline run did

**Harder:**

- Tool results returned to the model must be serialized to a string or JSON object; complex platform types require a serialization step in each tool's `execute` function
- Provider differences in tool calling conventions (parallel tool calls, required tool choice, schema limits) are hidden in adapters but require ongoing maintenance as providers evolve
- The 4 KB truncation limit on audited tool results means large tool outputs (e.g., full schema dumps) are not fully auditable by default; a separate artifact reference strategy is needed for large outputs

**Alternatives Considered:**

- **Untyped tool definitions with string parameters:** Tools accept free-form JSON; rejected — the model cannot be constrained to valid parameter shapes; validation errors surface at execution time rather than at definition time; no TypeScript safety for tool authors
- **No audit for tool calls:** Tool calls are implementation details of the model invocation, not platform operations; rejected — write tool calls that modify platform state must be auditable; the platform's audit obligations (Objective 8) extend to AI-mediated writes
- **Write tools always available, guarded only by permissions:** Write tools enabled by default, relying on permission checks alone; rejected — defense in depth requires that write tools are not invokable in stages that are architecturally read-only; the `writesToPlatform` flag is a stage-level gate, not just a permission gate
