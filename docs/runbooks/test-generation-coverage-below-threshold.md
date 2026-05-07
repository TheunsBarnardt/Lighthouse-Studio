# Runbook: Coverage Below Threshold

## Symptoms

- Test run completes but coverage panel shows red bars
- Audit event `ai.test_generation.coverage_below_threshold` emitted
- Warning banner visible in the test generation UI

## Steps

1. Identify which metric is below threshold (lines, branches, functions, statements) in the coverage panel.

2. Check which files have low coverage:
   ```
   GET /api/test-generation/runs/<runId>
   ```
   Look at `coverageReport.perFile` for files with low coverage values.

3. For low branch coverage: the AI may have missed edge cases. Regenerate specific test files with feedback:
   - Open the test file in the test tree
   - Click **Regenerate** and provide feedback: "Add tests for the null input case and the error path"

4. For low line coverage: there may be unreachable code paths in the generated application. Verify whether the code paths are legitimate by reviewing the generated function source.

5. If the low coverage is from dead code scaffolding (future extension points), it can be accepted as a warning — this is expected for AI-generated projects in early stages.

6. Adjust thresholds if the defaults are inappropriate for this project:
   ```
   PATCH /api/test-generation/suites/<id>/config
   { "coverageThresholds": { "lines": 70, "branches": 60 } }
   ```

## Prevention

- Review the AC-to-test mapping before generating the suite to ensure edge cases are captured
- Use the coverage analysis prompt via **Analyse Gaps** in the coverage panel
