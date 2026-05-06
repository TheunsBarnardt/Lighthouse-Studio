# ADR-0157: Per-Workspace Token Budgets

**Status:** Accepted
**Date:** 2026-05-06
**Objective:** 20 (AI Pipeline Foundation)

## Context

The AI Build Pipeline calls external AI providers that charge per token. Without usage controls, a single misconfigured pipeline, a runaway retry loop, or a malicious actor can generate unbounded costs that are charged back to the platform operator. At scale, even normal usage across thousands of workspaces requires predictable cost bounds.

A per-workspace budget system serves two goals: cost protection (preventing runaway spend) and cost transparency (showing each workspace how much AI generation has cost them this month). The budget must be configurable per workspace, enforce a hard cap, and provide early-warning signals before the cap is reached.

## Decision

Each workspace has a monthly USD-equivalent token budget, defaulting to $50. The budget is managed by `CostTrackingService` and persisted in the `workspace_ai_budget` table.

Cost is computed as: `tokens × per_provider_per_model_price_per_token`. Provider pricing is stored in a `ai_provider_pricing` table updated manually when providers change pricing (pricing changes are infrequent). The platform uses input token price for input tokens and output token price for output tokens.

Every AI provider call that completes records an entry in `ai_usage_records`:

```
workspace_id, stage_id, prompt_id, prompt_version, provider_id, model_id,
input_tokens, output_tokens, cost_usd, cache_hit (bool), created_at
```

Cache hits record `cost_usd: 0` and `cache_hit: true` (ADR-0155).

Budget enforcement:

- **80% threshold:** A workspace-level warning is emitted (visible in the platform UI's AI usage dashboard); pipeline runs continue
- **100% threshold:** New AI provider calls are blocked with a `BudgetExceededError`; cache hits are still served (they cost $0)
- **Per-stage allocation:** Each pipeline stage declares a `stageBudgetPct` that caps its fraction of the monthly workspace budget; a runaway stage cannot exhaust the entire budget

Budget resets on the first of each calendar month (UTC). Workspace administrators can request a mid-month budget increase through the settings UI, which requires platform operator approval.

## Consequences

**Easier:**

- Platform operators can offer AI Build Pipeline access with predictable per-workspace cost bounds; no surprise invoices from runaway pipelines
- Workspaces have full visibility into AI spend breakdown by stage, prompt, and provider via `ai_usage_records`
- The hard cap prevents a single misconfigured workspace from generating disproportionate platform costs
- Cache hits appear in the usage records as $0 entries, making the savings from caching visible in the dashboard

**Harder:**

- Provider pricing changes require a manual update to `ai_provider_pricing`; stale pricing leads to cost underestimation; a monitoring alert on pricing staleness (>30 days without update) mitigates this
- Per-stage budget allocation percentages must sum to ≤100%; orchestrators must validate this at pipeline configuration time
- A workspace hitting the hard cap mid-pipeline has its run interrupted; partial artifact states must be handled gracefully; the orchestrator must checkpoint before each stage so interrupted runs can resume after a budget increase

**Alternatives Considered:**

- **Global platform budget only (no per-workspace):** Simpler; rejected — doesn't protect the platform from a single workspace consuming disproportionate share; doesn't provide per-customer cost visibility required for billing
- **Rate limiting by tokens-per-minute rather than monthly budget:** Prevents bursts but doesn't cap total monthly spend; rejected — the risk is cumulative cost, not instantaneous rate; a slow steady consumer at high volume is not caught by rate limiting
- **Strict token-count budgets rather than USD-equivalent:** Budget in tokens, not dollars; rejected — token budgets are meaningless across providers (1M tokens on Ollama costs $0; 1M tokens on GPT-4o costs ~$10); USD normalization is required for a meaningful budget across the multi-provider architecture
