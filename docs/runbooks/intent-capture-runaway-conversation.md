# Runbook: Intent Capture Runaway Conversation

**Symptom:** A single conversation is generating an abnormally high number of API calls or token usage. Workspace budget alerts fire mid-conversation. The `ai_usage_records` table shows a single `artifact_id` accumulating tokens far beyond normal.

## Immediate Response

1. Identify the runaway conversation:

   ```sql
   SELECT
     artifact_id,
     SUM(input_tokens + output_tokens) AS total_tokens,
     SUM(cost_usd) AS total_cost,
     COUNT(*) AS call_count,
     MIN(created_at) AS first_call,
     MAX(created_at) AS last_call
   FROM ai_usage_records
   WHERE created_at > NOW() - INTERVAL '1 hour'
   GROUP BY artifact_id
   ORDER BY total_tokens DESC
   LIMIT 10;
   ```

2. Check if the conversation is still active:

   ```sql
   SELECT id, status, content->>'turnCount' AS turn_count
   FROM ai_artifacts
   WHERE id = '<artifact_id>';
   ```

3. If the turn count is below 25 but costs are anomalously high, the likely cause is a tool call loop. Check the conversation messages for repeated `tool_call_start` events without corresponding `tool_call_complete`.

4. Terminate the active SSE connection (if the server still has it open) by restarting the Node.js worker serving that workspace. This is a blunt instrument — coordinate with the user first if possible.

## Root Cause Investigation

- **Tool call loop:** A tool returning unexpected output causes the orchestrator to re-call the same tool repeatedly. Check `generated_by` in the usage record for tool call counts.
- **Retried aborted requests:** Client disconnected mid-stream and retried; server-side the original request was still running. Check for duplicate `artifact_id` rows in `ai_usage_records` within seconds of each other.
- **Budget check bypass:** Verify `CostTrackingService.checkBudget()` is being called before each generation. A missing await or error swallowing could let calls through after the budget is exceeded.

## Prevention

- The 25-turn hard cap bounds the maximum calls per conversation.
- `CostTrackingService` blocks calls when the workspace budget is exceeded.
- Consider adding a per-conversation cost cap (e.g., block after $5 on a single conversation) as a secondary guard.

## Post-Incident

- Void or flag the anomalous usage records for the workspace's billing summary.
- Review the tool that caused the loop; add an output contract test.
- Add a circuit breaker: if a single artifact_id appears in >5 concurrent `ai_usage_records` within 10 seconds, reject further calls for that artifact.
