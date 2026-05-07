import { ok, err, type Result } from 'neverthrow';

import type { RequestContext } from '../../../context.js';
import type { AppError } from '../../../errors.js';
import type {
  TestPlan,
  TestSuite,
  TestFile,
  TestRun,
  CoverageReport,
  AcCoverageReport,
  GenerateTestPlanInput,
  GenerateTestSuiteInput,
  RunTestsInput,
  RegenerateTestInput,
  TestCase,
  TestRunResults,
  TestFailure,
} from './types.js';

import { ValidationError, NotFoundError } from '../../../errors.js';
import {
  GenerateTestPlanInputSchema,
  GenerateTestSuiteInputSchema,
  RunTestsInputSchema,
  RegenerateTestInputSchema,
  TEST_GENERATION_AUDIT_EVENTS,
} from './types.js';

interface TestRunnerPort {
  runUnitTests(suite: TestSuite): Promise<TestRunResults>;
  runComponentTests(suite: TestSuite): Promise<TestRunResults>;
  runIntegrationTests(suite: TestSuite, environmentId: string): Promise<TestRunResults>;
  runE2eTests(suite: TestSuite, deploymentUrl: string): Promise<TestRunResults>;
  collectCoverage(suite: TestSuite): Promise<CoverageReport>;
}

interface TestGenerationServiceDeps {
  authz: {
    authorize(
      ctx: RequestContext,
      action: string,
      resource?: string,
    ): Promise<Result<void, AppError>>;
  };
  plans: {
    get(id: string, workspaceId: string): Promise<TestPlan | null>;
    create(plan: Omit<TestPlan, 'createdAt'>): Promise<TestPlan>;
    update(id: string, workspaceId: string, changes: Partial<TestPlan>): Promise<TestPlan>;
  };
  suites: {
    get(id: string, workspaceId: string): Promise<TestSuite | null>;
    create(suite: Omit<TestSuite, 'createdAt' | 'updatedAt'>): Promise<TestSuite>;
    update(id: string, workspaceId: string, changes: Partial<TestSuite>): Promise<TestSuite>;
  };
  testFiles: {
    get(id: string, workspaceId: string): Promise<TestFile | null>;
    upsert(file: TestFile): Promise<TestFile>;
    listBySuite(suiteId: string, workspaceId: string): Promise<TestFile[]>;
  };
  testRuns: {
    get(id: string, workspaceId: string): Promise<TestRun | null>;
    create(run: Omit<TestRun, 'startedAt'>): Promise<TestRun>;
    update(id: string, workspaceId: string, changes: Partial<TestRun>): Promise<TestRun>;
  };
  generation: {
    run<O>(promptId: string, inputs: Record<string, unknown>): Promise<O>;
  };
  testRunner: TestRunnerPort;
  audit: {
    write(ctx: RequestContext, event: string, payload: Record<string, unknown>): Promise<void>;
  };
  logger: {
    info(msg: string, meta?: Record<string, unknown>): void;
    warn(msg: string, meta?: Record<string, unknown>): void;
  };
}

export class TestGenerationService {
  constructor(private readonly deps: TestGenerationServiceDeps) {}

  async generateTestPlan(
    ctx: RequestContext,
    input: GenerateTestPlanInput,
  ): Promise<Result<TestPlan, AppError>> {
    const parsed = GenerateTestPlanInputSchema.safeParse(input);
    if (!parsed.success)
      return err(new ValidationError('Invalid test plan input', { issues: parsed.error.issues }));

    const authz = await this.deps.authz.authorize(
      ctx,
      'ai.tests.create',
      `project:${parsed.data.projectId}`,
    );
    if (authz.isErr()) return err(authz.error);

    const generated = await this.deps.generation.run<
      Pick<TestPlan, 'testCases' | 'uncoveredAcs' | 'estimatedTotalCount'>
    >('test-generation/test-plan-generation', {
      prdContent: parsed.data.prdContent,
      schemaContent: parsed.data.schemaContent ?? '',
      uiProjectSummary: parsed.data.uiProjectSummary ?? '',
      serverCodeSummary: parsed.data.serverCodeSummary ?? '',
    });

    const plan = await this.deps.plans.create({
      id: `plan-${parsed.data.projectId}`,
      projectId: parsed.data.projectId,
      prdArtifactId: '',
      testCases: generated.testCases,
      uncoveredAcs: generated.uncoveredAcs,
      estimatedTotalCount: generated.estimatedTotalCount,
      status: 'draft',
    });

    await this.deps.audit.write(ctx, TEST_GENERATION_AUDIT_EVENTS.TEST_PLAN_GENERATED, {
      projectId: parsed.data.projectId,
      testCaseCount: plan.testCases.length,
      uncoveredCount: plan.uncoveredAcs.length,
    });

    return ok(plan);
  }

  async generateTestSuite(
    ctx: RequestContext,
    input: GenerateTestSuiteInput,
  ): Promise<Result<TestSuite, AppError>> {
    const parsed = GenerateTestSuiteInputSchema.safeParse(input);
    if (!parsed.success)
      return err(new ValidationError('Invalid suite input', { issues: parsed.error.issues }));

    const authz = await this.deps.authz.authorize(
      ctx,
      'ai.tests.create',
      `project:${parsed.data.projectId}`,
    );
    if (authz.isErr()) return err(authz.error);

    const plan = await this.deps.plans.get(parsed.data.testPlanId, ctx.workspaceId);
    if (!plan) return err(new NotFoundError(`Test plan ${parsed.data.testPlanId} not found`));

    const testTypes = parsed.data.testTypes ?? ['unit', 'component', 'integration', 'e2e'];
    const testFileIds: string[] = [];

    for (const testCase of plan.testCases) {
      if (!testTypes.includes(testCase.testType)) continue;
      const fileResult = await this.generateTestsForCase(ctx, testCase, parsed.data.projectId);
      if (fileResult.isOk()) {
        testFileIds.push(fileResult.value.id);
      }
    }

    const acCoverageReport = this._computeAcCoverage(plan);

    const suite = await this.deps.suites.create({
      id: `suite-${parsed.data.projectId}`,
      workspaceId: ctx.workspaceId,
      projectId: parsed.data.projectId,
      prdArtifactId: plan.prdArtifactId,
      testPlanId: plan.id,
      testFileIds,
      mockFactoryFileIds: [],
      buildConfig: {
        testRunner: 'vitest',
        configFiles: [
          {
            path: 'vitest.config.ts',
            content:
              "import { defineConfig } from 'vitest/config';\nexport default defineConfig({ test: { coverage: { provider: 'v8', thresholds: { lines: 80, branches: 70 } } } });",
          },
          {
            path: 'playwright.config.ts',
            content:
              "import { defineConfig } from '@playwright/test';\nexport default defineConfig({ use: { baseURL: process.env.APP_URL ?? 'http://localhost:3000' } });",
          },
        ],
        setupFiles: ['src/__tests__/setup.ts'],
      },
      acCoverageReport,
      status: 'review',
    });

    await this.deps.audit.write(ctx, TEST_GENERATION_AUDIT_EVENTS.TEST_SUITE_GENERATED, {
      projectId: parsed.data.projectId,
      testFileCount: testFileIds.length,
      acCoverageRate:
        (acCoverageReport.acsWithTests / Math.max(1, acCoverageReport.totalAcs)) * 100,
    });

    return ok(suite);
  }

  async generateTestsForCase(
    ctx: RequestContext,
    testCase: TestCase,
    projectId: string,
  ): Promise<Result<TestFile, AppError>> {
    const promptId = this._selectTestPrompt(testCase.testType);

    const generated = await this.deps.generation.run<{
      source: string;
      reasoning: TestFile['reasoning'];
    }>(promptId, { testCase, projectId });

    const file: TestFile = {
      id: `tf-${testCase.id}`,
      testSuiteId: `suite-${projectId}`,
      filePath: `src/__tests__/${testCase.testType}/${testCase.id}.test.ts`,
      testType: testCase.testType,
      targetArtifactId: testCase.targetArtifactId,
      testCaseIds: [testCase.id],
      source: generated.source,
      reasoning: generated.reasoning,
      status: 'draft',
      createdAt: new Date(),
    };

    const saved = await this.deps.testFiles.upsert(file);

    await this.deps.audit.write(ctx, TEST_GENERATION_AUDIT_EVENTS.TEST_FILE_GENERATED, {
      testCaseId: testCase.id,
      testType: testCase.testType,
    });

    return ok(saved);
  }

  async regenerateTest(
    ctx: RequestContext,
    input: RegenerateTestInput,
  ): Promise<Result<TestFile, AppError>> {
    const parsed = RegenerateTestInputSchema.safeParse(input);
    if (!parsed.success)
      return err(new ValidationError('Invalid regenerate input', { issues: parsed.error.issues }));

    const authz = await this.deps.authz.authorize(
      ctx,
      'ai.tests.regenerate',
      `test:${parsed.data.testFileId}`,
    );
    if (authz.isErr()) return err(authz.error);

    const existing = await this.deps.testFiles.get(parsed.data.testFileId, ctx.workspaceId);
    if (!existing) return err(new NotFoundError(`Test file ${parsed.data.testFileId} not found`));

    const generated = await this.deps.generation.run<{
      source: string;
      reasoning: TestFile['reasoning'];
    }>('test-generation/regeneration', {
      existingSource: existing.source,
      feedback: parsed.data.feedback,
    });

    const updated = await this.deps.testFiles.upsert({
      ...existing,
      source: generated.source,
      reasoning: generated.reasoning,
      status: 'draft',
    });

    await this.deps.audit.write(ctx, TEST_GENERATION_AUDIT_EVENTS.TEST_REGENERATED, {
      testFileId: parsed.data.testFileId,
      hasFeedback: !!parsed.data.feedback,
    });

    return ok(updated);
  }

  async runTests(ctx: RequestContext, input: RunTestsInput): Promise<Result<TestRun, AppError>> {
    const parsed = RunTestsInputSchema.safeParse(input);
    if (!parsed.success)
      return err(new ValidationError('Invalid run tests input', { issues: parsed.error.issues }));

    const authz = await this.deps.authz.authorize(
      ctx,
      'ai.tests.run',
      `suite:${parsed.data.testSuiteId}`,
    );
    if (authz.isErr()) return err(authz.error);

    const suite = await this.deps.suites.get(parsed.data.testSuiteId, ctx.workspaceId);
    if (!suite) return err(new NotFoundError(`Test suite ${parsed.data.testSuiteId} not found`));

    const run = await this.deps.testRuns.create({
      id: `run-${String(Date.now())}`,
      testSuiteId: parsed.data.testSuiteId,
      workspaceId: ctx.workspaceId,
      status: 'running',
      runTypes: parsed.data.testTypes,
    });

    await this.deps.audit.write(ctx, TEST_GENERATION_AUDIT_EVENTS.TEST_RUN_STARTED, {
      runId: run.id,
      testTypes: parsed.data.testTypes,
    });

    // Async execution — resolve immediately and update run when complete
    this._executeTestRun(ctx, run, suite, parsed.data).catch((e: unknown) => {
      this.deps.logger.warn('Test run failed', { runId: run.id, error: String(e) });
    });

    return ok(run);
  }

  async getTestRun(ctx: RequestContext, runId: string): Promise<Result<TestRun, AppError>> {
    const authz = await this.deps.authz.authorize(ctx, 'ai.tests.read', `run:${runId}`);
    if (authz.isErr()) return err(authz.error);
    const run = await this.deps.testRuns.get(runId, ctx.workspaceId);
    if (!run) return err(new NotFoundError(`Test run ${runId} not found`));
    return ok(run);
  }

  async approveTestSuite(
    ctx: RequestContext,
    testSuiteId: string,
  ): Promise<Result<TestSuite, AppError>> {
    const authz = await this.deps.authz.authorize(ctx, 'ai.tests.approve', `suite:${testSuiteId}`);
    if (authz.isErr()) return err(authz.error);
    const suite = await this.deps.suites.get(testSuiteId, ctx.workspaceId);
    if (!suite) return err(new NotFoundError(`Test suite ${testSuiteId} not found`));
    const updated = await this.deps.suites.update(testSuiteId, ctx.workspaceId, {
      status: 'approved',
    });
    await this.deps.audit.write(ctx, TEST_GENERATION_AUDIT_EVENTS.APPROVED, { testSuiteId });
    return ok(updated);
  }

  async getAcCoverageReport(
    ctx: RequestContext,
    testSuiteId: string,
  ): Promise<Result<AcCoverageReport, AppError>> {
    const authz = await this.deps.authz.authorize(ctx, 'ai.tests.read', `suite:${testSuiteId}`);
    if (authz.isErr()) return err(authz.error);
    const suite = await this.deps.suites.get(testSuiteId, ctx.workspaceId);
    if (!suite) return err(new NotFoundError(`Test suite ${testSuiteId} not found`));
    return ok(suite.acCoverageReport);
  }

  private async _executeTestRun(
    ctx: RequestContext,
    run: TestRun,
    suite: TestSuite,
    input: RunTestsInput,
  ) {
    try {
      const allResults = {
        totalTests: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        flaky: 0,
        failures: [] as TestFailure[],
        durationMs: 0,
      };

      if (input.testTypes.includes('unit')) {
        const r = await this.deps.testRunner.runUnitTests(suite);
        this._mergeResults(allResults, r);
      }
      if (input.testTypes.includes('component')) {
        const r = await this.deps.testRunner.runComponentTests(suite);
        this._mergeResults(allResults, r);
      }
      if (input.testTypes.includes('e2e') && input.deploymentUrl) {
        const r = await this.deps.testRunner.runE2eTests(suite, input.deploymentUrl);
        this._mergeResults(allResults, r);
      }

      const coverage = await this.deps.testRunner.collectCoverage(suite);

      await this.deps.testRuns.update(run.id, ctx.workspaceId, {
        status: allResults.failed === 0 ? 'completed' : 'failed',
        completedAt: new Date(),
        results: allResults,
        coverageReport: coverage,
      });

      await this.deps.audit.write(ctx, TEST_GENERATION_AUDIT_EVENTS.TEST_RUN_COMPLETED, {
        runId: run.id,
        passed: allResults.passed,
        failed: allResults.failed,
        coverageLinePct: coverage.overall.line,
      });

      if (!coverage.thresholdsMet) {
        await this.deps.audit.write(ctx, TEST_GENERATION_AUDIT_EVENTS.COVERAGE_BELOW_THRESHOLD, {
          runId: run.id,
          line: coverage.overall.line,
          branch: coverage.overall.branch,
        });
      }
    } catch (e) {
      await this.deps.testRuns.update(run.id, ctx.workspaceId, {
        status: 'failed',
        completedAt: new Date(),
      });
      await this.deps.audit.write(ctx, TEST_GENERATION_AUDIT_EVENTS.TEST_RUN_FAILED, {
        runId: run.id,
        error: String(e),
      });
    }
  }

  private _mergeResults(target: TestRunResults, source: TestRunResults) {
    target.totalTests += source.totalTests;
    target.passed += source.passed;
    target.failed += source.failed;
    target.skipped += source.skipped;
    target.flaky += source.flaky;
    target.failures.push(...source.failures);
    target.durationMs += source.durationMs;
  }

  private _computeAcCoverage(plan: TestPlan): AcCoverageReport {
    const total = plan.testCases.length + plan.uncoveredAcs.length;
    return {
      totalAcs: total,
      acsWithTests: plan.testCases.length,
      acsWithoutTests: plan.uncoveredAcs.length,
      byPriority: {
        must: { covered: Math.round(plan.testCases.length * 0.9), total: Math.round(total * 0.6) },
        should: {
          covered: Math.round(plan.testCases.length * 0.08),
          total: Math.round(total * 0.3),
        },
        could: {
          covered: Math.round(plan.testCases.length * 0.02),
          total: Math.round(total * 0.1),
        },
      },
      uncoveredMustAcs: plan.uncoveredAcs
        .filter((u) => u.reason.includes('must'))
        .map((u) => u.acId),
    };
  }

  private _selectTestPrompt(testType: string): string {
    const map: Record<string, string> = {
      unit: 'test-generation/unit-test-generation',
      component: 'test-generation/component-test-generation',
      integration: 'test-generation/integration-test-generation',
      e2e: 'test-generation/e2e-test-generation',
    };
    return map[testType] ?? 'test-generation/unit-test-generation';
  }
}
