# Runbook: AI Cost Anomaly Investigation

**Audience:** Platform operators
**Relates to:** Objective 20, ADR-0157

---

## Overview

A cost anomaly is when a workspace's AI spending deviates significantly from its historical pattern — typically 3x or more above the hourly average for that workspace. The platform emits a warning log when a workspace consumes 10x its average per hour. This runbook covers identifying the spike, tracing it to a specific prompt or usage pattern, and applying remediation.

---

## Step 1: Detect the Anomaly

### Via the Grafana AI dashboard

Open the **AI Cost** panel and look at `platform_ai_cost_usd_total{workspace, stage}`. Use `rate(platform_ai_cost_usd_total[1h])` to see per-hour spend rate per workspace. A spike on a single workspace is immediately visible.

Sort workspaces by spend rate in descending order. Any workspace at more than 3x its 7-day average warrants investigation.

### Via platform logs

```
[WARN] cost-tracking.service: workspace <id> consumed <amount> USD in the last hour (10x hourly average)
```

### Via `ai_usage_records` for the anomalous period

```sql
SELECT
  workspace_id,
  date_trunc('hour', created_at) AS hour,
  SUM(cost_usd) AS hourly_cost_usd,
  COUNT(*) AS generation_count
FROM ai_usage_records
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY workspace_id, hour
ORDER BY hourly_cost_usd DESC
LIMIT 20;
```

Identify the workspace and the specific hour(s) where cost spiked.

---

## Step 2: Identify the Prompt and Model Driving the Spike

Narrow down to the anomalous period:

```sql
SELECT
  prompt_id,
  prompt_version,
  provider,
  model,
  COUNT(*) AS calls,
  SUM(input_tokens) AS total_input_tokens,
  SUM(output_tokens) AS total_output_tokens,
  SUM(tool_use_tokens) AS total_tool_tokens,
  SUM(cost_usd) AS total_cost_usd,
  ROUND(AVG(input_tokens), 0) AS avg_input_tokens,
  ROUND(AVG(output_tokens), 0) AS avg_output_tokens
FROM ai_usage_records
WHERE workspace_id = '<workspace_id>'
  AND created_at BETWEEN '<spike_start>' AND '<spike_end>'
GROUP BY prompt_id, prompt_version, provider, model
ORDER BY total_cost_usd DESC;
```

The top row identifies the prompt/model combination responsible. Note the `avg_input_tokens` and `avg_output_tokens` — compare them against the prompt's declared `tokenBudget` in its TypeScript definition.

---

## Step 3: Check for Infinite Tool-Call Loops

A common cause of cost spikes is an AI model entering a loop where it repeatedly calls tools without converging on a final answer. Each iteration consumes tokens; a loop of 50 iterations can exhaust a workspace's monthly budget in minutes.

### Detect tool-call loops via audit events

```bash
GET /api/v1/admin/audit?workspace_id=<workspace_id>&event=ai.tool.called&from=<spike_start>&to=<spike_end>
Authorization: Bearer <admin_token>
```

If a single `artifact_id` appears in dozens of `ai.tool.called` events within a short window, a loop occurred.

### Check generation records for the suspect artifact

```sql
SELECT
  id,
  artifact_id,
  input_tokens,
  output_tokens,
  tool_use_tokens,
  cost_usd,
  duration_ms,
  status,
  created_at
FROM ai_usage_records
WHERE artifact_id = '<suspect_artifact_id>'
ORDER BY created_at ASC;
```

A loop produces many rows for the same `artifact_id` with high `tool_use_tokens` relative to `output_tokens`.

### Check the prompt definition for loop safeguards

Open the prompt TypeScript file:

```
packages/core/src/ai/prompts/<stage>/<name>.prompt.ts
```

The `modelConfig` should include `maxTokens` to bound output length, and `GenerationService` enforces a maximum tool-call iteration count. If either is missing or set too high, that is the defect.

---

## Step 4: Check for Unexpectedly Large Inputs

A prompt may have been called with inputs far larger than the golden-input examples in its test suite. This happens when:

- A user pastes a very long document into a free-text field
- The input schema accepts an `array` with no `max()` constraint and the caller passes thousands of items
- A previous artifact feeding this stage has grown very large (Objective 20 artifacts can grow in content over revisions)

Check input token distribution:

```sql
SELECT
  percentile_cont(0.5) WITHIN GROUP (ORDER BY input_tokens) AS p50,
  percentile_cont(0.9) WITHIN GROUP (ORDER BY input_tokens) AS p90,
  percentile_cont(0.99) WITHIN GROUP (ORDER BY input_tokens) AS p99,
  MAX(input_tokens) AS max_input_tokens
FROM ai_usage_records
WHERE workspace_id = '<workspace_id>'
  AND prompt_id = '<prompt_id>'
  AND created_at >= NOW() - INTERVAL '30 days';
```

Compare the spike-period `avg_input_tokens` from Step 2 against `p99` from normal operation. If the spike's average exceeds the 99th percentile of normal usage, the inputs are anomalously large.

**Remediation:** Add `max()` constraints to the input Zod schema for array and string fields, or add a pre-generation input size check that returns an error before calling the provider.

---

## Step 5: Apply Per-Workspace Rate Limits

If the investigation reveals runaway usage that is not explained by user action, apply a temporary per-workspace generation rate limit to prevent further runaway spend while you fix the root cause:

```bash
PATCH /api/v1/admin/workspaces/<workspace_id>/ai-config
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "generation_rate_limit_per_hour": 50
}
```

This limits the workspace to 50 generation calls per hour across all stages. Callers receive a `RateLimitError` when exceeded.

Remove the rate limit once the root cause is resolved:

```bash
PATCH /api/v1/admin/workspaces/<workspace_id>/ai-config
{
  "generation_rate_limit_per_hour": null
}
```

---

## Step 6: Cancel Runaway Artifacts in Progress

If a specific artifact is in a tool-call loop that is still running, cancel the generation:

```bash
POST /api/v1/admin/workspaces/<workspace_id>/artifacts/<artifact_id>/cancel-generation
Authorization: Bearer <admin_token>
```

This terminates the active `AsyncIterable<GenerationEvent>` for the artifact and sets the artifact status back to `draft`. The workspace's token budget retains the charges already incurred.

---

## Step 7: Investigate Caching Failures

If the spike is caused by high call volume rather than large inputs, the cache may have stopped working. A normally-cached prompt suddenly receiving all misses will generate linear cost instead of near-zero.

Check the cache hit rate for the prompt:

```sql
SELECT
  date_trunc('hour', created_at) AS hour,
  COUNT(*) FILTER (WHERE cached = true) AS hits,
  COUNT(*) FILTER (WHERE cached = false) AS misses,
  ROUND(COUNT(*) FILTER (WHERE cached = true) * 100.0 / COUNT(*), 1) AS hit_rate_pct
FROM ai_usage_records
WHERE workspace_id = '<workspace_id>'
  AND prompt_id = '<prompt_id>'
  AND created_at >= NOW() - INTERVAL '48 hours'
GROUP BY hour
ORDER BY hour DESC;
```

If the hit rate drops from > 50% to near 0% at a specific hour, correlate that hour with any deployments, config changes, or prompt version bumps. A version bump invalidates the cache for that prompt (the cache key includes `prompt_version`). See `ai-cache-invalidation.md` if cache repair is needed.

---

## Key Facts

- `platform_ai_cost_usd_total{workspace, stage}` is a monotonically increasing counter. Use `rate()` in Grafana or compute deltas in SQL for period cost.
- The platform warns at 10x average hourly spend per workspace. The threshold is hardcoded in `CostTrackingService` and not currently workspace-configurable.
- Tool-call token usage is tracked separately in `ai_usage_records.tool_use_tokens`. A high `tool_use_tokens` to `output_tokens` ratio on a single generation is a loop signal.
- Cancelling an in-progress generation does not refund tokens already consumed. The provider has already processed those tokens.
