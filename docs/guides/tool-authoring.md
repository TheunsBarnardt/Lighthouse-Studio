# Tool Authoring Guide

This guide covers how to add AI tools to the platform using the `defineTool` API. Tools let AI models call platform services — reading schemas, searching documentation, listing artifacts — during generation. Read this before writing any tool.

---

## What is a Tool?

When a prompt's `modelConfig` references tool IDs, `GenerationService` sends the tool definitions to the AI provider alongside the prompt. The provider (Anthropic, OpenAI, etc.) can then emit a tool-call request as part of its response. The platform intercepts the request, executes the tool, and feeds the result back to the model.

Tools are typed, permission-gated, and automatically audited. You cannot add a tool that bypasses these properties — they are enforced by the `ToolRegistry` and `GenerationService` orchestration, not by the tool's own `execute` function.

---

## File Location

All tools live in:

```
packages/core/src/ai/tools/
```

One tool per file:

```
packages/core/src/ai/tools/read-schema.tool.ts
packages/core/src/ai/tools/search-docs.tool.ts
packages/core/src/ai/tools/list-artifacts.tool.ts
packages/core/src/ai/tools/get-artifact.tool.ts
```

---

## The `defineTool` API

```typescript
import { defineTool } from '@platform/ai-core';
import { z } from 'zod';
import { ok, err } from 'neverthrow';

export const readSchema = defineTool({
  // --- Identity ---
  id: 'read_schema',
  description: "Read the customer's current schema for a workspace. Returns the full schema definition including tables, columns, indexes, and relationships.",

  // --- Parameter Schema ---
  parameters: z.object({
    schemaId: z.string().uuid(),
  }),

  // --- Return Schema ---
  returns: z.object({
    schema: SchemaSchema, // the Zod schema for the Schema domain type
  }),

  // --- Permissions ---
  permissions: ['schema.read'],

  // --- Write Tool Declaration ---
  // isWriteTool: false,      // default; see Write Tools below

  // --- Execute ---
  async execute(ctx: RequestContext, params): Promise<Result<{ schema: Schema }, AppError>> {
    const result = await schemaService.getSchema(ctx, params.schemaId);
    if (result.isErr()) return err(result.error);
    return ok({ schema: result.value });
  },
});
```

---

## `defineTool` Properties

### `id`

Snake-case string, unique across the platform. The AI provider receives this as the tool name. Keep it descriptive but concise — the model uses it to decide when to call the tool.

```typescript
id: 'read_schema';
id: 'search_documentation';
id: 'list_artifacts';
id: 'get_workspace_config';
```

### `description`

A clear, specific description of what the tool does and what it returns. The AI model reads this description when deciding whether to call the tool. Vague descriptions cause the model to either over-call or under-call the tool.

Good: `"Read the schema for a specific workspace. Returns tables, columns, types, and foreign key relationships."`

Bad: `"Gets schema information."`

### `parameters`

A Zod object schema describing the parameters the AI passes when calling the tool. Keep parameters simple — the model is generating these values, and complex nested structures are error-prone.

Rules:

- All parameters must have clear names
- String parameters should have `.describe()` with usage guidance
- Add `.uuid()` validators where applicable to prevent prompt injection via malformed IDs
- Avoid accepting raw SQL or code strings as parameters — use structured identifiers

### `returns`

A Zod schema describing the return value. This is used for:

1. Validating the tool's actual return value before feeding it back to the AI
2. Auto-generating the tool schema sent to providers that support typed returns

Keep return schemas lean. The AI model only needs enough to reason about next steps — it doesn't need every field of a 50-column schema response. Strip or summarise where appropriate inside `execute`.

### `permissions`

An array of permission strings the calling user must have for this tool to execute. The `ToolRegistry.executeCall` method checks these against the `RequestContext` before calling `execute`. If the user lacks any required permission, the tool returns a `PermissionDeniedError` to the AI — the AI receives this as a tool error and can handle it gracefully (e.g., by asking the user to grant access).

Common permission strings:

| Permission              | Scope                                  |
| ----------------------- | -------------------------------------- |
| `schema.read`           | Read workspace schemas                 |
| `artifact.read`         | Read pipeline artifacts                |
| `docs.search`           | Search internal documentation          |
| `workspace.config.read` | Read workspace configuration           |
| `schema.write`          | Modify workspace schemas (write tool)  |
| `artifact.create`       | Create pipeline artifacts (write tool) |

### `isWriteTool`

Defaults to `false`. Set to `true` for any tool that mutates state — creates, updates, or deletes any platform resource.

Write tools are **not included in prompts by default**. A stage must explicitly opt in to include write tools by listing them in the stage's `allowedWriteTools` configuration. Most stages should use only read tools.

```typescript
isWriteTool: true,   // required for tools that call service.create/update/delete
```

If you mark a tool as a read tool but its `execute` function mutates state, that is a security defect. When in doubt, mark it as a write tool.

---

## The `execute` Function

```typescript
async execute(ctx: RequestContext, params: Params): Promise<Result<Returns, AppError>>
```

`ctx` is the `RequestContext` for the user who triggered the generation that called this tool. It carries `workspaceId`, `userId`, and the authorization context.

**Rules for `execute`:**

1. **Return `Result<T, AppError>`** — never throw. Expected failures (not found, permission denied, validation error) return `err(appError)`. The `ToolRegistry` converts this to a structured tool error returned to the AI.

2. **Use service layer methods, not repositories directly.** The tool is part of core; it calls services which enforce authorization. Do not bypass the service layer to call adapter repositories directly.

3. **Scope queries to the workspace.** Always use `ctx.workspaceId`. A tool that reads data across workspaces is a security defect.

4. **Do not audit manually.** Every tool call is automatically audited by `ToolRegistry.executeCall` — it wraps your `execute` call with `ai.tool.called` and `ai.tool.failed` events. Adding your own audit events inside `execute` creates duplicate audit records.

5. **Do not call the AI provider from within a tool.** Tools are executed by the platform during a generation; calling the provider from inside `execute` creates recursive generations with unbounded cost.

6. **Keep execute functions short.** The logic should be: validate → call service → map result → return. If the tool needs significant logic, push that logic into a service method and call it.

---

## Audit Guarantee

You do not need to write audit code inside `execute`. The `ToolRegistry` guarantees:

- `ai.tool.called` is emitted before every `execute` invocation, with `tool_id` and `parameters` in metadata
- `ai.tool.failed` is emitted if `execute` returns `err(...)` or throws, with the error details
- Both events include `workspace_id`, `user_id`, `artifact_id`, and `generation_id` from the surrounding generation context

This audit guarantee holds **even for cached generations** — if the generation was served from cache but the original generation involved tool calls, the original tool call audit events are preserved. New tool calls do not fire for cached responses.

---

## Permission Model in Detail

When `ToolRegistry.executeCall` is invoked:

1. It calls `authz.check(ctx, permission)` for each permission in the tool's `permissions` array
2. If any check fails, it returns `err(new PermissionDeniedError(...))` immediately — `execute` is never called
3. The AI receives the permission error as a structured tool result
4. The AI may surface this to the user ("I don't have permission to read the schema — can you grant access?") or handle it gracefully depending on the prompt's instructions

For read tools, permissions are checked against the user's current workspace role. For write tools, the same permission check applies plus the stage's `allowedWriteTools` opt-in must include this tool's `id`.

---

## Registration

New tools must be registered in the composition root so `ToolRegistry` can find them:

```typescript
// packages/core/src/composition/ai-tools.ts

import { readSchema } from '../ai/tools/read-schema.tool';
import { searchDocs } from '../ai/tools/search-docs.tool';
import { listArtifacts } from '../ai/tools/list-artifacts.tool';
// ... import your new tool

export function registerAiTools(registry: ToolRegistry): void {
  registry.register(readSchema);
  registry.register(searchDocs);
  registry.register(listArtifacts);
  registry.register(yourNewTool); // add here
}
```

If you forget to register a tool, `ToolRegistry.get(toolId)` returns `null` and `GenerationService` logs a warning — the AI receives a `tool_not_found` error. Registration is required; there is no auto-discovery.

---

## Referencing Tools in Prompts

After registering, reference the tool in a prompt's `tools` array by its `id`:

```typescript
export const synthesizeSchema = definePrompt({
  id: 'schema.synthesize_from_prd',
  // ...
  tools: ['read_schema', 'list_artifacts'], // tool IDs; must be registered
  // ...
});
```

`GenerationService` looks up each tool by ID from the `ToolRegistry` and includes their definitions in the provider request. Only tools listed here are available to the AI for this prompt.

Write tools can only be listed here if the stage's `allowedWriteTools` config includes their IDs. If a prompt lists a write tool but the stage has not opted in, `GenerationService` removes the tool from the request and logs a warning.

---

## Testing

### Unit tests (recommended for most tools)

```typescript
// packages/core/src/ai/tools/read-schema.tool.test.ts

import { readSchema } from './read-schema.tool';
import { makeRequestContext, makeSchemaService } from '../../testing/factories';

describe('readSchema tool', () => {
  it('returns the schema for a valid schemaId', async () => {
    const ctx = makeRequestContext({ workspaceId: 'ws-1' });
    const mockSchemaService = makeSchemaService({
      getSchema: vi.fn().mockResolvedValue(ok(testSchema)),
    });

    const result = await readSchema.execute(ctx, { schemaId: 'schema-1' });

    expect(result.isOk()).toBe(true);
    expect(result.value.schema.id).toBe('schema-1');
  });

  it('returns NotFoundError when schema does not exist', async () => {
    const ctx = makeRequestContext({ workspaceId: 'ws-1' });
    const mockSchemaService = makeSchemaService({
      getSchema: vi.fn().mockResolvedValue(err(new NotFoundError('schema-1'))),
    });

    const result = await readSchema.execute(ctx, { schemaId: 'schema-1' });

    expect(result.isErr()).toBe(true);
    expect(result.error.kind).toBe('not_found');
  });

  it('rejects cross-workspace access', async () => {
    const ctx = makeRequestContext({ workspaceId: 'ws-1' });
    // The service enforces workspace scoping; a schema from ws-2 returns not_found to ws-1 context
    const result = await readSchema.execute(ctx, { schemaId: 'schema-from-ws-2' });
    expect(result.isErr()).toBe(true);
  });
});
```

Use mocked service dependencies. Do not call real databases or providers in tool unit tests.

### Integration tests (for complex tools)

Integration tests run against real test databases. Place them in `packages/core/src/ai/tools/<name>.tool.integration.test.ts` and ensure they follow the platform's integration test patterns (see the conformance test suite in `packages/ports/`).

Integration tests are run in CI against all three databases (Postgres, MSSQL, MongoDB) via the standard conformance matrix.

---

## Error Handling Reference

| Scenario                       | Return                                                                                                               |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Resource not found (by design) | `err(new NotFoundError(id))`                                                                                         |
| User lacks permission          | `err(new PermissionDeniedError(permission))` — but prefer letting `ToolRegistry` handle this via `permissions` array |
| Invalid parameter value        | `err(new ValidationError(field, message))`                                                                           |
| Downstream service error       | `err(serviceResult.error)` — propagate as-is                                                                         |
| Unexpected error               | `err(new InternalError(message))` — log details; do not expose internal state to AI                                  |

Never return a success result (`ok(...)`) when an error occurred and never throw from `execute`. The `ToolRegistry` does not catch thrown exceptions as gracefully as returned errors.

---

## Checklist Before Opening a PR

- [ ] File is at `packages/core/src/ai/tools/<name>.tool.ts`
- [ ] `id` is unique, snake_case, descriptive
- [ ] `description` clearly explains what the tool does and returns
- [ ] All `parameters` fields have `.describe()` documentation
- [ ] `permissions` array includes all required permissions
- [ ] `isWriteTool: true` if `execute` mutates any state
- [ ] `execute` uses `ctx.workspaceId` for all queries — no cross-workspace access
- [ ] `execute` calls service layer, not adapter repositories
- [ ] `execute` returns `Result<T, AppError>` — no throws
- [ ] No manual audit calls inside `execute`
- [ ] Tool is registered in `packages/core/src/composition/ai-tools.ts`
- [ ] Unit tests cover: happy path, not-found case, cross-workspace rejection
- [ ] `pnpm test packages/core/src/ai/tools/<name>.tool.test.ts` passes locally
