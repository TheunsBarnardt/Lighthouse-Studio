# Runbook: Intent Capture — Brief Not Generating from Conversation

**Symptom:** A user has had several conversation turns but the Brief Preview panel remains empty or only partially populated. The AI is responding in the conversation but the structured brief is not updating.

---

## 1. Verify Turn Count Threshold

Brief generation is triggered only after a minimum number of conversation turns have provided enough context (default: 3 user turns). If the user has only sent 1-2 messages, the brief preview will not yet populate — this is expected.

Check the current turn count:

```sql
SELECT id, content->>'turnCount' AS turn_count, updated_at
FROM ai_artifacts
WHERE workspace_id = '<workspace_id>'
  AND type = 'conversation'
  AND id = '<conversation_id>';
```

If `turn_count < 3`, advise the user to continue the conversation. The brief will begin generating after the third turn.

---

## 2. Check for Brief Generation Errors

Brief generation runs as a background step after each turn completes (once the turn threshold is met). Check the observability dashboard or application logs for errors in the brief generation pipeline:

```bash
# Search logs for brief generation errors for this conversation
grep '"stage":"intent_capture.brief_generation"' /var/log/platform/worker.log \
  | grep '"conversationId":"<conversation_id>"' \
  | tail -50
```

In the Grafana dashboard, navigate to **AI Pipeline → Intent Capture → Brief Generation**. Filter by `conversation_id`. Look for:

- `ai_pipeline.intent_capture.brief_generation` error events
- Failed `generateBrief` spans
- Zod validation errors (structured output parse failures)

---

## 3. Check for Structured Output Parse Errors

If the AI model returns a response that does not match the expected brief output schema, the Zod validator will reject it and brief generation will silently fail (the conversation continues but the brief doesn't update).

Check logs for parse errors:

```bash
grep '"type":"ZodError"' /var/log/platform/worker.log \
  | grep '"conversationId":"<conversation_id>"' \
  | tail -20
```

If Zod errors are present, the likely causes are:
- The AI model produced malformed JSON (missing required fields, wrong types).
- The `outputSchema` in the brief generation prompt was recently changed in a breaking way without testing.
- The model returned a valid response but the post-processing step mangled it.

**Resolution:** Check the brief generation prompt version in `packages/core/src/ai/prompts/intent-capture/generate-brief.ts`. If the schema was recently changed, verify the new schema is backward-compatible with the model's typical output. Run the prompt test suite:

```bash
pnpm test packages/core --reporter=verbose -t "generate-brief"
```

---

## 4. Manually Trigger Brief Generation

The UI provides a **"Generate brief now"** button that bypasses the turn threshold and triggers brief generation immediately. This is useful when:

- The user has provided enough information but the auto-trigger hasn't fired.
- There was a transient error in a previous generation attempt.
- You want to test whether the current conversation state can produce a brief.

If the button is not visible in the UI, it can be triggered via the API:

```bash
curl -X POST https://<platform-host>/api/v1/ai/intent-capture/conversations/<conversation_id>/generate-brief \
  -H "Authorization: Bearer <user_token>"
```

Monitor the response. If it returns an error, check the error body for the specific failure reason.

---

## 5. Check AI Provider Response

If brief generation is failing at the provider call, the AI provider may be returning an error or an unexpected response format:

```sql
-- Check recent usage records for the brief generation prompt
SELECT id, prompt_name, prompt_version, provider,
       input_tokens, output_tokens, error_message, recorded_at
FROM ai_usage_records
WHERE workspace_id = '<workspace_id>'
  AND prompt_name = 'intent_capture.generate_brief'
  AND recorded_at > NOW() - INTERVAL '1 hour'
ORDER BY recorded_at DESC
LIMIT 10;
```

If `error_message` is populated, the provider call failed. Common causes:
- Provider rate limit: check `platform ai health` for rate limit status.
- Context window exceeded: if the conversation is very long, the combined system prompt + conversation history may exceed the model's context window. The orchestrator should handle this via summarisation, but if summarisation itself failed, brief generation will error.
- Provider outage: check the provider's status page.

---

## 6. Verify Brief Artifact State

Check whether the brief artifact exists and has content:

```sql
SELECT id, type, content, updated_at
FROM ai_artifacts
WHERE workspace_id = '<workspace_id>'
  AND metadata->>'conversationId' = '<conversation_id>'
  AND type = 'brief';
```

- If no row exists: brief generation has not run successfully yet (generation creates this row).
- If a row exists with empty or null `content`: the generation ran but returned an empty result. This is likely a prompt or schema issue (step 3).
- If a row exists with content: the brief was generated but the UI is not displaying it. This is a client-side issue — instruct the user to hard-reload the page.

---

## 7. Hard Reload as Final Mitigation

If the brief exists in the database but the UI isn't showing it, the Brief Preview panel may have a stale React Query cache or a rendering error. Instruct the user to:

1. Hard-reload the page: `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac).
2. Navigate back to the conversation.
3. Verify the brief preview now shows content.

---

## Prevention

- Run the brief generation prompt test suite in CI to catch schema or output format regressions before they reach production.
- Add an alert on `ai_pipeline.intent_capture.brief_generation` error rate > 5% over 5 minutes.
- Monitor `ai_artifacts WHERE type = 'brief' AND content IS NULL AND created_at < NOW() - INTERVAL '10 minutes'` — these are stale generation failures that should be retried or flagged.
