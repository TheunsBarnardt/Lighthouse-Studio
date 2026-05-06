# Runbook: AI Quality Regression

**Audience:** Platform engineers, prompt authors
**Relates to:** Objective 20, ADR-0152, ADR-0158

---

## Overview

A quality regression is when a prompt that was previously producing artifacts accepted on the first pass begins producing artifacts that are rejected or require heavy revision. This typically follows a prompt version bump, a model change, or a provider change during failover. This runbook covers detection, diagnosis, and rollback.

---

## Step 1: Detect a Quality Regression

### Via the Grafana AI dashboard

The **Quality Outcomes** panel tracks `platform_ai_quality_outcome_total{stage, prompt, outcome}`. Watch for:

- A spike in `outcome="rejected"` or `outcome="accepted_after_revisions"` on a specific `prompt` label
- A corresponding drop in `outcome="accepted_first_pass"`

Compare the last 24 hours against the 7-day baseline. A rejection rate increase of more than 15 percentage points on a single prompt warrants investigation.

### Via direct query

```sql
SELECT
  prompt_id,
  prompt_version,
  outcome,
  COUNT(*) AS count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY prompt_id, prompt_version), 1) AS pct
FROM artifact_quality_records
WHERE created_at >= NOW() - INTERVAL '48 hours'
GROUP BY prompt_id, prompt_version, outcome
ORDER BY prompt_id, prompt_version, count DESC;
```

Compare against the same query with `created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '48 hours'` to establish the baseline.

### Via the `ai.prompt.test_failed` audit event

CI emits `ai.prompt.test_failed` if the prompt's test suite regression check fails. Check the audit log:

```bash
GET /api/v1/admin/audit?event=ai.prompt.test_failed&from=<deploy_timestamp>
Authorization: Bearer <admin_token>
```

---

## Step 2: Identify the Regression Boundary

Determine when the regression started:

```sql
SELECT
  date_trunc('hour', created_at) AS hour,
  prompt_id,
  prompt_version,
  COUNT(*) FILTER (WHERE outcome = 'accepted_first_pass') AS accepted,
  COUNT(*) FILTER (WHERE outcome IN ('rejected', 'accepted_after_revisions')) AS degraded,
  ROUND(
    COUNT(*) FILTER (WHERE outcome = 'accepted_first_pass') * 100.0 / COUNT(*),
    1
  ) AS accept_rate_pct
FROM artifact_quality_records
WHERE prompt_id = '<prompt_id>'
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY hour, prompt_id, prompt_version
ORDER BY hour DESC;
```

If the regression correlates with a `prompt_version` change, that version is the likely cause. If it correlates with a timestamp but not a version change, a model update or provider failover is the likely cause.

---

## Step 3: Compare Quality by Prompt Version

If multiple prompt versions are in the data:

```sql
SELECT
  prompt_version,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE outcome = 'accepted_first_pass') AS accepted_first_pass,
  ROUND(AVG(revision_count), 2) AS avg_revisions,
  ROUND(AVG(edit_distance), 0) AS avg_edit_distance,
  ROUND(COUNT(*) FILTER (WHERE outcome = 'accepted_first_pass') * 100.0 / COUNT(*), 1) AS accept_rate_pct
FROM artifact_quality_records
WHERE prompt_id = '<prompt_id>'
GROUP BY prompt_version
ORDER BY prompt_version DESC;
```

This gives you a side-by-side quality comparison across versions.

---

## Step 4: Read Rejection Feedback

Rejected artifacts often carry user-provided feedback. Extract it:

```sql
SELECT
  r.artifact_id,
  r.prompt_version,
  r.outcome,
  r.rejected_with_feedback,
  r.revision_count
FROM artifact_quality_records r
WHERE r.prompt_id = '<prompt_id>'
  AND r.outcome = 'rejected'
  AND r.created_at >= NOW() - INTERVAL '48 hours'
ORDER BY r.created_at DESC
LIMIT 20;
```

Look for patterns in `rejected_with_feedback`. Common causes:

- The prompt now produces content that misses a required section
- Output format changed (e.g., JSON keys renamed, array became object)
- Reasoning is missing or vague (check `artifacts.reasoning` for the affected artifacts)
- The prompt is producing hallucinations specific to a new model version

---

## Step 5: Run the Prompt Test Suite Manually

Run the affected prompt's test suite locally against the current model:

```bash
pnpm test packages/core/src/ai/prompts/<stage>/<name>.prompt.ts --reporter=verbose
```

If you need to run against a live provider (not mocked):

```bash
PROMPT_TEST_LIVE=true PROMPT_ID=<prompt_id> pnpm run test:prompts
```

The test suite uses `assertions` defined in the prompt's `tests` array. A failing assertion identifies the exact output property that regressed. Fix the failing assertion or fix the prompt.

---

## Step 6: Roll Back the Prompt Version

If the current prompt version is the cause, revert the TypeScript file in source:

```bash
git log --oneline packages/core/src/ai/prompts/<stage>/<name>.prompt.ts
```

Identify the last-known-good commit, then restore:

```bash
git checkout <good_commit_sha> -- packages/core/src/ai/prompts/<stage>/<name>.prompt.ts
```

Verify the revert:

- The `version` field in the prompt file must be the previous semver
- The prompt test suite must pass: `pnpm test packages/core/src/ai/prompts/<stage>/<name>.prompt.ts`

**Bump the version appropriately after rollback.** If you reverted from `1.3.0` back to `1.2.0`, the file should now read `1.2.0`. A future fix forward must be versioned `1.3.1` or `1.4.0` — not `1.3.0` again, because records in `artifact_quality_records` with `prompt_version = '1.3.0'` already exist and their quality signals should not be confused with the fixed version.

Deploy the rollback through the normal CI pipeline. The rollback commit is a real commit — do not amend or force-push.

---

## Step 7: Monitor Recovery

After rollback is deployed:

1. Watch `platform_ai_quality_outcome_total{prompt="<prompt_id>"}` for `accepted_first_pass` rate to recover toward the pre-regression baseline.
2. Confirm no new `ai.prompt.test_failed` audit events appear.
3. Check that `artifact_quality_records.prompt_version` for new records reflects the rolled-back version.

Allow at least 2 hours of production traffic before declaring recovery, as low-volume prompts may need time to accumulate enough data.

---

## Step 8: Root Cause and Forward Fix

Determine the root cause before shipping a new version:

| Cause                                                   | Fix                                                                                            |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Prompt wording change introduced ambiguity              | Rewrite the changed section; add a golden test case for the failure pattern                    |
| Model changed behaviour (provider update)               | Add output normalization or strengthen schema validation; update golden test                   |
| Provider failover to a less capable model               | Add per-prompt `modelConfig.provider` override to pin the prompt to a specific provider        |
| Temperature too high — non-deterministic outputs        | Lower temperature; verify with determinism verification suite (`PROMPT_TEST_DETERMINISM=true`) |
| Output schema too loose — validation passing bad output | Tighten the Zod schema; add `.refine()` assertions for business rules                          |

---

## Key Facts

- `artifact_quality_records` is written when an artifact's lifecycle event fires (`approved`, `rejected`, `archived`). There is no quality record until the artifact exits the `draft` or `awaiting_approval` state.
- A prompt version bump from `x.y.z` to `x.(y+1).0` signals backward-compatible improvement. A bump to `(x+1).0.0` signals a breaking change in the prompt contract. Major bumps should be rare.
- The CI cost regression gate (`ADR-0161`) will fail if the new version consumes more than 20% additional tokens versus the declared budget. A failing cost gate is also a signal that the prompt grew unexpectedly — another quality risk indicator.
