# ADR-0152: Prompts as Code, Not Database Strings

**Status:** Accepted
**Date:** 2026-05-06
**Objective:** 20 (AI Pipeline Foundation)

## Context

AI prompts are the most critical logic in the AI Build Pipeline. They encode stage-specific intent, constrain output structure, and determine quality. The question is where prompts live and how they are managed over time.

Two broad options exist: prompts stored in the database (editable at runtime without a deploy) or prompts stored as TypeScript modules alongside the code that calls them (versioned, reviewed, testable like any other code). The right choice depends on who needs to change prompts, how often, and what guarantees are needed around correctness.

The platform's primary operators are its own engineering team, not end users. Prompt quality is a product-level concern, not a per-customer configuration. The cost and quality regression risk of unreviewed runtime prompt edits outweighs the deployment convenience.

## Decision

Prompts are TypeScript modules in `packages/core/src/ai/prompts/<stage>/`. Each prompt is defined using the `definePrompt` API:

```typescript
export const generatePrdPrompt = definePrompt({
  id: 'generate-prd',
  version: '1.2.0',
  stage: 'prd-generation',
  inputSchema: z.object({
    projectDescription: z.string().min(10),
    targetAudience: z.string(),
    constraints: z.array(z.string()).optional(),
  }),
  outputSchema: z.object({
    sections: z.array(PrdSectionSchema),
    reasoning: ReasoningRecordSchema,
  }),
  tokenBudget: { inputTokens: 4000, outputTokens: 8000 },
  cacheControl: { ttl: 86400, bypassable: true },
  temperature: 0,
  build(input) {
    return {
      system: `You are a senior product manager...`,
      user: `Create a PRD for: ${input.projectDescription}`,
    };
  },
});
```

Prompt versions follow semver. A patch bump (1.2.0 → 1.2.1) fixes wording without changing the schema. A minor bump (1.2.0 → 1.3.0) adds optional output fields. A major bump (1.2.0 → 2.0.0) changes the schema and requires migration of any stored outputs.

Changes to prompt files go through standard code review (PR, CI, merge). Prompts are tested with golden inputs in `packages/core/src/ai/prompts/<stage>/__tests__/`.

## Consequences

**Easier:**

- Prompts are diffable: a PR shows exactly what changed, token budget deltas, and schema changes side by side
- Zod schemas enforce that prompts receive well-typed inputs and produce well-typed outputs at the TypeScript boundary
- CI can run determinism checks, cost regression checks, and quality assertions against golden inputs before merge
- Prompt authorship and history are in git blame / commit history — no separate audit trail needed
- Rollback is a git revert — no migration required for prompt rollback (artifacts already stored reference the prompt version that produced them)

**Harder:**

- Prompt changes require a deploy; there is no instant hotfix path for a production prompt regression
- A/B testing prompt variants requires feature-flag infrastructure or version-pinned workspace configuration, not a simple DB toggle
- Operators cannot customize prompts per-workspace without forking the prompt module (which is a deliberate constraint, not a gap)

**Alternatives Considered:**

- **Prompts in database with UI editor:** Runtime editability without a deploy; rejected — no code review, no CI testing, no diff history; a single bad edit can silently degrade all outputs for all workspaces; the risk is asymmetric
- **Prompts as JSON/YAML files:** Structured data, diffable, but no TypeScript type safety on inputs/outputs; rejected — the `definePrompt` API with Zod schemas provides stronger guarantees for minimal additional complexity
- **Prompts in database with version history:** DB-backed versioning with audit log; rejected — approximates what git already provides, with more infrastructure and less tooling (no IDE support, no diff UX, no branch-based staging)
