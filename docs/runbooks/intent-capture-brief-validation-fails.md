# Runbook: Intent Capture Brief Validation Fails

**Symptom:** The "Generate Brief" action fails with a validation error. Users see "Failed to generate brief" in the UI. The `ai.intent_capture.brief_generated` audit event does not appear.

## Immediate Response

1. Check the application logs for Zod validation errors:

   - Look for `ZodError` in the `generateBrief` service method
   - The error will list which fields failed: e.g., `goals[0].priority: Invalid enum value`

2. Check what the AI actually returned:

   ```sql
   SELECT
     a.id,
     a.generated_by->>'promptId' AS prompt_id,
     a.generated_by->>'promptVersion' AS prompt_version,
     a.content
   FROM ai_artifacts a
   WHERE a.stage = 'intent_capture'
     AND a.type = 'intent_brief'
     AND a.status = 'draft'
     AND a.workspace_id = '<workspace_id>'
   ORDER BY a.created_at DESC
   LIMIT 5;
   ```

   Note: if the artifact was never created (Zod failure before insert), look in the application error logs directly.

3. Identify the failing conversation to understand what inputs caused the bad output:
   - Find the parent conversation artifact via `parent_artifact_ids` on the failed brief.
   - Review the conversation messages for edge cases (unusual product types, non-English input, very long goal descriptions).

## Root Cause Investigation

- **Schema mismatch:** The `finalize-brief` prompt's output schema diverged from `IntentBriefSchema`. This happens if the prompt was updated without updating the Zod schema (or vice versa). Compare `finalize-brief.prompt.ts`'s output schema with `types.ts`.
- **Enum value out of range:** The AI may return a valid-looking but non-matching enum value (e.g., `"nice_to_have"` vs `"nice_to_have"` — check for whitespace or casing). Add enum normalization (`.toLowerCase().trim()`) in the prompt output schema if this is recurring.
- **Empty array fields:** If the conversation is very short, some array fields (goals, targetUsers) may be empty. The schema should allow empty arrays — verify `z.array(...).min(0)` not `z.array(...).min(1)`.
- **Unicode/encoding issues:** Non-ASCII content in goal descriptions can cause JSON parsing issues in some contexts. Check the raw AI response bytes in logs.

## Resolution

- **Immediate:** If one user is blocked, delete the failed `draft` artifact (if any) and ask them to retry "Generate Brief."
- **If systematic:** Roll back the offending prompt change or update the Zod schema to accept the new shape.
- **Add defensive parsing:** Add `.transform()` or `.catch()` to fragile fields in the output schema to coerce common variations.

## Post-Incident

- Add a golden test in `finalize-brief.prompt.test.ts` with the failing conversation as input.
- Review all `z.enum()` fields in `IntentBriefSchema` for missing variants.
- Consider adding a "soft validation" path: if brief validation fails, return the raw AI response as a `raw_brief` draft that the user can manually correct, rather than showing a hard error.
