# Runbook: Cascade Storm — Too Many Stages Re-Engaged

**Severity:** High
**Trigger:** A single change request causes 5+ pipeline stages to re-engage, overwhelming the pipeline queue

---

## Symptoms

- A change request's `engagedStages` list includes nearly all stages
- The pipeline queue shows many queued jobs for a single workspace
- Operators complain that a small bug fix triggered a full re-generation

---

## Diagnosis

1. Inspect the change request's affected artifact report:
   - What artifact was identified as root cause?
   - Did `affectedDownstreamDetectionPrompt` classify downstream artifacts as `affected` vs `stale`?

2. Check the artifact dependency graph for the root artifact — how many artifacts depend on it?

3. Was the root artifact something fundamental (e.g., the PRD's core requirements section)?
   If yes, the cascade may be correct behavior.

---

## Resolution

### Immediate

1. Cancel unnecessary stage executions via the pipeline queue
2. Manually narrow the `engagedStages` list on the change request to only the truly necessary stages
3. Re-engage with the reduced scope

### Investigation

1. Review the `affected-downstream-detection` prompt output — check the reasoning field for each
   artifact classified as `affected`
2. If the prompt over-classified (calling `affected` what should be `stale`), add a clarifying
   example to the prompt's system context

---

## Prevention

- Never mark root-level PRD artifacts as changed for cosmetic edits — use `stale` classification
- The `smallestPossibleRegeneration` principle (ADR-0268) is the contract; if a stage doesn't
  need its inputs re-generated, it should not appear in `engagedStages`
- Periodically review artifact dependency graph depth; overly deep graphs amplify cascade risk
