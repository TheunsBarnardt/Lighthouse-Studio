# Test Generation Guide (Stage 8)

Stage 8 generates a complete test suite from your PRD acceptance criteria. The output is a set of TypeScript test files — unit, component, integration, and e2e — with coverage configuration and schema-aware mock factories.

## What gets generated

| Artifact | Description |
|----------|-------------|
| Test plan | AC-to-test-case mapping with coverage analysis |
| Unit tests | Vitest tests for isolated business logic |
| Component tests | Vitest + React Testing Library for UI components |
| Integration tests | Vitest tests hitting real APIs and database |
| E2E tests | Playwright tests covering full user journeys |
| Mock factories | Schema-aware typed factory functions for test data |
| Vitest config | Coverage thresholds (80% lines, 70% branches) |
| Playwright config | Browser config using `APP_URL` environment variable |

## Generation flow

### 1. Test plan

The first step maps every PRD acceptance criterion to one or more test cases. Each test case includes:
- **AC ID** — which acceptance criterion it covers
- **Test type** — unit, component, integration, or e2e
- **Given/When/Then** — the concrete scenario

ACs that cannot be automated are listed in **Uncovered ACs** with an explanation.

Review the plan and edit the PRD if any ACs are too vague to generate useful tests.

### 2. Suite generation

After approving the plan, the suite is generated. Each test case becomes a test file.

Generation is per test case in parallel. Each file is validated for TypeScript correctness after generation — files with errors trigger one automatic fix attempt.

### 3. Code review

The test review UI shows:
- **Test tree** — all files grouped by type (unit, component, integration, e2e)
- **Source viewer** — line-numbered TypeScript source with syntax highlighting
- **Reasoning tab** — why this test exists and what design decisions were made
- **Coverage panel** — live coverage metrics against thresholds

Review each test. Click **Approve** or **Regenerate** with feedback.

### 4. Running tests

Click **Run Tests** to start a test run. Select which test types to run. E2e tests require a deployment URL (from Stage 9).

Test execution is asynchronous — the UI polls for results every 5 seconds. Results show pass/fail per test with duration and error messages for failures.

## AC coverage

AC coverage is the primary quality metric: what percentage of acceptance criteria have at least one test?

- **Must-have ACs** without tests are highlighted as high-priority gaps
- The coverage panel shows `acsWithTests / totalAcs` as a percentage
- Code coverage (lines/branches) is secondary — below-threshold is a warning, not a blocker

## Mock factories

A `src/__tests__/factories.ts` file is co-generated. It provides typed factory functions for every entity in your schema:

```typescript
import { createUser, createPost } from './__tests__/factories';

const user = createUser({ email: 'specific@example.com' }); // override specific fields
const post = createPost({ authorId: user.id });
```

Factories use `@faker-js/faker` with a fixed seed for reproducible values.

## Cost

Approximate cost per project:

| Phase | Model | Est. cost |
|-------|-------|-----------|
| Test plan generation | claude-opus-4-7 | $0.50 |
| 10 unit tests | claude-opus-4-7 | $2.00 |
| 5 component tests | claude-opus-4-7 | $1.50 |
| 3 integration tests | claude-opus-4-7 | $1.50 |
| 2 e2e tests | claude-opus-4-7 | $1.00 |
| Mock factories | claude-haiku-4-5 | $0.10 |
| **Total** | | **~$6.60** |

## Troubleshooting

See runbooks:
- [Coverage below threshold](../runbooks/test-generation-coverage-below-threshold.md)
- [Flaky tests](../runbooks/test-generation-flaky-tests.md)
- [Test run stuck in running state](../runbooks/test-generation-run-stuck-running.md)
- [AC not covered](../runbooks/test-generation-ac-not-covered.md)
- [TypeScript errors in generated tests](../runbooks/test-generation-typescript-errors.md)
