# Tool Authoring Guide

This guide explains how to author AI tools using the platform's `defineTool` API. Tools extend AI agents with the ability to read data or take actions during a pipeline run. Read Objective 20 (AI Pipeline Foundation) and the relevant stage objective before authoring tools.

---

## The `defineTool` API

Tools are defined using `defineTool`, which lives in `packages/core/src/ai/tools/`. The function signature is:

```typescript
import { defineTool } from '@platform/core/ai';
import { z } from 'zod';

export const getTableSchema = defineTool({
  name: 'get-table-schema',                  // verb-noun, kebab-case
  description: `Returns the column definitions and constraints for a table.
    Use this to understand the structure of a table before generating queries.`,
  inputSchema: z.object({
    schemaName: z.string().describe('The schema/namespace name'),
    tableName: z.string().describe('The table name'),
  }),
  mutating: false,                           // true if the tool writes or deletes data
  handler: async (input, context): Promise<ToolResult> => {
    // context contains: requestContext, services, logger
    const result = await context.services.schemaService.getTable(
      input.schemaName,
      input.tableName,
      context.requestContext,
    );

    if (result.isErr()) {
      return { ok: false, error: result.error.message };
    }

    return { ok: true, data: result.value };
  },
});
```

---

## Read-Only vs. Mutating Tools

The most important classification for a tool is whether it mutates state.

**Read-only tools** (`mutating: false`):
- Do not require explicit approval from the AI pipeline's approval routing engine.
- Can be called freely during a generation run.
- Examples: `get-table-schema`, `get-brief-draft`, `list-workspace-tables`.

**Mutating tools** (`mutating: true`):
- Require an approval step before execution if the pipeline stage has approval routing configured.
- Must call `authz.check()` before performing any write, delete, or side-effecting operation.
- Emit an audit event after successful execution.
- Examples: `update-brief-field`, `create-draft-artifact`, `publish-prd-version`.

The `mutating` flag is checked by the tool registry when constructing the approved tool list for a generation run. Never misclassify a mutating tool as read-only to bypass the approval mechanism.

---

## Permission Checks in Tool Handlers

Every mutating tool must call `authz.check()` before performing the mutation. This is non-negotiable — tools run inside an AI agent context, where the risk of prompt injection (Objective 27) makes authorization checks especially critical.

```typescript
handler: async (input, context): Promise<ToolResult> => {
  // Step 1: Authorize
  const authzResult = await context.services.authz.check(
    context.requestContext,
    'artifact.write',                // the permission being requested
    { resourceId: input.artifactId } // optional resource scoping
  );

  if (authzResult.isErr() || !authzResult.value.allowed) {
    return {
      ok: false,
      error: 'Not authorized to modify this artifact',
    };
  }

  // Step 2: Execute
  const updateResult = await context.services.artifactService.updateField(
    input.artifactId,
    input.fieldPath,
    input.value,
    context.requestContext,
  );

  if (updateResult.isErr()) {
    return { ok: false, error: updateResult.error.message };
  }

  return { ok: true, data: updateResult.value };
},
```

Do not assume that because the AI pipeline authorized the overall generation run, individual tool calls are authorized. Tools must check permissions independently.

---

## Audit Emission for Mutating Tools

Mutating tools must emit an audit event after successful execution. Use the `AuditService` from the tool context:

```typescript
await context.services.auditService.record({
  requestContext: context.requestContext,
  action: 'artifact.field_updated',
  resourceType: 'artifact',
  resourceId: input.artifactId,
  details: {
    fieldPath: input.fieldPath,
    triggeredBy: 'ai_tool',
    toolName: 'update-brief-field',
  },
});
```

The audit record is important: it distinguishes AI-initiated mutations from user-initiated mutations in the audit log, which matters for compliance review.

---

## Error Handling in Tool Handlers

Tool handlers must return a structured `ToolResult` — they must not throw exceptions. Unhandled exceptions in a tool handler will crash the generation run and produce a poor user experience.

```typescript
// Good: return a structured error
if (result.isErr()) {
  return {
    ok: false,
    error: `Failed to retrieve schema: ${result.error.message}`,
    errorCode: result.error.kind,
  };
}

// Bad: throw
if (result.isErr()) {
  throw new Error(result.error.message); // Don't do this
}
```

The `error` string in a failed `ToolResult` is visible to the AI model — it uses this to decide how to proceed (retry, use a fallback, or report failure to the user). Write error messages that are descriptive enough for the model to make a sensible decision.

For unexpected internal errors (database unavailable, service crash), catch and return:

```typescript
try {
  // ...
} catch (err) {
  context.logger.error({ err, tool: 'get-table-schema' }, 'Unexpected tool error');
  return { ok: false, error: 'Internal error — please try again', errorCode: 'internal' };
}
```

---

## Testing Tools

### Unit Testing the Handler

Test the tool handler directly with mock services:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { getTableSchema } from './get-table-schema';
import { createMockToolContext } from '@platform/core/ai/testing';

describe('getTableSchema', () => {
  it('returns schema columns for a valid table', async () => {
    const ctx = createMockToolContext({
      services: {
        schemaService: {
          getTable: vi.fn().mockResolvedValue(ok({ columns: [/* ... */] })),
        },
      },
    });

    const result = await getTableSchema.handler(
      { schemaName: 'public', tableName: 'users' },
      ctx,
    );

    expect(result.ok).toBe(true);
    expect(result.data.columns).toBeDefined();
  });

  it('returns an error if the table does not exist', async () => {
    const ctx = createMockToolContext({
      services: {
        schemaService: {
          getTable: vi.fn().mockResolvedValue(err(new NotFoundError('Table not found'))),
        },
      },
    });

    const result = await getTableSchema.handler(
      { schemaName: 'public', tableName: 'nonexistent' },
      ctx,
    );

    expect(result.ok).toBe(false);
    expect(result.error).toContain('Table not found');
  });
});
```

### Integration Testing with the Tool Registry

For integration tests, register the tool and verify it appears correctly:

```typescript
import { toolRegistry } from '@platform/core/ai';
import { getTableSchema } from './get-table-schema';

describe('tool registry', () => {
  it('getTableSchema is registered as read-only', () => {
    const registered = toolRegistry.get('get-table-schema');
    expect(registered).toBeDefined();
    expect(registered.mutating).toBe(false);
  });
});
```

---

## Tool Naming Conventions

Tool names follow the `verb-noun` pattern in kebab-case. The verb describes the action; the noun describes the subject.

| Verb     | Use when the tool...                               |
|----------|----------------------------------------------------|
| `get`    | Retrieves a single resource                        |
| `list`   | Retrieves multiple resources                       |
| `create` | Creates a new resource                             |
| `update` | Updates an existing resource                       |
| `delete` | Deletes a resource                                 |
| `search` | Searches/filters resources by criteria             |
| `check`  | Validates or tests something without side effects  |

Examples:
- `get-brief-draft` — retrieves the current draft of a brief
- `list-workspace-tables` — lists tables in a workspace
- `update-brief-field` — updates a single field in a brief
- `create-draft-artifact` — creates a new draft artifact
- `check-schema-compatibility` — validates schema compatibility (read-only)

Avoid generic names like `process-data` or `handle-input`. The name should be immediately clear about what the tool does and what it operates on.

---

## Registering Tools

Tools are registered in the stage's tool manifest:

```typescript
// packages/core/src/ai/stages/intent-capture/tools/index.ts
import { toolRegistry } from '@platform/core/ai';
import { getBriefDraft } from './get-brief-draft';
import { updateBriefField } from './update-brief-field';

toolRegistry.register([getBriefDraft, updateBriefField]);
```

A tool that is not registered cannot be called by an AI agent. Tools are registered per-stage to keep the tool surface area minimal for each stage.
