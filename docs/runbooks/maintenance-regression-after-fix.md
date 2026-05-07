# Runbook: Regression Detected After Fix

**Severity:** High
**Trigger:** Outcome assessment flags `regressionDetected: true` on a resolved change request

---

## Symptoms

- A resolved change request shows a `Regression` badge in the Outcomes tab
- New signals matching the original issue appear after the fix was deployed
- A new change request was auto-created from the regression signal

---

## Diagnosis

1. Open the outcome record and review the `metrics` array — which metric degraded?
2. Compare the before/after signal rates for the original signal type
3. Check whether the regression is in the same component or a different one:
   - **Same component:** the fix introduced a new bug in the same code path
   - **Different component:** the fix had unexpected side effects

---

## Resolution

1. Open the auto-created regression change request (linked from the outcome record)
2. Review the signals that triggered it — look at the error messages and affected stages
3. If the regression is in code generation output:
   - Re-engage `code_generation` stage with the original change request's context plus the regression context
   - Explicitly include "do not break X" in the regeneration instructions
4. If the regression is in test coverage:
   - The fix passed tests but tests didn't cover the regressed path
   - Re-engage `test_generation` first; add a test for the regressed behavior before re-running code_generation

---

## Prevention

- Set outcome assessment window to 3 days (not 7) for high-severity change requests
- After re-engaging stages, always re-run the full test suite before deployment (Objective 28)
- Review test coverage for the affected component before marking a change request resolved
