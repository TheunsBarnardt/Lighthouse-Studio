# Runbook: Intent Capture — Workspace AI Budget Exceeded

**Symptom:** A user reports that their Intent Capture conversation has paused and shows the message: "Your workspace has reached its monthly AI usage limit. Conversations are paused until the budget is increased or the monthly period resets."

Or: a workspace admin reports unexpectedly high AI costs attributed to Intent Capture.

---

## 1. Confirm the Budget State

Check the workspace's current usage and limit:

```sql
SELECT w.id, w.name,
       b.monthly_token_budget_usd,
       b.current_period_spend_usd,
       b.period_reset_at
FROM workspaces w
JOIN workspace_ai_budgets b ON b.workspace_id = w.id
WHERE w.id = '<workspace_id>';
```

If `current_period_spend_usd >= monthly_token_budget_usd`, the budget is exhausted and all AI operations for the workspace are paused.

`period_reset_at` shows when the budget resets automatically (typically the 1st of the next calendar month, or 30 days from the workspace's creation date, depending on your billing configuration).

---

## 2. Identify High-Cost Conversations

Find the conversations responsible for the highest token usage in the current period:

```sql
SELECT a.id AS artifact_id,
       a.metadata->>'conversationName' AS conversation_name,
       a.created_by_user_id,
       SUM(u.total_tokens) AS total_tokens,
       SUM(u.estimated_cost_usd) AS estimated_cost_usd
FROM ai_usage_records u
JOIN ai_artifacts a ON a.id = u.artifact_id
WHERE u.workspace_id = '<workspace_id>'
  AND u.recorded_at >= '<period_start>'
GROUP BY a.id, a.metadata->>'conversationName', a.created_by_user_id
ORDER BY estimated_cost_usd DESC
LIMIT 20;
```

Check for anomalies:
- Conversations with unusually high token counts (> 50,000 tokens for a single conversation is a warning sign for Intent Capture).
- Conversations with many more turns than expected (the 25-turn limit should cap this; if a conversation exceeds 25 turns, the limit may not be enforced).
- A single user consuming a disproportionate share of the budget.

---

## 3. Check for Runaway Conversations

If a conversation has very high token counts, it may have been running without the bounded turn limit. Verify:

```sql
SELECT id,
       content->>'turnCount' AS turn_count,
       metadata->>'totalInputTokens' AS input_tokens,
       metadata->>'totalOutputTokens' AS output_tokens
FROM ai_artifacts
WHERE workspace_id = '<workspace_id>'
  AND type = 'conversation'
  AND CAST(content->>'turnCount' AS integer) > 25
ORDER BY metadata->>'totalInputTokens' DESC;
```

If conversations exceed 25 turns, the bounded conversation limit (ADR-0250) is not being enforced. This is a bug — open a ticket and check the `IntentCaptureService.sendMessage()` implementation for the turn count guard.

Also check the **Intent Capture — Runaway Conversation** runbook for the operational response.

---

## 4. Increase the Workspace Budget

This is an installation admin action. Navigate to:

**Admin Console → Workspaces → [workspace name] → AI Usage → Edit Budget**

Or via the admin API:

```bash
curl -X PATCH https://<platform-host>/api/v1/admin/workspaces/<workspace_id>/ai-budget \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"monthlyBudgetUsd": 100}'
```

Once the budget is increased, in-flight conversation requests that were paused will resume automatically on the user's next message.

**Note:** Before increasing, verify the high spend is legitimate. If the spend was caused by a bug or runaway conversation, fix the root cause before simply increasing the limit.

---

## 5. Allocate Per-Stage Budget Limits

If the workspace's overall budget is sufficient but Intent Capture is consuming too much of it, configure per-stage budget caps:

**Admin Console → Workspaces → [workspace name] → AI Usage → Stage Allocations**

Stage allocations split the monthly budget by pipeline stage. For example:
- Intent Capture: 20% (usually cheap; 25 turns × small prompts)
- PRD Generation: 30%
- Technical Spec: 30%
- Code Generation: 20%

With stage allocations set, Intent Capture pauses when its allocation is exhausted even if the overall budget has headroom. This prevents one stage from starving others.

---

## 6. Advise Users on Cost Management

For users who are concerned about conversation cost:

- **Keep conversations focused.** Long, exploratory conversations with many tangents use more tokens than focused, goal-oriented conversations.
- **Use templates.** Starting from a template pre-populates sections of the brief, reducing the number of turns needed.
- **Edit the brief directly.** For structured changes (fixing a section, adding a constraint), editing the brief directly is free compared to asking the AI to update it.
- **The cost indicator** in the conversation UI shows running cost. Encourage users to monitor it.

---

## Prevention

- Set meaningful monthly AI budgets per workspace based on expected usage. A default of $10/month for small workspaces is a safe starting point.
- Configure per-stage allocations to prevent any single stage from consuming the entire budget.
- Set up an alert when workspace AI spend exceeds 80% of the monthly budget: this gives time to act before conversations pause.
- Review `ai_usage_records` weekly for anomalous cost patterns.
