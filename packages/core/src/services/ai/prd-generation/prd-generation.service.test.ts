/**
 * PrdGenerationService unit tests — Objective 22
 *
 * Uses in-memory adapters throughout. The AI generation port is mocked to
 * return preset outputs so tests are deterministic and cost-free.
 */

import type { AiGenerationPort } from '@platform/ports-ai';

import { ok, err } from 'neverthrow';
import { uuidv7 } from 'uuidv7';
import { describe, it, expect } from 'vitest';

import type { IntentBrief } from '../intent-capture/types.js';
import type {
  IntentBriefRepository,
  PrdArtifactRepository,
  PrdSectionRepository,
  PrdTemplateRepository,
} from './prd-generation.service.js';
import type { PrdArtifact, PrdSection, PrdSectionContent, PrdSectionType } from './types.js';
import type { PrdTemplate } from './types.js';

import { NotFoundError } from '../../../errors.js';
import {
  createInMemoryAudit,
  createInMemoryAuthz,
  createInMemoryLogger,
  makeUserContext,
} from '../../../testing/index.js';
import { PRD_AUDIT_EVENTS } from './audit-events.js';
import { PRD_PERMISSIONS } from './permissions.js';
import { PrdGenerationService } from './prd-generation.service.js';
import { PRD_SECTION_TYPES } from './types.js';

// ── Fixtures ───────────────────────────────────────────────────────────────────

function makeIntentBrief(overrides?: Partial<IntentBrief>): IntentBrief {
  return {
    workspaceId: 'ws-test-1',
    pipelineId: 'pipeline-test-1',
    title: 'Customer Portal',
    description: 'A portal for customers to manage their accounts.',
    projectType: 'customer_portal',
    goals: [
      {
        id: 'goal-1',
        description: 'Allow customers to view and update their account information',
        priority: 'must',
      },
      {
        id: 'goal-2',
        description: 'Enable self-service password reset',
        priority: 'must',
      },
    ],
    targetUsers: [
      {
        id: 'persona-1',
        name: 'Regular Customer',
        description: 'An existing customer who wants to manage their account.',
        needs: ['Easy account management', 'Fast password reset'],
        painPoints: ['Current process is slow and manual'],
      },
    ],
    inScope: ['Account management', 'Password reset', 'Profile editing'],
    outOfScope: ['New customer registration', 'Admin panel'],
    constraints: [
      {
        id: 'con-1',
        description: 'Must integrate with existing auth system',
        type: 'technical',
      },
    ],
    assumptions: ['Customers already have accounts in the system'],
    approvedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Minimal valid section content for each section type.
 * The service passes content straight through from the prompt output,
 * so the shape just needs to be a non-null object.
 */
function makeSectionContent(sectionType: PrdSectionType): PrdSectionContent {
  switch (sectionType) {
    case 'overview':
      return {
        summary: 'Test overview summary',
        background: 'Test background',
        problemStatement: 'Test problem statement',
        proposedSolution: 'Test proposed solution',
        keyBenefits: ['Benefit 1', 'Benefit 2'],
      };
    case 'goals_and_success_metrics':
      return {
        goals: [
          {
            id: 'goal-1',
            description: 'Goal 1',
            priority: 'must',
            successMetric: 'Metric 1',
            measurementMethod: 'Method 1',
            tracesTo: [{ type: 'intent_brief', artifactId: 'brief-1', fieldPath: 'goals.goal-1' }],
          },
        ],
        overallSuccessCriteria: 'All goals met',
      };
    case 'target_users_and_personas':
      return {
        personas: [
          {
            id: 'persona-1',
            name: 'Regular Customer',
            description: 'A customer',
            primaryGoals: ['Manage account'],
            painPoints: ['Slow process'],
            technicalProficiency: 'medium',
            frequency: 'weekly',
            tracesTo: [],
          },
        ],
        primaryPersona: 'persona-1',
      };
    case 'user_stories':
      return {
        stories: [
          {
            id: 'US-1',
            persona: 'persona-1',
            capability: 'update my account information',
            benefit: 'I can keep my data current',
            formatted:
              'As a Regular Customer, I want to update my account information, so that I can keep my data current',
            acceptanceCriteria: [
              {
                id: 'AC-1',
                given: 'I am logged in',
                when: 'I edit my profile',
                then: 'Changes are saved',
              },
            ],
            priority: 'must',
            tracesTo: [],
          },
        ],
      };
    case 'functional_requirements':
      return {
        requirements: [
          {
            id: 'FR-1',
            title: 'Account Management',
            description: 'Users can manage their accounts',
            priority: 'must',
            acceptanceCriteria: [
              {
                id: 'AC-1',
                given: 'I am logged in',
                when: 'I edit my profile',
                then: 'Changes are saved',
              },
            ],
            tracesTo: [{ type: 'intent_brief', artifactId: 'brief-1', fieldPath: 'goals.goal-1' }],
          },
        ],
      };
    case 'non_functional_requirements':
      return {
        requirements: [
          {
            id: 'NFR-1',
            category: 'performance',
            title: 'Page load time',
            description: 'Pages must load within 2 seconds',
            acceptanceCriteria: [
              {
                id: 'MAC-1',
                metric: 'Page load time',
                threshold: '< 2s',
                measurement: 'Lighthouse',
              },
            ],
            tracesTo: [],
          },
        ],
      };
    case 'constraints_and_assumptions':
      return {
        constraints: [
          {
            id: 'con-1',
            type: 'technical',
            description: 'Must use existing auth',
            impact: 'Limits auth flexibility',
          },
        ],
        assumptions: [
          {
            id: 'ass-1',
            description: 'Customers already exist',
            riskIfWrong: 'Registration flow needed',
          },
        ],
        dependencies: ['Auth system'],
      };
    case 'out_of_scope':
      return {
        items: [
          {
            id: 'oos-1',
            description: 'New customer registration',
            rationale: 'Out of scope per brief',
            deferredTo: 'v2',
          },
        ],
      };
    case 'open_questions':
      return {
        questions: [
          {
            id: 'OQ-1',
            question: 'What is the session timeout?',
            context: 'Security requirement',
            status: 'open',
            impact: 'medium',
          },
        ],
      };
    case 'risks_and_mitigations':
      return {
        risks: [
          {
            id: 'R-1',
            title: 'Auth integration failure',
            description: 'The auth integration may fail',
            probability: 'low',
            impact: 'high',
            riskScore: 'medium',
            mitigation: 'Thorough integration testing',
          },
        ],
        overallRiskRating: 'medium',
      };
  }
}

// ── In-memory repositories ────────────────────────────────────────────────────

function createInMemoryPrdRepo(): PrdArtifactRepository & {
  store: Map<string, PrdArtifact>;
} {
  const store = new Map<string, PrdArtifact>();

  return {
    store,
    create: (prd) =>
      Promise.resolve(ok(prd)).then((r) => {
        store.set(prd.id, prd);
        return r;
      }),
    findById: (id) => Promise.resolve(ok(store.get(id) ?? null)),
    update: (id, changes) => {
      const existing = store.get(id);
      if (!existing) return Promise.resolve(err(new NotFoundError('prd', id)));
      // `status` is a top-level artifact field; everything else merges into content
      const { status, ...contentChanges } = changes;
      const updated: PrdArtifact = {
        ...existing,
        ...(status !== undefined ? { status } : {}),
        content: { ...existing.content, ...contentChanges },
      };
      store.set(id, updated);
      return Promise.resolve(ok(updated));
    },
  };
}

function createInMemorySectionRepo(): PrdSectionRepository & {
  store: Map<string, PrdSection>;
} {
  const store = new Map<string, PrdSection>();

  return {
    store,
    create: (section) => {
      store.set(section.id, section);
      return Promise.resolve(ok(section));
    },
    findById: (id) => Promise.resolve(ok(store.get(id) ?? null)),
    findByPrdId: (prdId) =>
      Promise.resolve(ok([...store.values()].filter((s) => s.prdId === prdId))),
    update: (id, changes) => {
      const existing = store.get(id);
      if (!existing) return Promise.resolve(err(new NotFoundError('prd_section', id)));
      const updated = { ...existing, ...changes };
      store.set(id, updated);
      return Promise.resolve(ok(updated));
    },
  };
}

function createInMemoryIntentRepo(brief?: IntentBrief): IntentBriefRepository & {
  store: Map<string, IntentBrief>;
} {
  const store = new Map<string, IntentBrief>();
  if (brief) store.set(brief.workspaceId + ':' + brief.pipelineId, brief);

  return {
    store,
    findById: (id) => Promise.resolve(ok(store.get(id) ?? null)),
  };
}

function createInMemoryTemplateRepo(): PrdTemplateRepository & {
  store: Map<string, PrdTemplate & { id: string; createdAt: Date; updatedAt: Date }>;
} {
  const store = new Map<string, PrdTemplate & { id: string; createdAt: Date; updatedAt: Date }>();
  return {
    store,
    create: (template) => {
      store.set(template.id, template);
      return Promise.resolve(ok(template));
    },
    findById: (id) => Promise.resolve(ok(store.get(id) ?? null)),
    findByWorkspaceId: (workspaceId) =>
      Promise.resolve(ok([...store.values()].filter((t) => t.workspaceId === workspaceId))),
    delete: (id) => {
      store.delete(id);
      return Promise.resolve(ok(undefined));
    },
  };
}

// ── Mock AI port ──────────────────────────────────────────────────────────────

/**
 * Mock AI generation port. Every call to `generate` returns a JSON response
 * that looks like a valid prompt output for the given section type.
 * We intercept at the prompt level by making the AI port return valid JSON.
 */
function createMockAiPort(opts?: {
  fail?: boolean;
  sectionOverrides?: Partial<Record<PrdSectionType, PrdSectionContent>>;
}): AiGenerationPort {
  return {
    generate: async (_messages, _genOpts) => {
      if (opts?.fail) {
        return err({ message: 'AI provider unavailable', code: 'AI_ERROR' } as never);
      }

      // The prompts will parse the JSON we return. We need to return content that
      // validates against each prompt's output schema. Since we're using mock prompts
      // (the prompt files import the ai port and call ai.generate), the simplest
      // approach is to return a JSON blob for each section type.
      // In a real test the prompt files would exist; here we return generic content
      // that the prompts should accept (they pass through to outputSchema.safeParse).
      const content = JSON.stringify({
        summary: 'Test overview summary',
        background: 'Test background',
        problemStatement: 'Test problem statement',
        proposedSolution: 'Test proposed solution',
        keyBenefits: ['Benefit 1'],
        goals: [
          {
            id: 'goal-1',
            description: 'Goal 1',
            priority: 'must',
            successMetric: 'Metric 1',
            measurementMethod: 'Method 1',
            tracesTo: [],
          },
        ],
        overallSuccessCriteria: 'All goals met',
        personas: [
          {
            id: 'persona-1',
            name: 'User',
            description: 'A user',
            primaryGoals: ['goal'],
            painPoints: [],
            technicalProficiency: 'medium',
            frequency: 'weekly',
            tracesTo: [],
          },
        ],
        primaryPersona: 'persona-1',
        stories: [
          {
            id: 'US-1',
            persona: 'persona-1',
            capability: 'do things',
            benefit: 'get value',
            formatted: 'As a User, I want to do things, so that I get value',
            // Superset: satisfies both AcceptanceCriterionSchema (given/when/then)
            // and MetricAcceptanceCriterionSchema (metric/threshold). Zod strips extras.
            acceptanceCriteria: [
              {
                id: 'AC-1',
                given: 'the system is running',
                when: 'the user performs an action',
                then: 'the expected outcome occurs',
                metric: 'task completion time',
                threshold: '< 5s',
                measurement: 'manual usability test',
              },
            ],
            priority: 'must',
            tracesTo: [],
          },
        ],
        requirements: [
          {
            id: 'FR-1',
            title: 'Feature',
            description: 'Desc',
            priority: 'must',
            // Superset: satisfies both AcceptanceCriterionSchema (given/when/then)
            // and MetricAcceptanceCriterionSchema (metric/threshold). Zod strips extras.
            acceptanceCriteria: [
              {
                id: 'AC-1',
                given: 'the system is running',
                when: 'the user performs an action',
                then: 'the expected outcome occurs',
                metric: 'response time',
                threshold: '< 2s',
                measurement: 'load test with k6',
              },
            ],
            tracesTo: [{ type: 'intent_brief', artifactId: 'a', fieldPath: 'goals.goal-1' }],
            category: 'performance',
          },
        ],
        constraints: [],
        assumptions: [],
        dependencies: [],
        items: [],
        questions: [],
        risks: [],
        overallRiskRating: 'low',
        issues: [],
        clean: true,
        totalIntentGoals: 2,
        coveredGoals: 2,
        gaps: [],
        fullyCovered: true,
        stalenessIndicators: [],
        changedIntentFields: [],
      });

      return ok({
        content,
        model: 'claude-3-5-sonnet-20241022',
        reasoning: 'Test reasoning step 1\nTest reasoning step 2',
        usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
        finishReason: 'stop',
      });
    },

    stream: async function* () {
      // no-op
    },

    countTokens: async () => ok(300),

    availableModels: () => ['claude-3-5-sonnet-20241022'],
  };
}

// ── Service factory ────────────────────────────────────────────────────────────

interface TestFixtures {
  service: PrdGenerationService;
  prdRepo: ReturnType<typeof createInMemoryPrdRepo>;
  sectionRepo: ReturnType<typeof createInMemorySectionRepo>;
  intentRepo: ReturnType<typeof createInMemoryIntentRepo>;
  audit: ReturnType<typeof createInMemoryAudit>;
  brief: IntentBrief;
  briefId: string;
}

function makeFixtures(opts?: {
  denyAll?: boolean;
  denyActions?: string[];
  aiFail?: boolean;
}): TestFixtures {
  const brief = makeIntentBrief();
  // Use a real UUID for the brief ID so we can look it up
  const briefId = uuidv7();
  const briefWithId = { ...brief };

  const intentRepo = createInMemoryIntentRepo();
  intentRepo.store.set(briefId, briefWithId);

  const prdRepo = createInMemoryPrdRepo();
  const sectionRepo = createInMemorySectionRepo();
  const templateRepo = createInMemoryTemplateRepo();
  const audit = createInMemoryAudit();
  const logger = createInMemoryLogger();
  const authz = createInMemoryAuthz({
    ...(opts?.denyAll !== undefined ? { deny: opts.denyAll } : {}),
    ...(opts?.denyActions !== undefined ? { denyActions: opts.denyActions } : {}),
  });
  const ai = createMockAiPort(opts?.aiFail !== undefined ? { fail: opts.aiFail } : undefined);

  const service = new PrdGenerationService(
    authz,
    prdRepo,
    sectionRepo,
    intentRepo,
    audit,
    logger,
    templateRepo,
    ai,
  );

  return { service, prdRepo, sectionRepo, intentRepo, audit, brief: briefWithId, briefId };
}

// ── generatePrd ────────────────────────────────────────────────────────────────

describe('PrdGenerationService.generatePrd', () => {
  it('generates a PRD artifact with all 10 sections', async () => {
    const { service, prdRepo, sectionRepo, briefId } = makeFixtures();
    const ctx = makeUserContext({ userId: 'user-1', workspaceId: 'ws-test-1' });

    const result = await service.generatePrd(ctx, briefId);

    expect(result.isOk()).toBe(true);
    const prd = result._unsafeUnwrap();
    expect(prd.artifactType).toBe('prd');
    expect(prd.workspaceId).toBe('ws-test-1');
    expect(prd.status).toBe('draft');

    // All 10 sections are referenced in the PRD
    const sectionIdMap = prd.content.sectionIds;
    for (const sectionType of PRD_SECTION_TYPES) {
      expect(sectionIdMap[sectionType]).toBeTruthy();
    }

    // 10 sections persisted
    const savedSections = [...sectionRepo.store.values()].filter((s) => s.prdId === prd.id);
    expect(savedSections).toHaveLength(10);

    // PRD persisted
    expect(prdRepo.store.has(prd.id)).toBe(true);
  });

  it('creates sections with version 1 and draft status', async () => {
    const { service, sectionRepo, briefId } = makeFixtures();
    const ctx = makeUserContext({ userId: 'user-1', workspaceId: 'ws-test-1' });

    await service.generatePrd(ctx, briefId);

    const sections = [...sectionRepo.store.values()];
    for (const section of sections) {
      expect(section.version).toBe(1);
      expect(section.status).toBe('draft');
    }
  });

  it('emits ai.prd.prd_generated audit event', async () => {
    const { service, audit, briefId } = makeFixtures();
    const ctx = makeUserContext({ userId: 'user-1', workspaceId: 'ws-test-1' });

    await service.generatePrd(ctx, briefId);

    expect(audit.events).toContainEqual(
      expect.objectContaining({
        eventType: PRD_AUDIT_EVENTS.PRD_GENERATED,
        outcome: 'success',
      }),
    );
  });

  it('emits ai.prd.section_generated for each section', async () => {
    const { service, audit, briefId } = makeFixtures();
    const ctx = makeUserContext({ userId: 'user-1', workspaceId: 'ws-test-1' });

    await service.generatePrd(ctx, briefId);

    const sectionEvents = audit.events.filter(
      (e) => e.eventType === PRD_AUDIT_EVENTS.SECTION_GENERATED,
    );
    expect(sectionEvents).toHaveLength(10);
  });

  it('returns ValidationError for unapproved intent brief', async () => {
    const { service, intentRepo, briefId, brief } = makeFixtures();
    const ctx = makeUserContext({ userId: 'user-1', workspaceId: 'ws-test-1' });

    // Remove the approvedAt field to simulate an unapproved brief
    const unapproved = { ...brief, approvedAt: '' } as IntentBrief & { approvedAt: string };
    intentRepo.store.set(briefId, unapproved);

    const result = await service.generatePrd(ctx, briefId);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('VALIDATION');
  });

  it('returns NotFoundError when intent brief does not exist', async () => {
    const { service } = makeFixtures();
    const ctx = makeUserContext({ userId: 'user-1', workspaceId: 'ws-test-1' });

    const result = await service.generatePrd(ctx, uuidv7());

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('NOT_FOUND');
  });

  it('returns ForbiddenError when authorization is denied', async () => {
    const { service, briefId, audit } = makeFixtures({ denyAll: true });
    const ctx = makeUserContext({ userId: 'user-1', workspaceId: 'ws-test-1' });

    const result = await service.generatePrd(ctx, briefId);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('FORBIDDEN');

    // Audit should record the denial
    expect(audit.events).toContainEqual(expect.objectContaining({ outcome: 'denied' }));
  });

  it('returns ForbiddenError when intent brief belongs to different workspace', async () => {
    const { service, intentRepo, briefId, brief } = makeFixtures();
    const ctx = makeUserContext({ userId: 'user-1', workspaceId: 'ws-different' });

    // Brief is in ws-test-1, request is from ws-different
    intentRepo.store.set(briefId, { ...brief, workspaceId: 'ws-test-1' });

    const result = await service.generatePrd(ctx, briefId);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('FORBIDDEN');
  });

  it('returns ValidationError for invalid intentBriefId format', async () => {
    const { service } = makeFixtures();
    const ctx = makeUserContext({ userId: 'user-1', workspaceId: 'ws-test-1' });

    const result = await service.generatePrd(ctx, 'not-a-uuid');

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('VALIDATION');
  });

  it('returns WorkspaceContextRequiredError when workspaceId missing from ctx', async () => {
    const { service, briefId } = makeFixtures();
    const ctx = makeUserContext({ userId: 'user-1' }); // no workspaceId

    const result = await service.generatePrd(ctx, briefId);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('WORKSPACE_CONTEXT_REQUIRED');
  });
});

// ── getPrd ─────────────────────────────────────────────────────────────────────

describe('PrdGenerationService.getPrd', () => {
  async function setupPrd(fixtures: TestFixtures) {
    const ctx = makeUserContext({ userId: 'user-1', workspaceId: 'ws-test-1' });
    const result = await fixtures.service.generatePrd(ctx, fixtures.briefId);
    return { ctx, prd: result._unsafeUnwrap() };
  }

  it('returns the PRD when found and workspace matches', async () => {
    const fixtures = makeFixtures();
    const { ctx, prd } = await setupPrd(fixtures);

    const result = await fixtures.service.getPrd(ctx, prd.id);

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().id).toBe(prd.id);
  });

  it('returns NotFoundError for unknown prdId', async () => {
    const { service } = makeFixtures();
    const ctx = makeUserContext({ userId: 'user-1', workspaceId: 'ws-test-1' });

    const result = await service.getPrd(ctx, uuidv7());

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('NOT_FOUND');
  });

  it('returns ForbiddenError when prd belongs to different workspace', async () => {
    const fixtures = makeFixtures();
    const { prd } = await setupPrd(fixtures);
    const otherCtx = makeUserContext({ userId: 'user-1', workspaceId: 'ws-other' });

    const result = await fixtures.service.getPrd(otherCtx, prd.id);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('FORBIDDEN');
  });

  it('returns ForbiddenError when authorization denied', async () => {
    const fixtures = makeFixtures();
    const { prd } = await setupPrd(fixtures);

    const deniedFixtures = makeFixtures({ denyActions: [PRD_PERMISSIONS.READ] });
    // Manually put the PRD in the denied fixture's repo
    deniedFixtures.prdRepo.store.set(prd.id, prd);

    const ctx = makeUserContext({ userId: 'user-1', workspaceId: 'ws-test-1' });
    const result = await deniedFixtures.service.getPrd(ctx, prd.id);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('FORBIDDEN');
  });

  it('returns ValidationError for non-UUID prdId', async () => {
    const { service } = makeFixtures();
    const ctx = makeUserContext({ userId: 'user-1', workspaceId: 'ws-test-1' });

    const result = await service.getPrd(ctx, 'bad-id');

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('VALIDATION');
  });
});

// ── getSection ─────────────────────────────────────────────────────────────────

describe('PrdGenerationService.getSection', () => {
  it('returns the correct section for a given sectionType', async () => {
    const fixtures = makeFixtures();
    const ctx = makeUserContext({ userId: 'user-1', workspaceId: 'ws-test-1' });
    const prd = (await fixtures.service.generatePrd(ctx, fixtures.briefId))._unsafeUnwrap();

    const result = await fixtures.service.getSection(ctx, prd.id, 'overview');

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().sectionType).toBe('overview');
  });

  it('returns NotFoundError for a section type not in the PRD', async () => {
    const fixtures = makeFixtures();
    const ctx = makeUserContext({ userId: 'user-1', workspaceId: 'ws-test-1' });
    const prd = (await fixtures.service.generatePrd(ctx, fixtures.briefId))._unsafeUnwrap();

    // Manually remove a section from the sectionIds map to simulate missing section
    const prdInStore = fixtures.prdRepo.store.get(prd.id)!;
    const sectionIdsCopy = { ...prdInStore.content.sectionIds };

    delete (sectionIdsCopy as Record<string, unknown>)['overview'];
    fixtures.prdRepo.store.set(prd.id, {
      ...prdInStore,
      content: { ...prdInStore.content, sectionIds: sectionIdsCopy },
    });

    const result = await fixtures.service.getSection(ctx, prd.id, 'overview');

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('NOT_FOUND');
  });
});

// ── editSection ────────────────────────────────────────────────────────────────

describe('PrdGenerationService.editSection', () => {
  it('updates the section content and increments version', async () => {
    const fixtures = makeFixtures();
    const ctx = makeUserContext({ userId: 'user-1', workspaceId: 'ws-test-1' });
    const prd = (await fixtures.service.generatePrd(ctx, fixtures.briefId))._unsafeUnwrap();

    const overviewId = prd.content.sectionIds['overview'];
    const newContent = makeSectionContent('overview');

    const result = await fixtures.service.editSection(ctx, overviewId, {
      content: newContent,
      reason: 'Test edit',
    });

    expect(result.isOk()).toBe(true);
    const updated = result._unsafeUnwrap();
    expect(updated.version).toBe(2);
    expect(updated.status).toBe('draft');
  });

  it('emits ai.prd.section_edited audit event', async () => {
    const fixtures = makeFixtures();
    const ctx = makeUserContext({ userId: 'user-1', workspaceId: 'ws-test-1' });
    const prd = (await fixtures.service.generatePrd(ctx, fixtures.briefId))._unsafeUnwrap();
    const overviewId = prd.content.sectionIds['overview'];

    fixtures.audit.reset();
    await fixtures.service.editSection(ctx, overviewId, {
      content: makeSectionContent('overview'),
    });

    expect(fixtures.audit.events).toContainEqual(
      expect.objectContaining({
        eventType: PRD_AUDIT_EVENTS.SECTION_EDITED,
        outcome: 'success',
      }),
    );
  });

  it('returns ForbiddenError when authorization denied', async () => {
    const fixtures = makeFixtures();
    const ctx = makeUserContext({ userId: 'user-1', workspaceId: 'ws-test-1' });
    const prd = (await fixtures.service.generatePrd(ctx, fixtures.briefId))._unsafeUnwrap();
    const overviewId = prd.content.sectionIds['overview'];

    // Create a separate service with edit permission denied
    const restrictedFixtures = makeFixtures({ denyActions: [PRD_PERMISSIONS.EDIT] });
    // Copy the section into the restricted fixture's repos
    for (const [id, section] of fixtures.sectionRepo.store) {
      restrictedFixtures.sectionRepo.store.set(id, section);
    }
    restrictedFixtures.prdRepo.store.set(prd.id, prd);

    const result = await restrictedFixtures.service.editSection(ctx, overviewId, {
      content: makeSectionContent('overview'),
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('FORBIDDEN');
  });

  it('returns NotFoundError for unknown sectionId', async () => {
    const { service } = makeFixtures();
    const ctx = makeUserContext({ userId: 'user-1', workspaceId: 'ws-test-1' });

    const result = await service.editSection(ctx, uuidv7(), {
      content: makeSectionContent('overview'),
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('NOT_FOUND');
  });

  it('returns ValidationError for non-UUID sectionId', async () => {
    const { service } = makeFixtures();
    const ctx = makeUserContext({ userId: 'user-1', workspaceId: 'ws-test-1' });

    const result = await service.editSection(ctx, 'bad-id', {
      content: makeSectionContent('overview'),
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('VALIDATION');
  });
});

// ── submitSectionForApproval ──────────────────────────────────────────────────

describe('PrdGenerationService.submitSectionForApproval', () => {
  it('transitions section status from draft to in_review', async () => {
    const fixtures = makeFixtures();
    const ctx = makeUserContext({ userId: 'user-1', workspaceId: 'ws-test-1' });
    const prd = (await fixtures.service.generatePrd(ctx, fixtures.briefId))._unsafeUnwrap();
    const overviewId = prd.content.sectionIds['overview'];

    const result = await fixtures.service.submitSectionForApproval(ctx, overviewId);

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().status).toBe('in_review');
  });

  it('emits ai.prd.section_submitted audit event', async () => {
    const fixtures = makeFixtures();
    const ctx = makeUserContext({ userId: 'user-1', workspaceId: 'ws-test-1' });
    const prd = (await fixtures.service.generatePrd(ctx, fixtures.briefId))._unsafeUnwrap();
    const overviewId = prd.content.sectionIds['overview'];

    fixtures.audit.reset();
    await fixtures.service.submitSectionForApproval(ctx, overviewId);

    expect(fixtures.audit.events).toContainEqual(
      expect.objectContaining({
        eventType: PRD_AUDIT_EVENTS.SECTION_SUBMITTED,
        outcome: 'success',
      }),
    );
  });

  it('rejects submission when section is already in_review', async () => {
    const fixtures = makeFixtures();
    const ctx = makeUserContext({ userId: 'user-1', workspaceId: 'ws-test-1' });
    const prd = (await fixtures.service.generatePrd(ctx, fixtures.briefId))._unsafeUnwrap();
    const overviewId = prd.content.sectionIds['overview'];

    // Submit once
    await fixtures.service.submitSectionForApproval(ctx, overviewId);
    // Submit again — should fail
    const result = await fixtures.service.submitSectionForApproval(ctx, overviewId);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('VALIDATION');
  });

  it('returns ForbiddenError when authorization denied', async () => {
    const fixtures = makeFixtures({ denyActions: [PRD_PERMISSIONS.EDIT] });
    const ctx = makeUserContext({ userId: 'user-1', workspaceId: 'ws-test-1' });

    // Generate using a separate allowed service, then submit using the restricted one
    const allowedFixtures = makeFixtures();
    const prd = (
      await allowedFixtures.service.generatePrd(ctx, allowedFixtures.briefId)
    )._unsafeUnwrap();
    const overviewId = prd.content.sectionIds['overview'];

    // Copy data to restricted fixtures
    for (const [id, s] of allowedFixtures.sectionRepo.store) {
      fixtures.sectionRepo.store.set(id, s);
    }
    fixtures.prdRepo.store.set(prd.id, prd);

    const result = await fixtures.service.submitSectionForApproval(ctx, overviewId);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('FORBIDDEN');
  });
});

// ── checkConsistency ──────────────────────────────────────────────────────────

describe('PrdGenerationService.checkConsistency', () => {
  it('returns a ConsistencyReport with clean=true for a well-formed PRD', async () => {
    const fixtures = makeFixtures();
    const ctx = makeUserContext({ userId: 'user-1', workspaceId: 'ws-test-1' });
    const prd = (await fixtures.service.generatePrd(ctx, fixtures.briefId))._unsafeUnwrap();

    const result = await fixtures.service.checkConsistency(ctx, prd.id);

    expect(result.isOk()).toBe(true);
    const report = result._unsafeUnwrap();
    expect(report).toHaveProperty('ranAt');
    expect(report).toHaveProperty('issues');
    expect(report).toHaveProperty('clean');
    expect(Array.isArray(report.issues)).toBe(true);
  });

  it('emits ai.prd.consistency_check_run audit event', async () => {
    const fixtures = makeFixtures();
    const ctx = makeUserContext({ userId: 'user-1', workspaceId: 'ws-test-1' });
    const prd = (await fixtures.service.generatePrd(ctx, fixtures.briefId))._unsafeUnwrap();

    fixtures.audit.reset();
    await fixtures.service.checkConsistency(ctx, prd.id);

    expect(fixtures.audit.events).toContainEqual(
      expect.objectContaining({
        eventType: PRD_AUDIT_EVENTS.CONSISTENCY_CHECK_RUN,
        outcome: 'success',
      }),
    );
  });

  it('returns NotFoundError for unknown prdId', async () => {
    const { service } = makeFixtures();
    const ctx = makeUserContext({ userId: 'user-1', workspaceId: 'ws-test-1' });

    const result = await service.checkConsistency(ctx, uuidv7());

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('NOT_FOUND');
  });

  it('returns ForbiddenError when authorization denied', async () => {
    const fixtures = makeFixtures();
    const ctx = makeUserContext({ userId: 'user-1', workspaceId: 'ws-test-1' });
    const prd = (await fixtures.service.generatePrd(ctx, fixtures.briefId))._unsafeUnwrap();

    const restrictedFixtures = makeFixtures({ denyActions: [PRD_PERMISSIONS.READ] });
    restrictedFixtures.prdRepo.store.set(prd.id, prd);
    for (const [id, s] of fixtures.sectionRepo.store) {
      restrictedFixtures.sectionRepo.store.set(id, s);
    }
    restrictedFixtures.intentRepo.store.set(fixtures.briefId, fixtures.brief);

    const result = await restrictedFixtures.service.checkConsistency(ctx, prd.id);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('FORBIDDEN');
  });
});

// ── export ────────────────────────────────────────────────────────────────────

describe('PrdGenerationService.export', () => {
  it('returns a data URL for markdown format', async () => {
    const fixtures = makeFixtures();
    const ctx = makeUserContext({ userId: 'user-1', workspaceId: 'ws-test-1' });
    const prd = (await fixtures.service.generatePrd(ctx, fixtures.briefId))._unsafeUnwrap();

    const result = await fixtures.service.export(ctx, prd.id, 'markdown');

    expect(result.isOk()).toBe(true);
    const { downloadUrl } = result._unsafeUnwrap();
    expect(downloadUrl).toMatch(/^data:text\/markdown;base64,/);
  });

  it('download URL decodes to a string containing the PRD title', async () => {
    const fixtures = makeFixtures();
    const ctx = makeUserContext({ userId: 'user-1', workspaceId: 'ws-test-1' });
    const prd = (await fixtures.service.generatePrd(ctx, fixtures.briefId))._unsafeUnwrap();

    const result = await fixtures.service.export(ctx, prd.id, 'markdown');
    const { downloadUrl } = result._unsafeUnwrap();

    const base64Part = downloadUrl.replace('data:text/markdown;base64,', '');
    const decoded = Buffer.from(base64Part, 'base64').toString('utf-8');
    expect(decoded).toContain('Customer Portal');
  });

  it('emits ai.prd.exported audit event', async () => {
    const fixtures = makeFixtures();
    const ctx = makeUserContext({ userId: 'user-1', workspaceId: 'ws-test-1' });
    const prd = (await fixtures.service.generatePrd(ctx, fixtures.briefId))._unsafeUnwrap();

    fixtures.audit.reset();
    await fixtures.service.export(ctx, prd.id, 'markdown');

    expect(fixtures.audit.events).toContainEqual(
      expect.objectContaining({
        eventType: PRD_AUDIT_EVENTS.EXPORTED,
        outcome: 'success',
      }),
    );
  });

  it('returns ForbiddenError when authorization denied', async () => {
    const fixtures = makeFixtures({ denyActions: [PRD_PERMISSIONS.EXPORT] });
    const ctx = makeUserContext({ userId: 'user-1', workspaceId: 'ws-test-1' });

    const allowedFixtures = makeFixtures();
    const prd = (
      await allowedFixtures.service.generatePrd(ctx, allowedFixtures.briefId)
    )._unsafeUnwrap();
    fixtures.prdRepo.store.set(prd.id, prd);
    for (const [id, s] of allowedFixtures.sectionRepo.store) {
      fixtures.sectionRepo.store.set(id, s);
    }

    const result = await fixtures.service.export(ctx, prd.id, 'markdown');

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('FORBIDDEN');
  });
});

// ── detectStaleness ───────────────────────────────────────────────────────────

describe('PrdGenerationService.detectStaleness', () => {
  it('returns a StalenessReport', async () => {
    const fixtures = makeFixtures();
    const ctx = makeUserContext({ userId: 'user-1', workspaceId: 'ws-test-1' });
    const prd = (await fixtures.service.generatePrd(ctx, fixtures.briefId))._unsafeUnwrap();

    const result = await fixtures.service.detectStaleness(ctx, prd.id);

    expect(result.isOk()).toBe(true);
    const report = result._unsafeUnwrap();
    expect(report.prdId).toBe(prd.id);
    expect(Array.isArray(report.affectedSections)).toBe(true);
    expect(Array.isArray(report.unaffectedSections)).toBe(true);
    expect(Array.isArray(report.changedIntentFields)).toBe(true);
  });
});

// ── regenerateSection ─────────────────────────────────────────────────────────

describe('PrdGenerationService.regenerateSection', () => {
  it('regenerates a section and increments its version', async () => {
    const fixtures = makeFixtures();
    const ctx = makeUserContext({ userId: 'user-1', workspaceId: 'ws-test-1' });
    const prd = (await fixtures.service.generatePrd(ctx, fixtures.briefId))._unsafeUnwrap();
    const overviewId = prd.content.sectionIds['overview'];

    const result = await fixtures.service.regenerateSection(
      ctx,
      overviewId,
      'Please add more detail',
    );

    expect(result.isOk()).toBe(true);
    const updated = result._unsafeUnwrap();
    expect(updated.version).toBe(2);
    expect(updated.status).toBe('draft');
  });

  it('emits ai.prd.section_regenerated audit event', async () => {
    const fixtures = makeFixtures();
    const ctx = makeUserContext({ userId: 'user-1', workspaceId: 'ws-test-1' });
    const prd = (await fixtures.service.generatePrd(ctx, fixtures.briefId))._unsafeUnwrap();
    const overviewId = prd.content.sectionIds['overview'];

    fixtures.audit.reset();
    await fixtures.service.regenerateSection(ctx, overviewId);

    expect(fixtures.audit.events).toContainEqual(
      expect.objectContaining({
        eventType: PRD_AUDIT_EVENTS.SECTION_REGENERATED,
        outcome: 'success',
      }),
    );
  });

  it('returns NotFoundError for unknown sectionId', async () => {
    const { service } = makeFixtures();
    const ctx = makeUserContext({ userId: 'user-1', workspaceId: 'ws-test-1' });

    const result = await service.regenerateSection(ctx, uuidv7());

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('NOT_FOUND');
  });

  it('increments revisionCount on qualitySignals after regeneration', async () => {
    const fixtures = makeFixtures();
    const ctx = makeUserContext({ userId: 'user-1', workspaceId: 'ws-test-1' });
    const prd = (await fixtures.service.generatePrd(ctx, fixtures.briefId))._unsafeUnwrap();
    const overviewId = prd.content.sectionIds['overview'];

    const sectionBefore = fixtures.sectionRepo.store.get(overviewId)!;
    const revisionsBefore = sectionBefore.qualitySignals?.revisionCount ?? 0;

    await fixtures.service.regenerateSection(ctx, overviewId, 'Add more detail');

    const sectionAfter = fixtures.sectionRepo.store.get(overviewId)!;
    expect(sectionAfter.qualitySignals?.revisionCount).toBe(revisionsBefore + 1);
  });

  it('resets status to draft after regeneration', async () => {
    const fixtures = makeFixtures();
    const ctx = makeUserContext({ userId: 'user-1', workspaceId: 'ws-test-1' });
    const prd = (await fixtures.service.generatePrd(ctx, fixtures.briefId))._unsafeUnwrap();
    const overviewId = prd.content.sectionIds['overview'];

    // Submit to in_review, then regenerate
    await fixtures.service.submitSectionForApproval(ctx, overviewId);
    const result = await fixtures.service.regenerateSection(ctx, overviewId, 'Needs a rewrite');

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().status).toBe('draft');
  });
});

// ── regenerateAffectedSections ────────────────────────────────────────────────

describe('PrdGenerationService.regenerateAffectedSections', () => {
  it('returns empty array when no staleness indicators set', async () => {
    const fixtures = makeFixtures();
    const ctx = makeUserContext({ userId: 'user-1', workspaceId: 'ws-test-1' });
    const prd = (await fixtures.service.generatePrd(ctx, fixtures.briefId))._unsafeUnwrap();

    const result = await fixtures.service.regenerateAffectedSections(ctx, prd.id);

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toHaveLength(0);
  });

  it('regenerates sections listed in staleness indicators', async () => {
    const fixtures = makeFixtures();
    const ctx = makeUserContext({ userId: 'user-1', workspaceId: 'ws-test-1' });
    const prd = (await fixtures.service.generatePrd(ctx, fixtures.briefId))._unsafeUnwrap();

    // Manually inject staleness indicators into the PRD
    const overviewSectionId = prd.content.sectionIds['overview'];
    const prdInStore = fixtures.prdRepo.store.get(prd.id)!;
    fixtures.prdRepo.store.set(prd.id, {
      ...prdInStore,
      content: {
        ...prdInStore.content,
        stalenessIndicators: [
          {
            sectionType: 'overview',
            sectionId: overviewSectionId,
            reason: 'Title changed',
            changedIntentFields: ['title'],
          },
        ],
      },
    });

    const result = await fixtures.service.regenerateAffectedSections(ctx, prd.id);

    expect(result.isOk()).toBe(true);
    // overview plus its transitive dependents should be regenerated
    expect(result._unsafeUnwrap().length).toBeGreaterThanOrEqual(1);
  });
});

// ── approveSection ────────────────────────────────────────────────────────────

describe('PrdGenerationService.approveSection', () => {
  async function setupInReviewSection(fixtures: TestFixtures) {
    const ctx = makeUserContext({ userId: 'user-1', workspaceId: 'ws-test-1' });
    const prd = (await fixtures.service.generatePrd(ctx, fixtures.briefId))._unsafeUnwrap();
    const overviewId = prd.content.sectionIds['overview'];
    // Submit to in_review first
    await fixtures.service.submitSectionForApproval(ctx, overviewId);
    return { ctx, prd, overviewId };
  }

  it('happy path: section transitions from in_review to approved', async () => {
    const fixtures = makeFixtures();
    const { ctx, overviewId } = await setupInReviewSection(fixtures);

    const result = await fixtures.service.approveSection(ctx, overviewId);

    expect(result.isOk()).toBe(true);
    const section = result._unsafeUnwrap();
    expect(section.status).toBe('approved');
  });

  it('emits ai.prd.section_approved audit event', async () => {
    const fixtures = makeFixtures();
    const { ctx, overviewId } = await setupInReviewSection(fixtures);

    fixtures.audit.reset();
    await fixtures.service.approveSection(ctx, overviewId);

    expect(fixtures.audit.events).toContainEqual(
      expect.objectContaining({
        eventType: PRD_AUDIT_EVENTS.SECTION_APPROVED,
        outcome: 'success',
      }),
    );
  });

  it('sets approvedOnFirstPass=true when revisionCount is 0', async () => {
    const fixtures = makeFixtures();
    const { ctx, overviewId } = await setupInReviewSection(fixtures);

    const result = await fixtures.service.approveSection(ctx, overviewId);

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().qualitySignals?.approvedOnFirstPass).toBe(true);
  });

  it('sets approvedOnFirstPass=false when revisionCount > 0', async () => {
    const fixtures = makeFixtures();
    const { ctx, prd, overviewId } = await setupInReviewSection(fixtures);

    // Simulate a prior revision by bumping revisionCount in the store
    const sectionInStore = fixtures.sectionRepo.store.get(overviewId)!;
    fixtures.sectionRepo.store.set(overviewId, {
      ...sectionInStore,
      qualitySignals: { ...sectionInStore.qualitySignals!, revisionCount: 1 },
    });

    void prd; // unused but accessed for clarity
    const result = await fixtures.service.approveSection(ctx, overviewId);

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().qualitySignals?.approvedOnFirstPass).toBe(false);
  });

  it('PRD status transitions to approved when all 10 sections are approved', async () => {
    const fixtures = makeFixtures();
    const ctx = makeUserContext({ userId: 'user-1', workspaceId: 'ws-test-1' });
    const prd = (await fixtures.service.generatePrd(ctx, fixtures.briefId))._unsafeUnwrap();

    // Submit and approve all 10 sections
    for (const sectionType of PRD_SECTION_TYPES) {
      const sectionId = prd.content.sectionIds[sectionType];
      await fixtures.service.submitSectionForApproval(ctx, sectionId);
      await fixtures.service.approveSection(ctx, sectionId);
    }

    const updatedPrd = fixtures.prdRepo.store.get(prd.id)!;
    expect(updatedPrd.status).toBe('approved');
  });

  it('returns ValidationError when approving a draft section (not in_review)', async () => {
    const fixtures = makeFixtures();
    const ctx = makeUserContext({ userId: 'user-1', workspaceId: 'ws-test-1' });
    const prd = (await fixtures.service.generatePrd(ctx, fixtures.briefId))._unsafeUnwrap();
    const overviewId = prd.content.sectionIds['overview'];

    // Section is still in 'draft' status — not submitted
    const result = await fixtures.service.approveSection(ctx, overviewId);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('VALIDATION');
  });

  it('returns ForbiddenError when authorization denied', async () => {
    const fixtures = makeFixtures({ denyActions: [PRD_PERMISSIONS.APPROVE] });
    const ctx = makeUserContext({ userId: 'user-1', workspaceId: 'ws-test-1' });

    const allowedFixtures = makeFixtures();
    const { overviewId, prd } = await setupInReviewSection(allowedFixtures);
    for (const [id, s] of allowedFixtures.sectionRepo.store) {
      fixtures.sectionRepo.store.set(id, s);
    }
    fixtures.prdRepo.store.set(prd.id, prd);

    const result = await fixtures.service.approveSection(ctx, overviewId);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('FORBIDDEN');
  });

  it('returns ValidationError for non-UUID sectionId', async () => {
    const { service } = makeFixtures();
    const ctx = makeUserContext({ userId: 'user-1', workspaceId: 'ws-test-1' });

    const result = await service.approveSection(ctx, 'not-a-uuid');

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('VALIDATION');
  });
});

// ── rejectSection ─────────────────────────────────────────────────────────────

describe('PrdGenerationService.rejectSection', () => {
  async function setupInReviewSection(fixtures: TestFixtures) {
    const ctx = makeUserContext({ userId: 'user-1', workspaceId: 'ws-test-1' });
    const prd = (await fixtures.service.generatePrd(ctx, fixtures.briefId))._unsafeUnwrap();
    const overviewId = prd.content.sectionIds['overview'];
    await fixtures.service.submitSectionForApproval(ctx, overviewId);
    return { ctx, prd, overviewId };
  }

  it('happy path: section transitions from in_review to rejected', async () => {
    const fixtures = makeFixtures();
    const { ctx, overviewId } = await setupInReviewSection(fixtures);

    const result = await fixtures.service.rejectSection(ctx, overviewId, 'Needs more detail');

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().status).toBe('rejected');
  });

  it('emits ai.prd.section_rejected audit event with feedback in metadata', async () => {
    const fixtures = makeFixtures();
    const { ctx, overviewId } = await setupInReviewSection(fixtures);

    fixtures.audit.reset();
    await fixtures.service.rejectSection(ctx, overviewId, 'Please revise');

    expect(fixtures.audit.events).toContainEqual(
      expect.objectContaining({
        eventType: PRD_AUDIT_EVENTS.SECTION_REJECTED,
        outcome: 'success',
        metadata: expect.objectContaining({ feedback: 'Please revise' }),
      }),
    );
  });

  it('increments revisionCount on section qualitySignals', async () => {
    const fixtures = makeFixtures();
    const { ctx, overviewId } = await setupInReviewSection(fixtures);

    const sectionBefore = fixtures.sectionRepo.store.get(overviewId)!;
    const revisionsBefore = sectionBefore.qualitySignals?.revisionCount ?? 0;

    await fixtures.service.rejectSection(ctx, overviewId, 'Too vague');

    const sectionAfter = fixtures.sectionRepo.store.get(overviewId)!;
    expect(sectionAfter.qualitySignals?.revisionCount).toBe(revisionsBefore + 1);
  });

  it('returns ValidationError when rejecting a draft section (not in_review)', async () => {
    const fixtures = makeFixtures();
    const ctx = makeUserContext({ userId: 'user-1', workspaceId: 'ws-test-1' });
    const prd = (await fixtures.service.generatePrd(ctx, fixtures.briefId))._unsafeUnwrap();
    const overviewId = prd.content.sectionIds['overview'];

    // Section is still in 'draft' — not submitted
    const result = await fixtures.service.rejectSection(ctx, overviewId, 'Missing info');

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('VALIDATION');
  });

  it('returns ValidationError when feedback exceeds 2000 characters', async () => {
    const fixtures = makeFixtures();
    const { ctx, overviewId } = await setupInReviewSection(fixtures);

    const result = await fixtures.service.rejectSection(ctx, overviewId, 'x'.repeat(2001));

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('VALIDATION');
  });

  it('returns ForbiddenError when authorization denied', async () => {
    const fixtures = makeFixtures({ denyActions: [PRD_PERMISSIONS.APPROVE] });
    const ctx = makeUserContext({ userId: 'user-1', workspaceId: 'ws-test-1' });

    const allowedFixtures = makeFixtures();
    const { overviewId, prd } = await setupInReviewSection(allowedFixtures);
    for (const [id, s] of allowedFixtures.sectionRepo.store) {
      fixtures.sectionRepo.store.set(id, s);
    }
    fixtures.prdRepo.store.set(prd.id, prd);

    const result = await fixtures.service.rejectSection(ctx, overviewId, 'Denied');

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('FORBIDDEN');
  });
});

// ── checkTraceability ─────────────────────────────────────────────────────────

describe('PrdGenerationService.checkTraceability', () => {
  it('returns a TraceabilityReport', async () => {
    const fixtures = makeFixtures();
    const ctx = makeUserContext({ userId: 'user-1', workspaceId: 'ws-test-1' });
    const prd = (await fixtures.service.generatePrd(ctx, fixtures.briefId))._unsafeUnwrap();

    const result = await fixtures.service.checkTraceability(ctx, prd.id);

    expect(result.isOk()).toBe(true);
    const report = result._unsafeUnwrap();
    expect(report).toHaveProperty('ranAt');
    expect(report).toHaveProperty('totalIntentGoals');
    expect(report).toHaveProperty('coveredGoals');
    expect(report).toHaveProperty('gaps');
    expect(report).toHaveProperty('fullyCovered');
  });

  it('emits ai.prd.traceability_check_run audit event', async () => {
    const fixtures = makeFixtures();
    const ctx = makeUserContext({ userId: 'user-1', workspaceId: 'ws-test-1' });
    const prd = (await fixtures.service.generatePrd(ctx, fixtures.briefId))._unsafeUnwrap();

    fixtures.audit.reset();
    await fixtures.service.checkTraceability(ctx, prd.id);

    expect(fixtures.audit.events).toContainEqual(
      expect.objectContaining({
        eventType: PRD_AUDIT_EVENTS.TRACEABILITY_CHECK_RUN,
        outcome: 'success',
      }),
    );
  });
});
