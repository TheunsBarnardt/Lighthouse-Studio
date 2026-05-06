# Runbook: AI Budget Exceeded

**Audience:** Platform operators, workspace admins
**Relates to:** Objective 20, ADR-0157

---

## Overview

When a workspace exhausts its monthly AI token budget, all further generation requests return a `budget_exceeded` error and are recorded in `ai_usage_records` with `status = 'budget_exceeded'`. The `ai.budget.exceeded` audit event is emitted. This runbook covers identifying what happened, extending the budget if appropriate, and preventing recurrence.

---

## Step 1: Identify the Affected Workspace

### Via audit events

```bash
GET /api/v1/admin/audit?event=ai.budget.exceeded&from=<start_of_month>
Authorization: Bearer <admin_token>
```

Each event's metadata contains `workspace_id`, `stage`, and `budget_usd`.

### Via the Grafana AI dashboard

The **Budget Utilization** panel shows `platform_ai_cost_usd_total{workspace}` as a percentage of each workspace's configured `monthly_budget_usd`. Any workspace at 100% is affected.

### Direct database query

```sql
SELECT
  r.workspace_id,
  SUM(r.cost_usd) AS total_cost_usd,
  c.monthly_budget_usd,
  ROUND(SUM(r.cost_usd) / c.monthly_budget_usd * 100, 1) AS pct_used
FROM ai_usage_records r
JOIN ai_workspace_config c ON r.workspace_id = c.workspace_id
WHERE r.created_at >= date_trunc('month', NOW())
GROUP BY r.workspace_id, c.monthly_budget_usd
HAVING SUM(r.cost_usd) >= c.monthly_budget_usd
ORDER BY total_cost_usd DESC;
```

---

## Step 2: Understand the Consumption Pattern

Before extending the budget, understand what drove the usage. Query per-stage breakdown for the workspace:

```sql
SELECT
  stage,
  prompt_id,
  prompt_version,
  provider,
  model,
  COUNT(*) AS generations,
  SUM(input_tokens) AS total_input_tokens,
  SUM(output_tokens) AS total_output_tokens,
  SUM(tool_use_tokens) AS total_tool_tokens,
  SUM(cost_usd) AS total_cost_usd,
  ROUND(AVG(cost_usd)::numeric, 6) AS avg_cost_per_call
FROM ai_usage_records
WHERE workspace_id = '<workspace_id>'
  AND created_at >= date_trunc('month', NOW())
GROUP BY stage, prompt_id, prompt_version, provider, model
ORDER BY total_cost_usd DESC;
```

Look for:

- **A single stage consuming disproportionate budget** — indicates a runaway loop or a stage being invoked far more than expected
- **A high `avg_cost_per_call`** — indicates a prompt with unexpectedly large inputs or outputs
- **`cached = false` on all records** — the cache may not be operating, causing redundant expensive calls

---

## Step 3: Identify Top Consumers by User

If the workspace has multiple users, identify which user is driving consumption:

```sql
SELECT
  user_id,
  stage,
  COUNT(*) AS generations,
  SUM(cost_usd) AS total_cost_usd
FROM ai_usage_records
WHERE workspace_id = '<workspace_id>'
  AND created_at >= date_trunc('month', NOW())
GROUP BY user_id, stage
ORDER BY total_cost_usd DESC
LIMIT 20;
```

If a single user is responsible for most usage, contact them directly before extending the budget.

---

## Step 4: Investigate Runaway Usage

### Check for tool-call loops

An AI model stuck in a tool-call loop generates many `ai.tool.called` audit events in rapid succession. Query:

```sql
SELECT
  r.artifact_id,
  COUNT(*) AS generation_count,
  SUM(r.cost_usd) AS artifact_cost_usd
FROM ai_usage_records r
WHERE r.workspace_id = '<workspace_id>'
  AND r.created_at >= NOW() - INTERVAL '24 hours'
GROUP BY r.artifact_id
ORDER BY generation_count DESC
LIMIT 10;
```

An artifact with > 10 generation records in 24 hours is suspicious. Cross-reference with the audit log:

```bash
GET /api/v1/admin/audit?workspace_id=<workspace_id>&event=ai.tool.called&artifact_id=<artifact_id>
```

### Check for cache misses

```sql
SELECT
  prompt_id,
  COUNT(*) FILTER (WHERE cached = true) AS cache_hits,
  COUNT(*) FILTER (WHERE cached = false) AS cache_misses,
  SUM(cost_usd) FILTER (WHERE cached = false) AS miss_cost_usd
FROM ai_usage_records
WHERE workspace_id = '<workspace_id>'
  AND created_at >= date_trunc('month', NOW())
GROUP BY prompt_id
ORDER BY miss_cost_usd DESC;
```

If a prompt shows near-zero cache hits despite identical-looking invocations, the cache key computation may be broken. Check the `ai-cache-invalidation.md` runbook.

---

## Step 5: Extend the Budget

Once you understand the consumption pattern and have confirmed it's legitimate (not runaway usage), extend the workspace's monthly budget using `CostTrackingService.setBudget`:

**Via the admin API:**

```bash
PATCH /api/v1/admin/workspaces/<workspace_id>/ai-config
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "monthly_budget_usd": 150.00
}
```

This calls `CostTrackingService.setBudget` internally and emits an `ai.budget.updated` audit event. The change is effective immediately.

**Per-stage budget adjustments:**

If one stage is consuming disproportionately, tighten its allocation rather than increasing the total budget:

```bash
PATCH /api/v1/admin/workspaces/<workspace_id>/ai-config
{
  "per_stage_budget_pct": {
    "intent": 10,
    "prd": 20,
    "design_tokens": 10,
    "schema": 15,
    "server_functions": 25,
    "ui_components": 20
  }
}
```

Percentages must sum to 100. The `CostTrackingService.checkBudget` call before each generation enforces these per-stage caps.

---

## Step 6: Communicate to the Workspace Admin

Notify the workspace admin of:

1. When the budget was exceeded
2. Which stage and which users drove the usage
3. Whether the budget was extended, and to what amount
4. Any action required from them (e.g., a user doing excessive generation should be advised on prompt efficiency)

Template:

**Subject:** AI token budget for workspace [name] has been extended

**Body:** Your workspace reached its monthly AI generation budget of $[amount] on [date]. After reviewing usage (primary driver: [stage] by [user/system]), we extended the budget to $[new_amount] for the remainder of this month. Next month's budget remains at $[original_amount] — please contact us if you need a permanent increase.

---

## Step 7: Prevent Recurrence

1. **Set 80% soft warning notifications.** The `ai.budget.warning_80` and `ai.budget.warning_95` events trigger when usage crosses those thresholds. Ensure workspace admins are subscribed to these notifications.

2. **Review per-stage budget allocations.** If one stage is consistently near its cap, either raise its percentage or raise the total.

3. **Enable cache for high-frequency prompts.** If the top consumer is a prompt with identical inputs being re-run, check that `cacheControl` is not set to `bypass_cache` in its call site.

4. **Apply per-user soft limits.** If a single user is responsible, advise them or apply a per-user alert threshold via workspace settings.

---

## Key Facts

- The `CostTrackingService.checkBudget` check runs **before** sending the request to the provider. Requests are blocked at the platform boundary, not charged and then refunded.
- `ai_usage_records.status = 'budget_exceeded'` rows represent requests that were blocked, not billed.
- The `platform_ai_cost_usd_total{workspace, stage}` Grafana counter accumulates across the life of the deployment; use `rate()` or filter by `created_at` for monthly analysis.
- Cost records reflect token pricing at the time of generation. Pricing table updates are applied prospectively.
