# Runbook: AI Provider Outage

**Audience:** Platform operators
**Relates to:** Objective 20, ADR-0151

---

## Overview

This runbook covers what to do when a primary AI provider (Anthropic, OpenAI, Azure OpenAI, etc.) is unavailable or returning elevated error rates. The platform supports automatic failover to a configured secondary provider, but some workspaces require manual intervention or communication.

---

## Step 1: Detect the Outage

### Check the platform health metric

The `platform_ai_provider_failures_total{provider}` counter spikes when a provider is returning errors. Open the Grafana AI dashboard and look at the **Provider Failures** panel.

A sustained rate above 10 failures/minute on a single provider label (e.g., `provider="anthropic"`) indicates an outage, not transient noise.

### Check the provider status page

- Anthropic: https://status.anthropic.com
- OpenAI: https://status.openai.com
- Azure: https://status.azure.com

If the provider confirms an incident, skip Step 2 (root cause investigation) and move to Step 3.

### Check the audit log

```bash
GET /api/v1/admin/audit?event=ai.generation.failed&from=<15_min_ago>
Authorization: Bearer <admin_token>
```

If `ai.generation.failed` events are grouping around a single `provider` value in their metadata, the outage is provider-side.

### Check platform logs

Look for repeated `AIProviderPort.generate` errors with status codes 500, 503, or connection timeouts:

```
[ERROR] ai-provider-anthropic: generate failed (status=503, attempt=2)
[ERROR] generation.service: provider exhausted; no fallback configured for workspace <id>
```

---

## Step 2: Determine Failover Status

### Automatic failover

The `GenerationService` automatically retries the primary provider once on 5xx errors or timeouts, then falls back to the workspace's configured `fallback_provider` in `ai_workspace_config`. Check the `platform_ai_failover_total{from, to}` metric to confirm automatic failover is operating.

If `platform_ai_failover_total` is incrementing, automatic failover is working. No manual intervention needed for those workspaces. Monitor for quality signals (see Step 4).

### Workspaces without a fallback configured

Query for workspaces that have no fallback provider:

```sql
SELECT workspace_id, primary_provider
FROM ai_workspace_config
WHERE fallback_provider IS NULL
  AND primary_provider = '<affected_provider>';
```

These workspaces are receiving errors. They need manual failover.

---

## Step 3: Enable Manual Failover

For workspaces without an automatic fallback, set a temporary fallback via the admin API:

```bash
PATCH /api/v1/admin/workspaces/<workspace_id>/ai-config
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "fallback_provider": "openai"
}
```

This writes to `ai_workspace_config.fallback_provider`. The `GenerationService` picks up the change immediately — no restart required.

Alternatively, if you need to force all generation through the fallback (bypassing the primary entirely), set `primary_provider` to the fallback value temporarily:

```bash
PATCH /api/v1/admin/workspaces/<workspace_id>/ai-config
{
  "primary_provider": "openai",
  "fallback_provider": null
}
```

Record the original values before making this change.

---

## Step 4: Monitor Fallback Quality

Provider fallbacks may use a different model than the workspace's primary. Watch:

- `platform_ai_quality_outcome_total{stage, prompt, outcome}` — rejection rates should not spike materially versus the 7-day baseline
- `platform_ai_generation_duration_seconds{provider="openai"}` — latency changes between providers are normal; alert if > 60s

If rejection rates spike (> 2x baseline), the fallback model may not be compatible with certain prompts. See the `ai-quality-regression.md` runbook.

---

## Step 5: Communicate to Workspace Admins

If the outage lasts more than 5 minutes and workspaces are actively affected, notify workspace admins through the platform's notification channel:

**Subject:** AI generation degraded — fallback provider active

**Body:** The platform's primary AI provider ([Anthropic/OpenAI]) is experiencing an incident. Generation requests are being routed to the fallback provider. Quality and latency may differ slightly. We will restore normal routing once the primary provider recovers. No action is required on your end.

For workspaces with no configured fallback that received errors, include: "Some generation requests during [time range] may have failed. You can retry them from the artifact's history panel."

---

## Step 6: Post-Incident Steps

Once the primary provider recovers:

1. **Verify health checks pass.** The `AIProviderPort.healthCheck()` is called every 30 seconds per provider. Confirm the metric `platform_ai_provider_failures_total{provider="<affected>"}` has returned to near-zero.

2. **Restore workspace configs** that were manually overridden:

```bash
PATCH /api/v1/admin/workspaces/<workspace_id>/ai-config
{
  "primary_provider": "<original_primary>",
  "fallback_provider": "<original_fallback_or_null>"
}
```

3. **Review generation cost attribution.** During failover, `ai_usage_records.provider` reflects the actual provider used. Verify costs attributed to the fallback provider appear in dashboards correctly.

4. **Write an incident report** and check whether the affected workspaces' SLAs require compensation or formal communication.

---

## Step 7: Rollback if Fallback Causes Quality Issues

If the fallback provider is producing artifacts with high rejection rates or user complaints:

1. Identify affected prompts by querying `artifact_quality_records`:

```sql
SELECT prompt_id, prompt_version, outcome, COUNT(*)
FROM artifact_quality_records
WHERE created_at > '<failover_start_time>'
GROUP BY prompt_id, prompt_version, outcome
ORDER BY COUNT(*) DESC;
```

2. If specific prompts are degraded, disable AI generation for affected stages in the workspace:

```bash
PATCH /api/v1/admin/workspaces/<workspace_id>/ai-config
{
  "stages_disabled": ["<stage_name>"]
}
```

3. Surface this to the user as "AI generation temporarily unavailable for [stage]" rather than silently returning low-quality artifacts.

4. Re-enable once the primary provider is restored.

---

## Key Facts

- The `GenerationService` retries the primary provider **once** before attempting failover.
- Cost records (`ai_usage_records`) always reflect the actual provider used, not the configured primary.
- `platform_ai_failover_total{from, to}` tracks every failover event — use this for SLA calculations.
- Workspaces using self-hosted providers (Ollama, vLLM) are immune to public provider outages.
