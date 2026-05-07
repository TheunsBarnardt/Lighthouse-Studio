# Runbook: PRD Consistency Storm

## Symptoms

- The `consistencyIssuesFound` quality signal spikes across many PRDs simultaneously.
- The consistency check is finding issues in more than 30% of generated PRDs over a 24-hour window.
- Users across multiple workspaces report being shown consistency warnings on PRDs that appear internally coherent.
- The consistency check response time increases significantly (indicating the prompt is receiving large inputs it struggles to process).

## Likely Causes

1. **One section prompt generating systematically conflicting content** — a change to a frequently-cited section (e.g., `functional_requirements` or `non_functional_requirements`) introduced content that reliably conflicts with another section.
2. **Consistency check prompt regression** — a change to `consistency-check.prompt.ts` made it overly sensitive, producing false positives for constructs that are not genuine contradictions.
3. **Orchestrator ordering change** — a change to section dependency ordering caused sections to generate without receiving outputs they depend on, producing content with gaps that appear contradictory.
4. **Provider model update** — a model update changed how the consistency check prompt interprets tension between sections, producing warnings where none are warranted.
5. **Specific intent type exposure** — a new common intent type (e.g., multi-tenant SaaS, hardware product) is being submitted at high volume and the prompts were not tested against it; inherent tensions in these intent types trigger false positives.

## Investigation Steps

```bash
# Check the consistency issue rate over the last 24 hours
SELECT
  DATE_TRUNC('hour', created_at) AS hour,
  COUNT(*) AS prds_generated,
  SUM(CASE WHEN consistency_issues_found > 0 THEN 1 ELSE 0 END) AS prds_with_issues,
  AVG(consistency_issues_found) AS avg_issues_per_prd
FROM prd_quality_signals
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour;
```

1. **Determine when the storm started** — use the hourly query above to identify the approximate start time. Correlate with recent deployments.

2. **Sample 10–15 affected PRDs** — read the consistency reports. Are the flagged contradictions genuine (real conflicts in the content) or false positives (the consistency check is overly aggressive)?

3. **If genuine contradictions:**

   - Identify which section pairs are most frequently mentioned together in consistency issues (e.g., `functional_requirements` and `out_of_scope`).
   - Review recent changes to those section prompts. Did a change cause one section to generate content that conflicts with another by design?
   - Check the section dependency graph (`section-dependencies.ts`) — are the affected sections correctly declared as dependencies of each other?

4. **If false positives:**

   - Review recent changes to `consistency-check.prompt.ts`.
   - Run the consistency check prompt's test suite in isolation:
     ```bash
     pnpm test packages/core --filter='consistency-check.prompt.test'
     ```
   - Check whether the false positives share a common pattern (e.g., all flag "performance NFR vs. real-time FR" as contradictory even when they are compatible).

5. **Check the orchestrator** — review recent changes to `orchestrator.prompt.ts` and `section-dependencies.ts` for ordering changes that could cause sections to generate with missing inputs.

## Resolution

1. **If a section prompt change caused genuine contradictions:** Identify the conflicting instructions introduced in the change. Either revert the change or update the section prompt to align with the sections it feeds into. Add a test case pairing the affected sections.

2. **If the consistency check is producing false positives:** Update `consistency-check.prompt.ts` to distinguish the false-positive pattern from genuine contradictions. Add the pattern as a test case with the expected result (no issue). Redeploy.

3. **If the orchestrator ordering changed:** Restore the correct dependency ordering. Run the full orchestrator test suite before redeploying.

4. **For immediate mitigation** while investigation is ongoing: the consistency check produces warnings, not generation failures. Users are not blocked; they can dismiss warnings. Consider temporarily reducing the consistency check's sensitivity via a prompt parameter if false positives are causing significant user friction.

5. **After resolution:** Monitor the consistency issue rate for 48 hours. Alert threshold should return below 15% of PRDs (some consistency issues are normal and expected).

## Prevention

- The consistency check prompt test suite should include known-contradictory and known-consistent PRD pairs as golden inputs.
- Changes to any section prompt should include a consistency regression run: generate a sample of PRDs with the new prompt and check the consistency issue rate against baseline.
- Monitor the `consistencyIssuesFound` metric on the quality dashboard with an alert at > 30% over any 1-hour window.
