---
name: service-shape-check
description: Use this skill whenever a service method is being added, modified, or reviewed in packages/core/src/services/ or any *.service.ts file. Also trigger when the user mentions "service method", "canonical shape", "authz check", "audit emission", "Result type", "RequestContext", or asks to add a method to a service. Validates the canonical service method shape from Objective 8 — validation → authorization → precondition → execute → audit → return — and surfaces violations like missing authz checks, missing workspace scoping, throws instead of Result types, missing audit events, and missing zod boundary validation. Treats authorization gaps as security bugs, not style issues.
---

# Service Shape Check

The canonical service method shape (Objective 8, ADR-0076) is non-negotiable in this codebase. Skipping a step — especially authorization — creates security holes. This skill catches violations before they ship.

## The canonical shape

Every public service method MUST follow this sequence:

```
1. Validate input (zod, returns ValidationError if invalid)
2. Authorize (authz.check / authz.authorize, returns ForbiddenError if denied)
3. Precondition checks (entity exists, version matches, state allows op)
4. Execute (repository calls, possibly inside withTransaction / withLock)
5. Emit audit event (audit.emit for every state-changing operation)
6. Return Result<T, AppError>
```

Reference: `objectives/08-service-layer-architecture.md` and the ADRs 0076-0082.

## When to use

- A new service method is being written
- A service method is being modified (especially adding logic before authz)
- Reviewing a PR that touches `*.service.ts`
- The user asks "is this method correct?" or "what's wrong with this service?"
- Auditing existing services for compliance

## How to use

### Step 1: Identify the method(s) in scope

If the user points at a specific file, read it. If the user is reviewing a branch, run `git diff master...HEAD --stat` to find changed `*.service.ts` files.

### Step 2: Walk each public method through the checklist

For each public method (not constructor, not private helpers):

**Signature checks:**

- [ ] First parameter is `RequestContext` or `SystemContext` (named `ctx`)
- [ ] Return type is `Promise<Result<T, AppError>>` (or `ResultAsync<T, AppError>`)
- [ ] Input parameter has a typed shape (not `any`, not raw object)

**Body sequence checks (in order):**

- [ ] Step 1 — zod parse/safeParse on input; returns `ValidationError` on failure
- [ ] Step 2 — `authz.authorize(ctx, '<action>', '<resource>')` early, before any DB read of user-influenced data; `.isErr()` check returns the error
- [ ] Step 3 — precondition checks (existence, version match for optimistic locking, state)
- [ ] Step 4 — repository calls; if multiple writes, wrapped in `withTransaction`
- [ ] Step 5 — `audit.emit(...)` for every state-changing path (creates, updates, deletes, status changes); skip for read-only methods
- [ ] Step 6 — returns `ok(...)` or `err(...)`; never throws

**Workspace scoping (CRITICAL):**

- [ ] If the method touches workspace-scoped data, queries use `ctx.workspaceId` (or the auto-injection helper from ADR-0055)
- [ ] No raw repository queries that bypass workspace scoping
- [ ] Cross-workspace operations are explicit and authorized accordingly

**Optimistic locking:**

- [ ] Update methods take `expectedVersion` (or equivalent) and check it
- [ ] `version_mismatch` errors surface as `ConflictError`

**Idempotency (where required):**

- [ ] Mutating methods accept optional `idempotencyKey` per ADR-0081
- [ ] Duplicate keys within window return cached result

### Step 3: Produce the report

Use this format:

```markdown
# Service Shape Check: <file path>

## Method: <ClassName.methodName>(...)

**Verdict:** ✅ Compliant / ⚠️ Minor issues / ❌ Violations found

### Checks

- ✅ Signature: ctx is first param, returns Result<T, AppError>
- ❌ Authorization: authz.authorize() not called — **SECURITY BUG**
- ⚠️ Audit: state change at line 47 has no audit.emit
- ✅ Workspace scoping: uses ctx.workspaceId at line 32

### Violations (in priority order)

1. **[Critical] Missing authorization** at <file>:<line>

   - The method writes to `workspace_members` but never calls `authz.authorize`.
   - Fix: insert `authz.authorize(ctx, 'workspace.member.add', 'workspace')` immediately after input validation.

2. **[High] Missing audit emission** at <file>:<line>

   - The method updates a workspace but emits no audit event.
   - Fix: add `await audit.emit({ kind: 'workspace.updated', actor: ctx.actorId, target: workspace.id, ... })` after the successful repo call.

3. **[Medium] Throws instead of returning Result** at <file>:<line>
   - Use `err(new NotFoundError(...))` instead of throwing.

### Cross-cutting observations

<patterns that span multiple methods — e.g., "every method in this file is missing the precondition check before write">
```

### Step 4: Surface security issues loudly

Authorization gaps and workspace-scoping gaps are **security bugs**, not style issues. The CLAUDE.md is explicit: "Forgetting authorization is a security bug, not a style issue" and "Queries that don't filter by workspace can leak data across workspaces — which is the platform's worst failure mode."

When a check fails on authorization or workspace scoping:

- Tag it `[Critical]` in the report
- Recommend fixing before any other work proceeds
- Do not soften the language ("might want to consider", "could potentially")

### Step 5: Don't auto-fix without confirmation

This skill reports violations. It does not silently rewrite service methods. If the user asks to fix the violations, propose the minimal change needed, get confirmation, then apply.

## Examples

**Example 1: Missing authz**

Input:

```typescript
async create(ctx: RequestContext, input: CreateInput): Promise<Result<Workspace, AppError>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return err(new ValidationError(...));

  const workspace = await this.repo.insert(parsed.data);
  return ok(workspace);
}
```

Output: ❌ **Critical** — no `authz.authorize()` call. Insert immediately after step 1. Also missing audit emission for the create.

**Example 2: Workspace scoping bypass**

Input:

```typescript
async list(ctx: RequestContext): Promise<Result<Workspace[], AppError>> {
  const all = await this.repo.findAll();
  return ok(all);
}
```

Output: ❌ **Critical** — `findAll()` returns ALL workspaces across tenants. Must scope by `ctx.workspaceId` or use the auto-injection helper. This is a data leakage bug.

## Anti-patterns to refuse

- **Skipping authz "because it's an internal method".** Internal/external is determined by the port boundary, not by Claude's read of intent. If the method is on a service class and called from elsewhere, it needs authz.
- **Soft-pedaling security findings.** Critical issues get critical language.
- **Approving a method that "looks like" the canonical shape without walking the checklist.** Mechanical verification is the point.
- **Adding error handling for impossible cases.** If zod validates `name.min(1)`, the body doesn't need to re-check for empty strings (per CLAUDE.md guidance on no extra error handling).
