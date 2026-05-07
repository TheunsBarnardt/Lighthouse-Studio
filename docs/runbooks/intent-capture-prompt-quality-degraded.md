# Runbook: Intent Capture Prompt Quality Degraded

**Symptom:** Users report that the AI is not capturing goals/users/scope correctly, brief fields are missing despite being discussed, or the AI is asking redundant questions. Generated briefs have low completeness scores or high rates of post-generation edits.

## Immediate Response

1. Check the most recent brief quality signals in the database:

   ```sql
   SELECT
     a.id,
     a.created_at,
     a.quality_signals->>'fieldCompletenessAtGeneration' AS completeness,
     a.quality_signals->>'editsAfterGeneration' AS edits,
     a.generated_by->>'promptVersion' AS prompt_version
   FROM ai_artifacts a
   WHERE a.stage = 'intent_capture'
     AND a.type = 'intent_brief'
     AND a.workspace_id = '<workspace_id>'
   ORDER BY a.created_at DESC
   LIMIT 20;
   ```

2. Identify which prompt version is in use:

   - `generated_by->>'promptId'` will show `intent-capture/orchestrator` or `intent-capture/finalize-brief`
   - `generated_by->>'promptVersion'` will show the semver used at generation time

3. Check the audit log for `ai.intent_capture.brief_generated` events with low completeness:
   ```sql
   SELECT payload FROM audit_records
   WHERE event_type = 'ai.intent_capture.brief_generated'
   ORDER BY created_at DESC LIMIT 10;
   ```

## Root Cause Investigation

- **Model degradation:** The underlying model (claude-opus-4-7) may have had a silent update. Compare output quality before and after a known model update date.
- **Prompt regression:** Check `git log packages/core/src/ai/prompts/intent-capture/` for recent changes.
- **Context window truncation:** If conversations are hitting the 25-turn limit, summarization may be losing important context. Check `get-conversation-summary` tool logs.
- **Temperature drift:** Verify prompt configs still have `temperature: 0.2` for extraction prompts.

## Resolution

- If prompt regression: `git revert` the relevant prompt commit and deploy.
- If model change: pin the model version in the affected prompt's `modelConfig` until quality is verified.
- If context loss: lower the summary threshold from 15 turns to 10 turns to preserve more recent context.

## Post-Incident

- Add a failing golden test that covers the degraded case.
- Update the `tests` array in the affected prompt file.
- Consider adding a weekly quality score alert (mean completeness at generation < 0.6 triggers an alert).
