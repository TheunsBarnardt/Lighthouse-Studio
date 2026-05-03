# ADR-0079: Zod for Service Boundary Validation

**Status:** Accepted
**Date:** 2026-05-02
**Objective:** 08-service-layer-architecture

---

## Context

TypeScript types are erased at runtime. A method with signature
`(ctx: RequestContext, input: CreateWorkspaceInput)` does not enforce that
`input.slug` is a non-empty string matching `/^[a-z0-9-]+$/` when called from
a JavaScript caller, a test that passes a partial object, or an API handler
that deserialised JSON without validation.

Defense in depth requires validating at every trust boundary, and the service
layer is the final trust boundary before business logic executes.

---

## Decision

Every service method validates its input using a **zod schema** as the first
step. Schemas are colocated with the service file. Validation failures return
`ValidationError` with structured field-level detail.

```typescript
const CreateWorkspaceInputSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/),
});

// In the method:
const parsed = CreateWorkspaceInputSchema.safeParse(input);
if (!parsed.success) {
  return err(
    new ValidationError(
      'Invalid workspace input',
      parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    ),
  );
}
```

Exported schemas are shared with the API layer for OpenAPI generation and with
the SDK for client-side validation.

---

## Consequences

**What becomes easier:**

- Validation errors include precise field paths and messages — the UI can show
  field-level hints without additional parsing.
- Schemas serve as documentation; reading the schema communicates the exact
  contract.
- Runtime safety even when TypeScript types are circumvented.

**What becomes harder:**

- Schema and TypeScript type must be kept in sync. Zod's `z.infer<>` handles
  this automatically for the input type, so drift is not a practical concern.

**Alternatives considered:**

- _TypeScript types only_ — rejected; erased at runtime.
- _Class-validator + class-transformer_ — rejected; decorators, class syntax,
  and transformer overhead are not worth it when zod is already in the
  dependency tree.
- _JSON Schema + ajv_ — rejected; zod produces better TypeScript types and is
  already used elsewhere in the codebase.
