# Runbook: Intent Capture Conversation Stuck

**Symptom:** The user's conversation shows "thinking…" indefinitely. The UI does not receive a `turn_complete` event. The SSE stream appears open but no data is flowing.

## Immediate Response

1. Check the conversation artifact's current state:

   ```sql
   SELECT id, status, content->>'turnCount' AS turn_count,
          updated_at, created_at
   FROM ai_artifacts
   WHERE id = '<conversation_id>';
   ```

2. Check the server logs for the SSE handler:

   - Look for `POST /api/v1/ai/intent-capture/conversations/<id>/messages`
   - Check for exceptions in the `generateStream` call
   - Check if the `AbortController` fired (client disconnect before stream completion)

3. Check the AI provider API status:

   - Anthropic status page: https://status.anthropic.com
   - Check `ai_usage_records` — if there's no record for this call, the API request may not have started.

4. If the user is blocked, advise them to:
   - Reload the page — the conversation will resume from the last saved state.
   - The `turn_complete` event is required for the server to save the AI response; if it never fired, the AI message will not appear in the conversation history after reload.

## Root Cause Investigation

- **Provider timeout:** Anthropic's API has a 10-minute timeout for streaming requests. Very long messages or complex tool call chains can approach this limit. Check request duration in the logs.
- **Node.js event loop blockage:** A synchronous operation (e.g., large JSON parse) in the SSE handler can block the stream. Profile the handler if this is recurring.
- **Database write blocking the stream:** The `autosaveConversation` call inside `sendMessage` runs after each turn. If the database is slow (lock contention, slow disk), this delays the stream being closed. Check for slow queries during the incident window.

## Resolution

- If provider timeout: reduce the orchestrator prompt's token budget (lower `maxTokens` in the prompt config).
- If the stream never started (no `ai_usage_records` row): check for Zod validation failures on the request body (logs will show `ZodError`).
- If repeated occurrences: add a server-side 5-minute per-request timeout to the SSE handler to auto-close stuck streams.

## Post-Incident

- Verify the conversation artifact was not left in an inconsistent state (messages array with a dangling user message and no assistant response). If so, pop the last user message to restore consistency.
- Consider adding a dead-letter mechanism: if a stream closes without `turn_complete`, emit a synthetic `error` event and clean up.
