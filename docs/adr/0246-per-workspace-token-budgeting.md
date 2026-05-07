# ADR-0246: Per-Workspace Token Budgeting

**Status:** Accepted
**Date:** 2026-05-06
**Objective:** 20 (AI Pipeline Foundation)

---

## Context

AI generation costs real money per token. Without budget controls, a single misconfigured prompt or runaway automation could generate thousands of dollars in API costs before anyone notices. The platform is multi-tenant (multiple workspaces per installation); costs must be isolated per workspace so one workspace cannot exhaust the installation's API budget.

---

## Decision

`CostTrackingService` enforces per-workspace monthly token budgets:

- Each workspace has a `monthly_token_budget` configuration (default: 1,000,000 tokens / month).
- Before every generation call, `checkBudget(workspaceId, stage, estimatedTokens)` compares current month's usage against the budget.
- If `usage + estimated > budget * 0.95` (5% buffer), return `BudgetStatus.WARNING`; if over budget, return `BudgetStatus.EXCEEDED` and `GenerationService` blocks the call.
- Every successful generation records `AiUsageRecord` (tokens in/out/tool-use, cost USD, model, prompt ID+version, duration).
- Aggregated usage is queryable per workspace, per stage, per time window.

Token-to-cost conversion uses a static price map (`MODEL_PRICING` constant) updated when provider pricing changes. The cost in USD is informational; the budget enforcement uses tokens (provider-agnostic and immune to price changes).

---

## Consequences

**What becomes easier:**

- Workspaces can be isolated from each other's spending.
- Installation operators can set different budgets per workspace tier.
- Cost anomaly detection (via `ai_usage_records` queries) is built in.

**What becomes harder:**

- The 5% buffer means generation may be blocked slightly before the nominal budget is reached. Workspace owners can request a budget increase; there's no self-serve override.
- Static price maps must be updated when providers change pricing. A future enhancement could fetch live pricing from provider APIs.

---

## Alternatives Considered

- **Installation-wide budget only:** Rejected — one high-volume workspace can starve others.
- **Request-count limits instead of token limits:** Rejected — request counts are not meaningful across different prompt sizes; tokens are the universal unit.
- **No budget enforcement (pay-as-you-go):** Rejected — unacceptable for multi-tenant deployments where the installation operator is responsible for the API bill.
