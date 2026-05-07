import { z } from 'zod';

// ─── Test plan ─────────────────────────────────────────────────────────────────

export type TestType = 'unit' | 'component' | 'integration' | 'e2e';

export interface TestCase {
  id: string;
  acId: string;
  testType: TestType;
  description: string;
  givenWhenThen?: { given: string; when: string; then: string };
  targetArtifactId?: string;
}

export interface TestPlan {
  id: string;
  projectId: string;
  prdArtifactId: string;
  testCases: TestCase[];
  uncoveredAcs: { acId: string; reason: string }[];
  estimatedTotalCount: { unit: number; component: number; integration: number; e2e: number };
  status: 'draft' | 'approved';
  createdAt: Date;
}

// ─── Test suite and files ──────────────────────────────────────────────────────

export interface ReasoningRecord {
  whyThisTestExists: string;
  whatItVerifies: string;
  designDecisions: string[];
}

export type TestFileStatus = 'generating' | 'draft' | 'stale' | 'approved';

export interface TestFile {
  id: string;
  testSuiteId: string;
  filePath: string;
  testType: TestType;
  targetArtifactId?: string;
  testCaseIds: string[];
  source: string;
  reasoning: ReasoningRecord;
  status: TestFileStatus;
  createdAt: Date;
}

export interface TestBuildConfig {
  testRunner: 'vitest' | 'playwright';
  configFiles: { path: string; content: string }[];
  setupFiles: string[];
}

export interface AcCoverageReport {
  totalAcs: number;
  acsWithTests: number;
  acsWithoutTests: number;
  byPriority: Record<'must' | 'should' | 'could', { covered: number; total: number }>;
  uncoveredMustAcs: string[];
}

export type TestSuiteStatus = 'generating' | 'review' | 'approved';

export interface TestSuite {
  id: string;
  workspaceId: string;
  projectId: string;
  prdArtifactId: string;
  uiProjectArtifactId?: string;
  serverCodeProjectArtifactId?: string;
  testPlanId: string;
  testFileIds: string[];
  mockFactoryFileIds: string[];
  buildConfig: TestBuildConfig;
  acCoverageReport: AcCoverageReport;
  status: TestSuiteStatus;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Test runs ─────────────────────────────────────────────────────────────────

export interface TestFailure {
  testName: string;
  filePath: string;
  error: string;
  stackTrace?: string;
  type: TestType;
}

export interface FileCoverage {
  line: number;
  branch: number;
  function: number;
  statement: number;
}

export interface CoverageReport {
  overall: { line: number; branch: number; function: number; statement: number };
  perFile: Record<string, FileCoverage>;
  thresholdsMet: boolean;
  lineThreshold: number;
  branchThreshold: number;
}

export interface TestRunResults {
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  flaky: number;
  failures: TestFailure[];
  durationMs: number;
}

export type TestRunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface TestRun {
  id: string;
  testSuiteId: string;
  workspaceId: string;
  status: TestRunStatus;
  runTypes: TestType[];
  startedAt: Date;
  completedAt?: Date;
  results?: TestRunResults;
  coverageReport?: CoverageReport;
  environmentUrl?: string;
}

// ─── Quality signals ──────────────────────────────────────────────────────────

export interface TestGenerationQualitySignals {
  testSuiteId: string;
  initialAcCoverageRate: number;
  finalAcCoverageRate: number;
  initialLineCoverage: number;
  finalLineCoverage: number;
  testsGeneratedTotal: number;
  testsPassingFirstRun: number;
  testsRequiredFix: number;
  flakyTestsDetected: number;
  testsEditedAfterApproval: number;
  generationTimeMinutes: number;
  approvalTimeHours: number;
  causedDownstreamDeployBlock: boolean;
}

// ─── Input schemas ────────────────────────────────────────────────────────────

export const GenerateTestPlanInputSchema = z.object({
  projectId: z.string().min(1),
  prdContent: z.string().min(1),
  schemaContent: z.string().optional(),
  uiProjectSummary: z.string().optional(),
  serverCodeSummary: z.string().optional(),
});
export type GenerateTestPlanInput = z.infer<typeof GenerateTestPlanInputSchema>;

export const GenerateTestSuiteInputSchema = z.object({
  projectId: z.string().min(1),
  testPlanId: z.string().min(1),
  testTypes: z.array(z.enum(['unit', 'component', 'integration', 'e2e'])).optional(),
});
export type GenerateTestSuiteInput = z.infer<typeof GenerateTestSuiteInputSchema>;

export const RunTestsInputSchema = z.object({
  testSuiteId: z.string().min(1),
  testTypes: z.array(z.enum(['unit', 'component', 'integration', 'e2e'])),
  deploymentUrl: z.string().optional(),
});
export type RunTestsInput = z.infer<typeof RunTestsInputSchema>;

export const RegenerateTestInputSchema = z.object({
  testFileId: z.string().min(1),
  feedback: z.string().optional(),
});
export type RegenerateTestInput = z.infer<typeof RegenerateTestInputSchema>;

// ─── Audit events ─────────────────────────────────────────────────────────────

export const TEST_GENERATION_AUDIT_EVENTS = {
  TEST_PLAN_GENERATED: 'ai.test_generation.test_plan_generated',
  TEST_SUITE_GENERATED: 'ai.test_generation.test_suite_generated',
  TEST_FILE_GENERATED: 'ai.test_generation.test_file_generated',
  TEST_REGENERATED: 'ai.test_generation.test_regenerated',
  TEST_RUN_STARTED: 'ai.test_generation.test_run_started',
  TEST_RUN_COMPLETED: 'ai.test_generation.test_run_completed',
  TEST_RUN_FAILED: 'ai.test_generation.test_run_failed',
  COVERAGE_BELOW_THRESHOLD: 'ai.test_generation.coverage_below_threshold',
  FLAKY_TEST_DETECTED: 'ai.test_generation.flaky_test_detected',
  APPROVED: 'ai.test_generation.approved',
  REJECTED: 'ai.test_generation.rejected',
} as const;

export type TestGenerationAuditEventType = typeof TEST_GENERATION_AUDIT_EVENTS[keyof typeof TEST_GENERATION_AUDIT_EVENTS];

// ─── Permissions ──────────────────────────────────────────────────────────────

export const TEST_GENERATION_PERMISSIONS = {
  CREATE: 'ai.tests.create',
  READ: 'ai.tests.read',
  REGENERATE: 'ai.tests.regenerate',
  RUN: 'ai.tests.run',
  APPROVE: 'ai.tests.approve',
} as const;

export const TEST_GENERATION_DEFAULT_GRANTS = {
  workspace_owner: ['ai.tests.create', 'ai.tests.read', 'ai.tests.regenerate', 'ai.tests.run', 'ai.tests.approve'],
  qa: ['ai.tests.create', 'ai.tests.read', 'ai.tests.regenerate', 'ai.tests.run', 'ai.tests.approve'],
  architect: ['ai.tests.create', 'ai.tests.read', 'ai.tests.regenerate', 'ai.tests.run', 'ai.tests.approve'],
  developer: ['ai.tests.create', 'ai.tests.read', 'ai.tests.regenerate', 'ai.tests.run'],
  business_analyst: ['ai.tests.read'],
  viewer: ['ai.tests.read'],
} as const;
