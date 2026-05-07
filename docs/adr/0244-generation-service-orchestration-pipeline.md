# ADR-0244: GenerationService Orchestration Pipeline

**Status:** Accepted
**Date:** 2026-05-06
**Objective:** 20 (AI Pipeline Foundation)

---

## Context

Every AI generation call needs the same cross-cutting concerns: authorization, prompt rendering with PII redaction, cache lookup, budget check, provider selection with failover, output validation, cost recording, and audit logging. Without a central orchestration point, each feature that calls the AI would reimplement (or forget) these concerns.

---

## Decision

`GenerationService` in `packages/core/src/services/ai/generation.service.ts` is the single entry point for all AI generation. It executes a fixed pipeline in order:

1. **Authorize** — `authz.check(ctx, 'ai.generate', stage)`
2. **Render prompt** — `PromptService.render()` validates inputs and applies PII redaction
3. **Cache check** — `AICachePort.get(cacheKey)` — return early on hit
4. **Budget check** — `CostTrackingService.checkBudget()` — fail fast if workspace is over limit
5. **Resolve provider** — first configured provider; failover to second on 5xx after one retry
6. **Call provider** — `AIProviderPort.generate()` or `generateStream()`
7. **Validate output** — Zod parse against prompt's `outputs` schema
8. **Cache write** — store on success with TTL from prompt config
9. **Record cost** — `CostTrackingService.recordUsage()`
10. **Audit** — emit `ai.generation.completed` or `ai.generation.failed`

The streaming variant (`generateStream`) yields `GenerationEvent` items while executing steps 5-10 asynchronously around the stream.

Tool calls in streaming responses are handled inline: on `tool_call_complete`, the tool is dispatched via `ToolRegistry`, the result injected as the next message, and generation continues.

---

## Consequences

**What becomes easier:**

- Feature teams call `generation.generate()` or `generation.generateStream()` — the pipeline is automatic.
- Adding a new cross-cutting concern (e.g., content filtering) means one change in `GenerationService`, not N changes across all callers.
- Budget enforcement and cost attribution are guaranteed for every call.

**What becomes harder:**

- The pipeline is fixed; callers cannot skip steps (e.g., bypass cache for a specific prompt). This is intentional — bypasses are a source of bugs and cost overruns. If a prompt legitimately shouldn't be cached, `ttlSeconds: 0` in prompt config disables caching.

---

## Alternatives Considered

- **Per-service AI calls (no central service):** Rejected — each service would reimplement authorization, budget, and audit; divergence is inevitable.
- **Middleware chain (express-style interceptors):** Rejected — harder to test; execution order is implicit rather than explicit.
- **LangChain agents:** Rejected — external dependency with its own lifecycle; the tool dispatch pattern in `ToolRegistry` serves the same purpose with full ownership.
