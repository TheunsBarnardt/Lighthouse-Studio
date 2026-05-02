# Objective 28: Stage 8 — Test Generation

**Status:** Ready for development
**Prerequisites:** Objectives 20 (AI Pipeline Foundation), 22 (Stage 2: PRD), 24 (Stage 4: Schema), 26 (Stage 6: UI Generation), 27 (Stage 7: Code Generation) complete
**Blocks:** Objective 29 (Stage 9: Deployment — production deploys require tests passing)

---

## 1. Purpose

The AI has generated a schema, a UI, and server-side functions. Now: **does any of it actually work?** Test generation is the stage that verifies the AI's output is correct, before the customer deploys to production and discovers the answer the hard way.

This stage produces a complete test suite covering the generated application:
- **Unit tests** for server functions (Stage 7)
- **Component tests** for UI components (Stage 6)
- **Integration tests** for SDK usage and data flow
- **End-to-end tests** for user workflows from the PRD's user stories

The acceptance criteria from Stage 2's PRD are the source of truth. Every "Given/When/Then" in the PRD becomes a test. Every functional requirement traces to a test. If a requirement has no test, that's surfaced as a gap.

A good test suite:
- **Covers the acceptance criteria** — every Given/When/Then becomes verifiable
- **Catches regressions** — running tests before deployment prevents shipping broken code
- **Runs fast enough to be useful** — slow tests get skipped; fast tests get run; the platform optimizes for speed
- **Is maintainable** — tests follow conventions; the customer can read and edit them
- **Mocks external dependencies** — no flaky tests due to third-party API outages
- **Reports clearly** — when a test fails, the customer knows what's broken and why

This is the stage that makes the AI pipeline trustworthy. Without tests, the customer ships AI-generated code on hope. With tests, they ship on evidence.

---

## 2. Scope

### In Scope

- **Test plan generation**: structured plan mapping PRD acceptance criteria to test cases
- **Unit tests**: per server function from Stage 7; uses Vitest or similar
- **Component tests**: per UI component from Stage 6; uses Vitest + React Testing Library
- **Integration tests**: covering SDK usage; data plane operations
- **End-to-end tests**: user workflows via Playwright
- **Test fixtures**: mock data factories aligned with the schema (Faker-style)
- **Mock servers**: for third-party integrations (Stripe, SendGrid mocks for tests)
- **Snapshot testing**: for UI component output; managed via the testing framework's snapshot machinery
- **Coverage reporting**: line/branch coverage per test run
- **Test execution**: a test runner integrated with the platform; runs on demand and on Stage 9 deployment
- **Test review UI**: per-test review like Stage 6's component review
- **Regenerable tests**: edit a function, regenerate its tests
- **Traceability**: every test traces to PRD acceptance criteria (or to a function/component if it's testing platform mechanics)
- **CI integration**: tests run automatically on Stage 9 deployment
- **Approval routing**: per workspace's `tests` stage; typically QA approval in enterprise
- ADRs

### Out of Scope (Belongs to Later Objectives)

- Performance / load testing (deferred — important but a separate concern; covered partially by NFRs in PRD but full perf testing is its own stage)
- Security testing / penetration testing (deferred — the platform's own pentest covers infrastructure; customer apps inherit; specific security tests for customer logic are deferred)
- Visual regression testing beyond snapshots (deferred — full visual regression is heavyweight; basic snapshot is sufficient)
- Mutation testing (deferred — high value but expensive; future enhancement)
- Property-based testing (deferred — high value for some scenarios; complex to generate)
- Tests for AI-pipeline meta-behavior (the platform itself tests its prompts; customers don't test the AI)
- Test data generation for production (test fixtures are for tests; production data goes through Stage 5)
- A/B test infrastructure (deferred)

---

## 3. Locked Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Unit / component test runner | Vitest | Fast, Vite-native, Jest-compatible API |
| E2E test runner | Playwright | Industry standard, multi-browser, reliable |
| React testing library | React Testing Library (Testing Library family) | Standard; encourages accessibility-aware queries |
| Mock library | vi.mock + a curated mock factory layer | Vitest-native; predictable |
| Coverage tool | Vitest's c8/v8 coverage | Integrated; fast |
| Test plan format | Structured artifact mapping AC → test cases | Reviewable; traceable |
| Test generation pattern | Per-function and per-component test generation | Mirrors Stages 6/7's pattern |
| Acceptance criteria coverage requirement | 100% of `must` priority FRs; surfaced gaps for `should` and `could` | Discipline |
| Test execution location | In a sandbox; CI environment per workspace | Isolation |
| E2E test environment | Ephemeral preview deployment per test run | Isolation; predictability |
| Test data | Schema-aware mock data factory; deterministic seeds | Repeatable |
| Default coverage thresholds | 80% line, 70% branch per file (configurable per workspace) | Reasonable defaults |
| Approval routing | Per workspace's `tests` stage configuration | Reuse |
| Cost target | $2–$15 per full test suite generation | Cost-aware |

---

## 4. Architectural Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                  INPUTS (from prior stages)                            │
│                                                                       │
│   - Approved PRD (acceptance criteria)                                │
│   - Schema (data shape)                                               │
│   - UI Project (components to test)                                   │
│   - Server Code Project (functions to test)                           │
│   - Integration declarations (mocks needed)                           │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│                  TEST GENERATION SERVICE                              │
│                                                                       │
│   1. Test plan generation — map AC to test cases                      │
│   2. Per-function unit test generation                                │
│   3. Per-component test generation                                    │
│   4. Integration test generation                                      │
│   5. E2E test generation per user story                               │
│   6. Mock factory generation (schema-aware)                           │
│   7. Test execution validation — do they pass against the generated   │
│      code?                                                            │
│   8. Coverage validation                                               │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
                ┌────────────────────────┐
                │   Test Suite Artifact   │
                │  - Test plan             │
                │  - Test files            │
                │  - Mock factories        │
                │  - Coverage report       │
                └─────────────────────────┘
                             │
                             ▼
                ┌────────────────────────┐
                │   Test Review UI         │
                │  - Per-test review       │
                │  - Coverage gaps         │
                │  - Run tests on demand   │
                │  - View results          │
                └─────────────────────────┘
                             │
                             ▼
                  Approved tests → Stage 9 (Deployment runs them on every deploy)
```

---

## 5. The Hard Parts

**5.1 The test plan: AC → test cases**

Before any test code is generated, a structured plan maps every PRD acceptance criterion to one or more test cases:

```
FR-12 (Real-time data updates):
  AC-12.1: Given two users viewing the same record, When one updates it, Then the other sees the update within 2 seconds without refresh
    → E2E test: realtime_update_propagation
    → Component test: ContactsList_subscribesToUpdates
  AC-12.2: Given a user has lost connectivity, When they regain connectivity, Then updates from the outage are reflected within 5 seconds
    → E2E test: realtime_reconnection_resync
```

The plan is a separate artifact, reviewable before test code generation. The user sees:
- Which ACs are covered (and how)
- Which ACs are NOT covered (gaps)
- Which tests will be generated (preview)

The user can edit the plan: add tests, remove tests, change test types. This prevents the AI from generating 1000 redundant tests or missing critical coverage.

**5.2 Per-function unit test generation**

For each server function from Stage 7, generate unit tests:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { updateContactScore } from './updateContactScore';

describe('updateContactScore', () => {
  it('updates the contact score and returns the previous value', async () => {
    const sdk = mockSdk({
      'data.contacts.where.one': () => ({ id: 'c1', score: 50 }),
      'data.contacts.where.update': vi.fn(),
    });
    
    const result = await updateContactScore(
      { contactId: 'c1', newScore: 75 },
      mockContext({ sdk }),
    );
    
    expect(result).toEqual({
      success: true,
      contactId: 'c1',
      previousScore: 50,
    });
    expect(sdk.data('contacts').where().update).toHaveBeenCalledWith({ score: 75 });
  });
  
  it('triggers high-value-contact notification when score crosses threshold', async () => {
    const sdk = mockSdk({
      'data.contacts.where.one': () => ({ id: 'c1', score: 70 }),
      'data.contacts.where.update': vi.fn(),
      'functions.notifyHighValueContact': vi.fn(),
    });
    
    await updateContactScore(
      { contactId: 'c1', newScore: 85 },
      mockContext({ sdk }),
    );
    
    expect(sdk.functions.notifyHighValueContact).toHaveBeenCalledWith({ contactId: 'c1' });
  });
  
  it('throws NotFoundError when contact does not exist', async () => {
    const sdk = mockSdk({
      'data.contacts.where.one': () => null,
    });
    
    await expect(
      updateContactScore({ contactId: 'unknown', newScore: 50 }, mockContext({ sdk })),
    ).rejects.toThrow(NotFoundError);
  });
});
```

The test generation prompt receives:
- The function's source code
- The function's specs (input schema, output schema, behavior description)
- The function's reasoning record (from Stage 7)
- Related functions (if the function chains to others)

The AI generates tests covering:
- Happy path (the primary use case)
- Edge cases (null inputs, boundary conditions)
- Error cases (errors thrown, validation failures)
- Side effects (other SDK calls made)

The mocks are realistic — `mockSdk` is a typed helper that provides type-safe mocking aligned with the actual SDK interface.

**5.3 Per-component test generation**

For each UI component from Stage 6, generate tests:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ContactsList } from './ContactsList';
import { mockPlatformClient } from '@platform/test-utils';

describe('ContactsList', () => {
  it('renders contacts from the data layer', async () => {
    const platform = mockPlatformClient({
      data: {
        contacts: [
          { id: '1', name: 'Alice', email: 'alice@example.com', active: true },
          { id: '2', name: 'Bob', email: 'bob@example.com', active: true },
        ],
      },
    });
    
    render(<ContactsList />, { wrapper: createWrapper({ platform }) });
    
    expect(await screen.findByText('Alice')).toBeInTheDocument();
    expect(await screen.findByText('Bob')).toBeInTheDocument();
  });
  
  it('hides edit button for users without permission', async () => {
    const platform = mockPlatformClient({
      data: { contacts: [{ id: '1', name: 'Alice', _permissions: { canEdit: false } }] },
    });
    
    render(<ContactsList />, { wrapper: createWrapper({ platform }) });
    
    await screen.findByText('Alice');
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
  });
  
  it('updates when realtime event arrives', async () => {
    const platform = mockPlatformClient({
      data: { contacts: [{ id: '1', name: 'Alice', email: 'alice@example.com' }] },
    });
    
    render(<ContactsList />, { wrapper: createWrapper({ platform }) });
    await screen.findByText('Alice');
    
    platform.realtime.emit('contacts', {
      operation: 'update',
      new: { id: '1', name: 'Alicia', email: 'alice@example.com' },
    });
    
    expect(await screen.findByText('Alicia')).toBeInTheDocument();
  });
});
```

The platform client mock supports:
- Data fetching (returns mock data)
- Mutations (records calls, returns mock results)
- Realtime (emit method to trigger events)
- Auth (mock current user)
- Storage (mock file URLs)

This is the test-utils package referenced; it's part of the platform's SDK ecosystem (Objective 19).

**5.4 Integration tests**

Integration tests cover interactions between layers:
- A UI component invoking a server function
- A server function calling SDK methods that hit the actual data plane
- SDK calls authentication flows end-to-end

Integration tests run against an ephemeral platform instance:
- Database migrated with the schema (in-memory or temp containers)
- Server functions deployed
- API endpoints reachable

Slower than unit tests but more realistic. The AI generates a focused set per major workflow.

**5.5 End-to-end tests with Playwright**

E2E tests cover full user workflows from PRD user stories:

```typescript
import { test, expect } from '@playwright/test';

test('user can create a contact and see it in the list', async ({ page }) => {
  await page.goto('/contacts');
  
  await page.click('button:has-text("New Contact")');
  await page.fill('input[name="name"]', 'Charlie');
  await page.fill('input[name="email"]', 'charlie@example.com');
  await page.click('button:has-text("Save")');
  
  await expect(page.locator('text=Charlie')).toBeVisible();
});

test('two users see real-time updates', async ({ browser }) => {
  const userA = await browser.newPage();
  const userB = await browser.newPage();
  
  await userA.goto('/contacts');
  await userB.goto('/contacts');
  
  await userA.click('button:has-text("New Contact")');
  await userA.fill('input[name="name"]', 'Dora');
  await userA.click('button:has-text("Save")');
  
  await expect(userB.locator('text=Dora')).toBeVisible({ timeout: 5000 });
});
```

E2E tests require:
- An ephemeral preview deployment per test run (or per test suite execution)
- Test users created and authenticated
- Test data set up in the deployment

These are slower (seconds per test) and more expensive to run. The AI generates a focused set: typically 10-30 E2E tests per project covering critical user journeys.

**5.6 Mock factories: schema-aware data**

The platform provides a curated set of mock factories:

```typescript
import { faker } from '@platform/test-utils/faker';
import type { Contact, Deal } from './schema';

export const contactFactory = faker.factory<Contact>(() => ({
  id: faker.uuid(),
  name: faker.name.fullName(),
  email: faker.email(),
  phone: faker.phone(),
  active: true,
  created_at: faker.date.recent(),
  updated_at: faker.date.recent(),
}));

export const dealFactory = faker.factory<Deal>(() => ({
  id: faker.uuid(),
  contactId: faker.linkedFactory(contactFactory),
  amount: faker.number.float({ min: 100, max: 100000 }),
  stage: faker.pickFrom(['lead', 'qualified', 'proposal', 'won', 'lost']),
  // ... etc
}));
```

The factories are auto-generated from the schema. They produce realistic data that respects:
- Column types
- Required vs. nullable
- FK references (linked factories)
- Common patterns (emails look like emails, phones like phones)

PII detection from Stage 4 informs the factory: PII columns get realistic-but-fake values; non-PII gets actual realistic data.

Tests use factories to generate fixtures: `contactFactory.build({ name: 'Specific name' })` for a single record, `contactFactory.buildList(10)` for a list, etc.

**5.7 Mock servers for integrations**

For tests involving third-party integrations, the platform provides mock servers:

```typescript
import { mockStripe } from '@platform/test-utils/integrations';

beforeEach(() => {
  mockStripe.checkout.sessions.create.mockResolvedValue({
    url: 'https://mock-checkout.stripe.com/session/abc',
  });
});

it('creates a checkout session', async () => {
  const result = await createCheckoutSession({...}, ctx);
  expect(result.url).toContain('mock-checkout');
});
```

The mock servers cover the curated integration catalog from Stage 7. They're maintained by the platform team; customers don't write integration mocks themselves.

For integrations not in the catalog (custom HTTPS calls), the platform provides a generic `mockFetch` helper.

**5.8 Test execution: a test runner inside the platform**

The platform runs tests via an internal test runner:

```typescript
// Platform-side
async function runTests(testSuiteArtifactId: string): Promise<TestResults> {
  // 1. Spin up an ephemeral environment
  //    - Database migrated with the schema
  //    - Server functions deployed (Stage 7 output)
  //    - Mock services for integrations
  //    - UI bundle built (Stage 6 output)
  //    - URL accessible to Playwright
  // 2. Run unit tests via Vitest
  // 3. Run component tests via Vitest
  // 4. Run integration tests
  // 5. Run E2E tests via Playwright against the ephemeral URL
  // 6. Collect coverage data
  // 7. Tear down environment
  // 8. Return results
}
```

The runner uses Objective 27's sandbox infrastructure for isolation. Each test run is an ephemeral, isolated environment — no test pollution across runs.

Test runs are async; the user starts a run, gets a job ID, polls for status or subscribes via realtime for completion notification. Long runs (E2E) take minutes; the platform shows progress.

**5.9 Coverage validation**

After tests run, coverage is computed:
- Line coverage per file
- Branch coverage per file
- Function coverage
- Per-feature coverage (mapped via the test plan's traceability)

The default thresholds (80% line, 70% branch) are configurable. Coverage below threshold:
- Surfaces as warnings during review
- Doesn't block approval (the user decides if coverage is sufficient)
- Coverage gaps are addressable: the user can request "generate tests to cover gaps"

For Stage 9 (deployment), workspaces can configure: "production deploys require X% coverage, gate at threshold." Customer choice; the platform enforces.

**5.10 Acceptance criteria coverage**

Beyond line/branch coverage, the platform tracks **AC coverage**:
- Of all PRD acceptance criteria, how many have at least one test?
- Of `must` priority FRs, are 100% covered? (the locked discipline)
- Of `should` priority FRs, what % covered?
- Of `could` priority FRs, what % covered?

AC coverage is the more meaningful metric. Line coverage can be 100% with terrible tests; AC coverage means the actual behavior is verified.

The test plan from Section 5.1 establishes the mapping; the test execution verifies the mapping holds (tests actually pass for the ACs they claim to cover).

**5.11 Iterative refinement**

When a function or component changes (regenerated in Stage 6 or 7), affected tests need updating:
- The platform tracks which tests test which artifacts
- Regenerating an artifact marks its tests "stale"
- The user can request "regenerate affected tests" — only stale tests regenerate

This keeps tests in sync with implementation without forcing the user to regenerate everything.

If a test fails after regeneration of the function under test, the platform surfaces it: "This test failed; either the new implementation is wrong, or the test needs updating." The user investigates.

**5.12 Quality signals**

Beyond Objective 20's generic signals:

- **AC coverage rate**: how many ACs have tests?
- **Test pass rate on first run**: how often do generated tests pass against the generated code?
- **Test edit rate after generation**: how much do users edit tests post-approval?
- **Flake rate**: how often do tests fail intermittently?
- **Coverage achieved**: line/branch coverage relative to thresholds

Flaky tests are a particular concern — they erode trust in the suite. The platform tracks flake rate per test and surfaces flaky tests for review.

---

## 6. Component Specifications

### 6.1 TestGenerationService

```typescript
// packages/core/src/services/ai/test-generation/test-generation.service.ts

export class TestGenerationService {
  constructor(
    private readonly authz: AuthorizationPort,
    private readonly artifacts: ArtifactService,
    private readonly generation: GenerationService,
    private readonly pipeline: StagePipelineService,
    private readonly testRunner: TestRunnerPort,
    private readonly audit: AuditPort,
    private readonly logger: LoggerPort,
  ) {}

  /** Generate the test plan mapping ACs to test cases. */
  async generateTestPlan(
    ctx: RequestContext,
    input: GenerateTestPlanInput,
  ): Promise<Result<Artifact<TestPlan>, AppError>>;

  /** Generate the full test suite from an approved test plan. */
  async generateTestSuite(
    ctx: RequestContext,
    testPlanArtifactId: string,
  ): Promise<Result<Artifact<TestSuite>, AppError>>;

  /** Generate tests for a specific function or component. */
  async generateTestsForArtifact(
    ctx: RequestContext,
    targetArtifactId: string,
  ): Promise<Result<Artifact<TestFile>, AppError>>;

  /** Regenerate stale tests after upstream artifact changes. */
  async regenerateStale(
    ctx: RequestContext,
    testSuiteArtifactId: string,
  ): Promise<Result<Artifact<TestSuite>, AppError>>;

  /** Run a test suite. */
  async runTests(
    ctx: RequestContext,
    testSuiteArtifactId: string,
    options: TestRunOptions,
  ): Promise<Result<TestRun, AppError>>;

  /** Get test run status. */
  async getTestRun(
    ctx: RequestContext,
    runId: string,
  ): Promise<Result<TestRun, AppError>>;

  /** Approve the test suite. */
  async approveTestSuite(
    ctx: RequestContext,
    testSuiteArtifactId: string,
  ): Promise<Result<TestSuite, AppError>>;

  /** Get coverage report for a test run. */
  async getCoverageReport(
    ctx: RequestContext,
    runId: string,
  ): Promise<Result<CoverageReport, AppError>>;

  /** Get the AC coverage report. */
  async getAcCoverageReport(
    ctx: RequestContext,
    testSuiteArtifactId: string,
  ): Promise<Result<AcCoverageReport, AppError>>;
}
```

### 6.2 The Test Suite Artifact

```typescript
interface TestSuite {
  prdArtifactId: string;
  uiProjectArtifactId: string;
  serverCodeProjectArtifactId: string;
  testPlanArtifactId: string;
  
  testFileArtifactIds: string[];
  mockFactoryArtifactIds: string[];
  
  buildConfig: TestBuildConfig;
  acCoverageReport: AcCoverageReport;
}

interface TestPlan {
  prdArtifactId: string;
  
  testCases: TestCase[];
  uncoveredAcs: { acId: string; reason: string }[];
  
  estimatedTotalCount: {
    unit: number;
    component: number;
    integration: number;
    e2e: number;
  };
}

interface TestCase {
  id: string;
  acId: string;
  testType: 'unit' | 'component' | 'integration' | 'e2e';
  description: string;
  givenWhenThen?: { given: string; when: string; then: string };
  targetArtifactId?: string;            // function or component being tested
}

interface TestFile {
  id: string;
  testSuiteId: string;
  filePath: string;
  testType: 'unit' | 'component' | 'integration' | 'e2e';
  targetArtifactId?: string;
  testCaseIds: string[];                // which test cases from the plan this implements
  source: string;                        // the test file's source code
  reasoning: ReasoningRecord;
}

interface TestRun {
  id: string;
  testSuiteId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: Date;
  completedAt?: Date;
  results?: TestRunResults;
  coverageReport?: CoverageReport;
}

interface TestRunResults {
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  flaky: number;
  failures: TestFailure[];
  durationMs: number;
}

interface CoverageReport {
  overall: {
    line: number;
    branch: number;
    function: number;
    statement: number;
  };
  perFile: Record<string, FileCoverage>;
  thresholdsMet: boolean;
}

interface AcCoverageReport {
  totalAcs: number;
  acsWithTests: number;
  acsWithoutTests: number;
  byPriority: Record<'must' | 'should' | 'could', { covered: number; total: number }>;
  uncoveredMustAcs: string[];           // critical gap if non-empty
}
```

### 6.3 The Generation Prompts

In `packages/core/src/ai/prompts/test-generation/`:

- `test-plan-generation.prompt.ts`        — map AC to test cases
- `unit-test-generation.prompt.ts`         — per server function
- `component-test-generation.prompt.ts`    — per UI component
- `integration-test-generation.prompt.ts`  — per workflow
- `e2e-test-generation.prompt.ts`          — per user story
- `mock-factory-generation.prompt.ts`      — schema-aware mock factories
- `test-fix.prompt.ts`                     — when generated tests fail to pass against generated code
- `regeneration.prompt.ts`                  — regenerate with feedback
- `orchestrator.prompt.ts`                  — top-level

Each follows Objective 20's `definePrompt` API. Test suites verify the prompts produce tests that compile and run.

### 6.4 The TestRunnerPort

```typescript
// packages/ports/test-runner/src/

export interface TestRunnerPort {
  runUnitTests(suite: TestSuite): Promise<Result<TestRunResults, AppError>>;
  runComponentTests(suite: TestSuite): Promise<Result<TestRunResults, AppError>>;
  runIntegrationTests(suite: TestSuite, environmentId: string): Promise<Result<TestRunResults, AppError>>;
  runE2eTests(suite: TestSuite, deploymentUrl: string): Promise<Result<TestRunResults, AppError>>;
  collectCoverage(suite: TestSuite): Promise<Result<CoverageReport, AppError>>;
}
```

Adapters:
- **vitest-adapter**: runs unit and component tests via Vitest CLI
- **playwright-adapter**: runs E2E tests via Playwright
- **integration-adapter**: orchestrates ephemeral environments and runs tests

### 6.5 Ephemeral Test Environment

For integration and E2E tests, the platform spins up an ephemeral environment:

- Database: fresh container with the schema migrated; pre-seeded with test fixtures
- Server functions: deployed to a sandbox runtime
- UI: built and served from a temporary URL
- Test users: created with known credentials; permissions configured

The environment lives for the duration of the test run; torn down after. Reuses the deployment infrastructure from Objective 9 (Cross-Platform Runtime) and the sandbox from Objective 27.

For workspaces in production environments, the test environment uses a separate database (not the workspace's primary). For dev/staging, it uses a temporary version of the workspace's environment.

### 6.6 Mock Factory Generation

The mock factory generator reads the schema and produces faker-style factories per table:

```typescript
// Generated by AI; reviewed by user.

import { faker } from '@platform/test-utils/faker';
import type { Contact } from '../schema';

export const contactFactory = faker.factory<Contact>(() => ({
  id: faker.uuid(),
  name: faker.person.fullName(),
  email: faker.internet.email(),
  phone: faker.phone.number(),
  // ...
}));
```

The generator uses heuristics:
- Column name `email` → `faker.internet.email()`
- Column name `name`, `*_name` → name faker
- Column name `phone` → phone faker
- Date columns → recent dates
- FK columns → linked factories
- PII columns → fake-but-realistic values

Custom overrides per column can be specified by the user via the test plan.

### 6.7 The Test Review UI

Lives in `apps/web/src/ai-pipeline/test-generation/`:

- `TestGenerationPage.tsx` — main page; layout shell
- `panels/TestPlanPanel.tsx` — review AC → test mapping
- `panels/TestTreePanel.tsx` — generated tests grouped by type and target
- `panels/TestViewPanel.tsx` — single test detail with code
- `panels/TestRunPanel.tsx` — run tests; view results in real-time
- `panels/CoveragePanel.tsx` — line/branch/AC coverage reports
- `panels/FailuresPanel.tsx` — test failures with diagnostic info
- `dialogs/RegenerateTestDialog.tsx`
- `dialogs/RegenerateAffectedDialog.tsx`
- `dialogs/RunTestsDialog.tsx`

The user navigates the test tree; reviews each test's code; runs the suite; reviews results; iterates until satisfied.

### 6.8 Audit Events

```
ai.test_generation.test_plan_generated
ai.test_generation.test_suite_generated
ai.test_generation.test_file_generated
ai.test_generation.test_regenerated
ai.test_generation.test_run_started
ai.test_generation.test_run_completed
ai.test_generation.test_run_failed
ai.test_generation.coverage_below_threshold
ai.test_generation.flaky_test_detected
ai.test_generation.approved
ai.test_generation.rejected
```

### 6.9 Permissions

```
ai.tests.create
ai.tests.read
ai.tests.regenerate
ai.tests.run
ai.tests.approve
```

Default role mappings:
- `workspace_owner`, `workspace_admin`: all
- `qa`: all (QA owns testing)
- `developer`: create, read, regenerate, run
- `architect`: create, read, regenerate, run, approve
- `business_analyst`, `reviewer`, `viewer`: read
- Custom roles configurable

### 6.10 Quality Signal Specifics

```typescript
interface TestGenerationQualitySignals {
  testSuiteArtifactId: string;
  
  // Coverage
  initialAcCoverageRate: number;
  finalAcCoverageRate: number;
  initialLineCoverage: number;
  finalLineCoverage: number;
  
  // Test pass rate
  testsGeneratedTotal: number;
  testsPassingFirstRun: number;
  testsRequiredFix: number;
  
  // Flake
  flakyTestsDetected: number;
  
  // Edits
  testsEditedAfterApproval: number;
  
  // Time
  generationTimeMinutes: number;
  approvalTimeHours: number;
  
  // Downstream
  causedDownstreamDeployBlock: boolean;     // tests failed in Stage 9 deployment
}
```

### 6.11 Operational Runbooks

- `test-generation-acceptance-criteria-gaps.md` — addressing must-priority ACs without tests
- `test-generation-flaky-tests.md` — investigating and fixing intermittent failures
- `test-generation-ephemeral-environment-failures.md` — when test environments fail to spin up
- `test-generation-coverage-storm.md` — when coverage drops across many files
- `test-generation-e2e-timing-issues.md` — diagnosing E2E race conditions

---

## 7. Implementation Order

1. **Test plan, test suite, test file artifact schemas locked.**

2. **Test plan generation prompt** with test suite.

3. **Per-test-type generation prompts** (unit, component, integration, e2e) with test suites.

4. **Mock factory generation prompt.**

5. **Test-fix prompt** for failed-against-implementation tests.

6. **TestGenerationService skeleton.**

7. **TestRunnerPort and adapters** (Vitest, Playwright, integration).

8. **Ephemeral test environment provisioning.**

9. **End-to-end test plan generation working.**

10. **Per-function unit test generation.**

11. **Per-component test generation.**

12. **Integration test generation.**

13. **E2E test generation.**

14. **Mock factory generation.**

15. **Test execution end-to-end** producing pass/fail results.

16. **Coverage collection and reporting.**

17. **AC coverage tracking.**

18. **Stale-test detection** when upstream artifacts change.

19. **Test review UI** with all panels.

20. **Run tests on demand from UI.**

21. **Stage pipeline integration** (test-suite-level approval).

22. **Quality signal recording.**

23. **Audit events emitted.**

24. **CI integration for Stage 9** — tests run on deployment.

25. **End-to-end test**: PRD + UI + server code → test plan → test suite → execution → all green → approval.

26. **Documentation, ADRs, runbooks.**

27. **Verify Definition of Done.**

---

## 8. ADRs to Write

- **ADR-0205: Vitest + Playwright as the Test Stack** — alternatives considered
- **ADR-0206: Test Plan as Separate Artifact** — review AC mapping before generating test code
- **ADR-0207: AC Coverage as Primary Metric** — beyond line/branch; behavior verification
- **ADR-0208: Schema-Aware Mock Factories** — auto-generated; faker-style; PII-aware
- **ADR-0209: Ephemeral Test Environments** — isolation; reuse deployment infrastructure
- **ADR-0210: Tests Run in Sandbox** — same sandbox as Stage 7 functions
- **ADR-0211: Coverage Below Threshold is Warning, Not Block** — workspace decides; Stage 9 can enforce

---

## 9. Verification Steps

1. **Generate test plan** from a PRD with 20 ACs; produces structured plan covering all `must` ACs.

2. **Test plan editing**: user adds, removes, modifies test cases.

3. **Generate full test suite** from an approved plan.

4. **Per-function unit tests**: generated for each Stage 7 function; run and pass.

5. **Per-component tests**: generated for each Stage 6 component; run and pass.

6. **Integration tests**: workflow tests run against ephemeral environment; pass.

7. **E2E tests**: full user journey via Playwright; passes.

8. **Mock factories**: schema-aware; produce realistic data; FK linking works.

9. **Mock servers for integrations**: Stripe mock returns expected shapes; tests using it pass.

10. **Coverage reporting**: line/branch coverage measured; per-file breakdown available.

11. **AC coverage**: every `must` AC has at least one test; gaps surfaced for `should` and `could`.

12. **Test execution**: runs in ephemeral environment; results returned within minutes; isolated from other workspaces.

13. **Test failure reporting**: when a test fails, diagnostic info clear; user knows what's broken.

14. **Stale-test detection**: regenerating a Stage 7 function marks its tests stale.

15. **Regenerate stale tests**: only stale tests regenerated; others preserved.

16. **Run tests on demand**: from UI; results stream in real-time.

17. **Coverage thresholds**: configurable; default 80% line / 70% branch; below threshold surfaces warnings.

18. **Snapshot tests**: component snapshot generated; subsequent run compares; mismatches surface.

19. **Flaky test detection**: a test that fails 1 in 10 runs flagged.

20. **Provider failover**: test generation mid-flight fails over to backup provider.

21. **Cross-database**: tests work for Postgres/MSSQL/Mongo workspaces.

22. **Stage pipeline integration**: test suite submitted; approved per workspace config.

23. **CI integration**: Stage 9 deployments trigger test runs; failures block deployment per config.

24. **Audit events**: all lifecycle actions emit expected entries.

25. **Cost tracking**: per-test and total suite generation cost recorded.

26. **Quality signals**: AC coverage, test pass rate, flake rate recorded.

If all 26 pass, the objective is met.

---

## 10. Definition of Done

**Schema & Types**
- [ ] TestPlan, TestSuite, TestFile, TestRun, CoverageReport, AcCoverageReport schemas
- [ ] All sub-structures locked

**Prompts**
- [ ] Test plan generation
- [ ] Per-test-type generation prompts (unit, component, integration, e2e)
- [ ] Mock factory generation
- [ ] Test-fix
- [ ] Regeneration
- [ ] Orchestrator
- [ ] Test suites per prompt

**Service Layer**
- [ ] TestGenerationService implemented
- [ ] All generation, regeneration, execution methods
- [ ] Stage pipeline integration

**Test Runner**
- [ ] TestRunnerPort defined
- [ ] vitest-adapter for unit and component tests
- [ ] playwright-adapter for E2E
- [ ] Integration test orchestration
- [ ] Ephemeral environment provisioning

**Mock Infrastructure**
- [ ] Schema-aware mock factory generator
- [ ] Mock servers for integration catalog
- [ ] mockPlatformClient helper

**UI**
- [ ] Test review page with all panels
- [ ] Test plan editor
- [ ] Test tree
- [ ] Test detail view
- [ ] Run controls
- [ ] Coverage panel
- [ ] Failures panel
- [ ] All dialogs

**Coverage**
- [ ] Line/branch/statement coverage
- [ ] Per-file breakdown
- [ ] AC coverage tracking
- [ ] Threshold configuration

**Stale Detection**
- [ ] Tests linked to artifacts they test
- [ ] Stale flagging on artifact change
- [ ] Regenerate-stale workflow

**Quality & Observability**
- [ ] Quality signals recorded
- [ ] Per-prompt dashboards
- [ ] Stage-specific metrics
- [ ] Flake rate tracking

**Permissions**
- [ ] Stage permissions added
- [ ] Default role grants

**CI Integration**
- [ ] Stage 9 deployment runs tests
- [ ] Failures block deployment per workspace config

**Documentation**
- [ ] ADRs 0205–0211 written and Accepted
- [ ] All runbooks in Section 6.11 written
- [ ] Customer-facing test generation guide

**Verification**
- [ ] All 26 verification steps in Section 9 pass

---

## 11. Anti-Patterns to Refuse

- **Generating tests without an approved plan.** Plan first; review; then generate code.
- **Generating tests that pass without testing anything.** Tests must verify behavior; tautological tests caught in review.
- **Skipping AC coverage for `must` priority FRs.** 100% must-AC coverage is the discipline.
- **Letting flaky tests stay in the suite without flagging.** Flakes erode trust; surface and address.
- **Tests that depend on real third-party services.** Always mocked; deterministic.
- **Tests that mutate shared state across runs.** Each test isolated; ephemeral environments.
- **Generated mock factories that produce real-looking data the customer might confuse with real records.** Faker-style with clear placeholders.
- **Coverage as a substitute for AC coverage.** Line coverage can be 100% with terrible tests.
- **Letting tests bypass authentication or permission checks.** Tests run with realistic auth contexts.
- **Treating tests as nice-to-have.** Tests are mandatory output of the AI pipeline.
- **Slow test suites.** Speed is a feature; slow tests get skipped; the platform optimizes.

---

## 12. Open Questions for Confirmation Before Starting

1. **Vitest vs. Jest** — proposing Vitest. Faster, Vite-native. Most teams comfortable with Jest API still work. Recommendation: Vitest.

2. **Playwright vs. Cypress for E2E** — proposing Playwright. Cypress is popular but Playwright is more reliable cross-browser. Recommendation: Playwright.

3. **Coverage thresholds** — proposing 80% line / 70% branch as defaults. Some teams want stricter (90%+) or looser. Recommendation: configurable per workspace; defaults reasonable.

4. **AC coverage for `must` priority** — proposing 100% required. Acceptable, or workspace-configurable?

5. **Ephemeral environment per test run vs. per session** — proposing per session for E2E (tests share environment within a run); fresh per session. Acceptable?

6. **Snapshot testing depth** — proposing basic snapshot via testing library; not full visual regression. Acceptable?

7. **Test generation cost** — proposing $2-$15 per full suite. Cost varies with project size. Recommendation: per-test cost cap to prevent surprise.

---

## 13. What Comes Next

With Objective 28 complete, the customer's app has a complete test suite. AI-generated code is now AI-tested code. The trustworthiness gap closes meaningfully.

**Objective 29: Stage 9 — Deployment** is next. Deploy the approved app (UI + server functions + tests) through the environments configured in Objective 2 (dev → staging → prod). Tests run automatically; failures block production. The customer gets a running, tested, deployed app — without writing or operating the infrastructure.

**Objective 30: Stage 10 — Maintenance & Evolution** is the final stage. Once an app is live, customer feedback comes in: bug reports, feature requests, regressions. The platform supports iterating: regenerate specific stages with feedback, re-deploy, monitor outcomes. The pipeline doesn't end at deployment; it loops.

After Objective 30, the AI Build Pipeline is complete. Combined with the Data Management Module (Objectives 11-19), the platform delivers the full vision: structured AI-assisted development that takes a customer from "I want to build X" to "X is deployed, tested, monitored, and maintainable" — without them writing code.

---

*This document is the contract. Every checkbox in Section 10 must be true before moving on to Objective 29.*
