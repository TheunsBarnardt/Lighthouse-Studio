# Runbook: Tests Failing During Deployment

## Symptoms

- Deployment blocked at `tests` step
- Audit event `ai.deployment.tests_failed` emitted
- Promotion to staging or prod is blocked

## Steps

1. View the test failure details in the deployment monitor UI. The tests step shows which test files failed and the error messages.

2. Identify the failure type:
   - **Unit tests**: business logic regression; check recent code changes
   - **Component tests**: UI regression; check recent component changes
   - **Integration tests**: API or database issue; check if the target environment's database is accessible
   - **E2E tests**: full user journey failure; requires a running deployment URL

3. For integration test failures in a deployment environment:
   - Verify the test database URL is set correctly in the environment configuration
   - Check if the database was migrated before tests ran
   - Confirm the test database is seeded correctly

4. For E2E test failures:
   - The deployment URL must be the same environment being tested
   - Check the Playwright config's `baseURL` matches the deployment URL

5. After identifying the root cause:
   - Fix the underlying issue (update the failing test or fix the application code)
   - Re-generate the test file if needed (Stage 8)
   - Re-trigger the deployment

6. **Emergency bypass** (use with caution):
   If you must deploy despite test failures (e.g., a critical security fix), you can disable tests for a single environment:
   ```
   PATCH /api/deployment/plans/<planId>/environments/staging
   { "testsRequired": false, "_adminOverride": true, "_reason": "Emergency security patch" }
   ```
   This requires the admin override token and is audited.

## Prevention

- Run tests locally before initiating a deployment
- Use the Stage 8 test runner to execute tests on demand without starting a full deployment
