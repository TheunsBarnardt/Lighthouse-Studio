# Runbook: PRD Section Quality Degraded

## Symptoms

- A specific section type's first-pass approval rate drops below 70% over a rolling 7-day window.
- The quality signal dashboard shows `sectionsRejectedAtLeastOnce` trending upward for a specific `sectionType`.
- Users report that a particular PRD section "feels generic" or "doesn't reflect the intent brief" in support channels or session feedback.
- The `totalSectionRevisions` metric for a specific section type increases without a corresponding increase in PRD volume.

## Likely Causes

1. **Prompt version regression** — a recent prompt update for the affected section introduced a change that degraded output quality.
2. **Intent brief format drift** — the intent capture stage (Objective 21) changed its output structure; the PRD section prompt no longer reads the relevant fields correctly.
3. **Template bias** — a recently added or modified PRD template is providing starter hints that conflict with actual intent content, causing the AI to prioritise template content over intent.
4. **Provider model update** — the underlying AI provider updated their model; the section prompt relied on behaviour that no longer holds.
5. **Edge case volume increase** — a specific type of project (e.g., hardware products, highly regulated industries) is being submitted at higher rates; the prompt was not tested against these inputs.

## Investigation Steps

```bash
# Check per-section quality signals over the last 7 days
# (query the platform's quality_signals table or dashboard)
SELECT
  section_type,
  COUNT(*) AS total,
  SUM(CASE WHEN accepted_first_pass THEN 1 ELSE 0 END) AS first_pass_approvals,
  AVG(revision_count) AS avg_revisions
FROM prd_section_quality_signals
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY section_type
ORDER BY first_pass_approvals / total ASC;
```

1. **Identify which section type** is below the 70% threshold using the query above or the quality dashboard.

2. **Review rejected sections for patterns** — look at the 10–20 most recently rejected sections of that type. Are they failing for the same reason? Common patterns:

   - Missing required content (e.g., acceptance criteria without Given/When/Then)
   - Content that doesn't reference the intent brief (generic language, template boilerplate)
   - Structurally malformed content (schema validation errors in user edits)
   - A specific subsection (e.g., only `tracesTo` fields) consistently missing

3. **Compare the current prompt version with the previous version** — check git history for `packages/core/src/services/ai/prd-generation/prompts/<section>.prompt.ts`. Was the prompt changed recently? What did the change alter?

4. **Run the section's test suite in isolation** against the failing inputs:

   ```bash
   pnpm test packages/core --filter='<section>.prompt.test'
   ```

5. **Check for intent brief format changes** — review recent commits to `packages/core/src/services/ai/intent-capture/` for output schema changes. If the intent brief's field names changed, the PRD section prompt may be referencing stale field paths.

6. **Check provider model version** — review the provider configuration for recent model changes that weren't announced as breaking but may have altered generation behaviour.

## Resolution

1. **If the prompt was recently changed:** Roll back the prompt version and redeploy. Investigate the change that caused the regression before re-introducing it.

2. **If intent brief field paths changed:** Update the PRD section prompt to reference the new field names. Add a test case that uses the new intent brief format.

3. **If edge cases are exposing gaps:** Add new test cases to the section's test suite using the failing intent types as golden inputs. Update the prompt with explicit instructions for the edge case.

4. **If a provider model update is the cause:** Add a regression test that covers the prompt's critical behaviour, and adjust the prompt to be more explicit about the expected output structure.

5. **After fixing:** Monitor the first-pass approval rate for 48 hours. If it returns above 70%, close the incident. If it remains below threshold, escalate to a deeper prompt review.

## Prevention

- The section prompt test suites run in CI on every commit. Ensure test coverage includes diverse intent brief types.
- Quality signal dashboards should alert when a 7-day rolling first-pass rate drops below 70% for any section type.
- Prompt changes should include a comparison of before/after test suite pass rates before merging.
