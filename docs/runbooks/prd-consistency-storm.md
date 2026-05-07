# Runbook: PRD Consistency Storm

**Trigger:** Many PRDs across workspaces are hitting consistency issues after generation — the `ai.prd.consistency_issue_detected` event rate spikes.

---

## Symptoms

- `ai.prd.consistency_issue_detected` events spike in the observability dashboard
- Users report that the "Run Checks" button always shows warnings
- Consistency issues are clustered around specific section pairs (e.g. scope vs anti-patterns)

## Investigation

1. Pull recent `ai.prd.consistency_issue_detected` events; group by `sections` field to identify which section pairs are conflicting
2. Check if the spike coincides with a prompt deployment
3. Sample 5-10 consistency issue descriptions — identify whether there is a common pattern
4. Check whether the issues are true contradictions or the consistency-check prompt is over-reporting

## Common causes

- A section prompt changed in a way that causes it to generate content that conflicts with another section's output
- The consistency-check prompt threshold changed (now reports warnings it previously ignored)
- A new template was deployed whose section starters pull in contradictory assumptions

## Resolution

1. If caused by a prompt change: roll back the offending prompt version
2. If the consistency-check prompt is over-reporting: tighten its system prompt rules to require stronger evidence of contradiction before reporting
3. If caused by a new template: review the template's section starters for contradictions and remove them

## Escalation

If the root cause is unclear, sample 3 PRDs with issues and manually trace the contradiction. Bring findings to the AI pipeline weekly review.
