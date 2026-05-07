# Runbook: Outcome Not Improving After Repeated Fixes

**Severity:** High
**Trigger:** The same signal type keeps recurring despite multiple resolved change requests

---

## Symptoms

- Three or more change requests for the same symptom have been resolved and regressed
- The outcome assessment consistently shows no improvement in the target metric
- Operators are losing confidence in the maintenance cycle

---

## Diagnosis

1. Review the full history of change requests for this signal type — look at `rootSignalIds`
   to trace the lineage
2. Check whether the fixes addressed the root cause or only the symptom:
   - Did each fix engage the correct pipeline stage?
   - Was the generated code reviewed for structural issues, or only the immediate bug?
3. Look at the artifact dependency graph — is the root cause in an upstream artifact
   (e.g., a PRD requirement or architecture decision) that hasn't been regenerated?

---

## Resolution

### Root cause upstream

If the root cause is in a PRD, architecture, or design artifact:
1. Create a change request that explicitly targets the upstream artifact's stage
2. Do not just re-run `code_generation` — fix the requirement or design first
3. Cascade downstream from the fixed upstream artifact

### Generated code has structural issues

If the generated code keeps producing the same class of bug:
1. Add the anti-pattern explicitly to the code generation prompt's negative examples
2. File a prompt improvement issue with examples from the failing generation
3. Consider adding a static analysis rule to catch the pattern before deployment

### Environmental issue

If metrics don't improve despite correct-looking fixes:
1. Check whether the metrics source has a lag (e.g., aggregation window)
2. Verify the outcome assessment baseline is measuring the right metric
3. Check whether the signal is actually from the fixed component or a different one
   with similar symptoms

---

## Prevention

- When creating a change request, always include the root signal's full context (stack trace, URL,
  user ID if available) — not just the error message
- After resolving a recurring issue, add a regression test explicitly for it (Objective 28)
- Review the outcome assessment's `summary` field for clues about why improvement is absent
