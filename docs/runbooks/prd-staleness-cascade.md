# Runbook: PRD Staleness Cascade

## Symptoms

- A large number of PRD sections across many workspaces are marked stale simultaneously.
- Users report that "all their PRD sections went stale at once" after a minor intent brief change.
- The `ai.prd.staleness_detected` audit event appears at unusually high volume.
- Support tickets increase from users confused about why approved sections now require re-review.

## Likely Causes

1. **High-traffic intent brief updated** — a template or commonly-cloned intent brief used across many workspaces was updated; all derived PRDs now show staleness indicators.
2. **Staleness detection prompt over-sensitivity** — a change to `staleness-detection.prompt.ts` caused it to mark more sections as affected than the actual intent change warrants.
3. **Section dependency graph change** — a change to `section-dependencies.ts` declared new upstream dependencies, causing sections that were previously unaffected by intent changes to now be flagged.
4. **Platform-level intent brief template update** — the platform updated a built-in intent brief template used as a starting point, and the update propagated to all workspaces that adopted it.
5. **Bug in staleness detection** — a code defect is triggering staleness detection for all PRDs rather than only those derived from the modified intent brief.

## Impact

- Users must re-review sections they have already approved, even sections that were not substantively affected.
- If many workspaces are affected, downstream stages (Design Tokens, Schema) may be blocked waiting for PRD re-approval.
- User trust in the platform's incremental update model is at risk if non-affected sections are incorrectly marked stale.

## Investigation Steps

1. **Determine scope** — how many workspaces and PRDs are affected?

```bash
# Count PRDs with staleness indicators in the last hour
SELECT
  COUNT(DISTINCT prd_id) AS stale_prds,
  COUNT(DISTINCT workspace_id) AS affected_workspaces
FROM staleness_indicators
WHERE created_at >= NOW() - INTERVAL '1 hour';
```

2. **Identify the trigger** — which intent brief(s) were modified in the window before the cascade began? Check `ai.prd.staleness_detected` audit events for the `intentBriefId` values.

3. **Check whether the cascade is from a single intent brief** — if a high-traffic intent brief was updated (e.g., a template used by many workspaces), the cascade is expected behaviour, not a bug.

4. **If from a single intent brief:** Review what changed in that brief. Is the staleness detection correctly identifying dependent sections, or is it marking all 10 sections when only 2 should be affected?

5. **Check the staleness detection prompt** — review recent changes to `staleness-detection.prompt.ts`. Did a change alter its scope of detection?

6. **If a code defect is suspected** — check whether the `intentBriefId` on the stale indicators matches the actually-modified intent brief. If PRDs with no connection to the modified brief are showing staleness, there is a bug in the detection trigger logic.

## Resolution

1. **If a high-traffic intent brief caused expected staleness:** No code fix needed. Communicate to affected users:

   - What changed in the intent brief
   - Which sections are affected and why
   - Offer prioritised support for workspaces that were near PRD approval completion

2. **If the staleness detection prompt is over-sensitive:** Roll back the prompt to the previous version. Investigate the change that increased sensitivity before re-introducing it. Add test cases for the over-flagged patterns.

3. **If the dependency graph change caused the cascade:** Review whether the new dependency declarations are correct. If they are correct but introduced unexpected cascades, document the impact in the ADR for the change. If they were incorrect, revert the change.

4. **If a code defect caused cross-intent staleness:** Roll back the deployment that introduced the defect. Issue a targeted fix that corrects the staleness indicators (either by deleting false staleness records or by re-running correct detection).

5. **For users with many affected sections:** Consider offering a "batch regenerate affected sections" workflow that queues regeneration across all affected sections without requiring per-section manual triggers.

## Prevention

- Staleness detection prompt test suite should include test cases where minor intent changes affect only a subset of sections.
- Monitor the `ai.prd.staleness_detected` event rate with an alert when it exceeds 3x baseline over a 15-minute window.
- Before updating widely-used intent brief templates, assess the downstream staleness impact and communicate to users in advance.
