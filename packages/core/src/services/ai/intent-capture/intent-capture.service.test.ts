import type {
  Artifact,
  ArtifactRepositoryPort,
  CreateArtifactInput,
  UpdateArtifactInput,
} from '@platform/ports-ai-artifacts';

import { ok, err } from 'neverthrow';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { GenerationService } from '../generation.service.js';

import {
  createInMemoryAuthz,
  createInMemoryAudit,
  createInMemoryLogger,
  createInMemoryRepo,
  makeUserContext,
} from '../../../testing/index.js';
import { ArtifactService } from '../artifact.service.js';
import { StagePipelineService } from '../stage-pipeline.service.js';
import { IntentCaptureService } from './intent-capture.service.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeArtifact(overrides: Partial<Artifact> = {}): Artifact {
  return {
    id: 'artifact-1',
    workspaceId: 'ws-1',
    stage: 'intent_capture',
    type: 'intent_conversation',
    parentArtifactIds: [],
    childArtifactIds: [],
    status: 'draft',
    currentVersion: 1,
    content: {
      messages: [],
      briefDraft: {
        goals: [],
        targetUsers: [],
        successCriteria: [],
        inScope: [],
        outOfScope: [],
        constraints: [],
        assumptions: [],
        risks: [],
        references: [],
        fieldStates: {},
        completenessPercent: 0,
        readyToGenerate: false,
      },
      turnCount: 0,
      totalCostUsd: 0,
      lastActiveAt: new Date(),
    },
    reasoning: {
      rationale: '',
      alternativesConsidered: [],
      assumptions: [],
      uncertainties: [],
      sourceArtifactIds: [],
    },
    qualitySignals: {
      submissionCount: 0,
      rejectionCount: 0,
      approvedFirstSubmit: false,
      revisionCount: 0,
      editsAfterGeneration: 0,
      totalEditCharCount: 0,
    },
    createdByUserId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeArtifactRepo(): ArtifactRepositoryPort {
  const store = new Map<string, Artifact>();
  return {
    async create(input: CreateArtifactInput) {
      const artifact = makeArtifact({
        id: `artifact-${Date.now()}`,
        stage: input.stage,
        type: input.type,
        content: input.content,
        createdByUserId: input.createdByUserId,
      });
      store.set(artifact.id, artifact);
      return ok(artifact);
    },
    async findById(id: string) {
      return ok(store.get(id) ?? null);
    },
    async findMany() {
      return ok({ items: Array.from(store.values()), total: store.size, limit: 20, offset: 0 });
    },
    async findByParent() {
      return ok([]);
    },
    async update(input: UpdateArtifactInput) {
      const existing = store.get(input.id);
      if (!existing) return err({ code: 'not_found' as const, message: 'Not found' });
      if (existing.currentVersion !== input.expectedVersion)
        return err({ code: 'conflict' as const, message: 'Version mismatch' });
      const updated: Artifact = {
        ...existing,
        ...(input.content !== undefined && { content: input.content }),
        ...(input.status !== undefined && { status: input.status }),
        currentVersion: existing.currentVersion + 1,
        updatedAt: new Date(),
      };
      store.set(input.id, updated);
      return ok(updated);
    },
    async archive(id) {
      store.delete(id);
      return ok(undefined);
    },
    async recordQualitySignal() {
      return ok(undefined);
    },
    async recordUsage() {
      return ok(undefined);
    },
    async getUsageSummary() {
      return ok({
        workspaceId: 'ws-1',
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalToolUseTokens: 0,
        totalCostUsd: 0,
        byStage: {},
        byDay: [],
      });
    },
    async checkBudget() {
      return ok({
        withinBudget: true,
        monthlyLimitUsd: 100,
        usedThisMonthUsd: 0,
        remainingUsd: 100,
        percentUsed: 0,
        warning: false,
      });
    },
    async getCached() {
      return ok(null);
    },
    async setCached() {
      return ok(undefined);
    },
  };
}

function makeGenerationService(): GenerationService {
  return {
    generate: vi.fn().mockResolvedValue(
      ok({
        content:
          '{"brief":{"title":"Test","summary":"Test summary","goals":[{"id":"1","description":"Main goal","priority":"must_have","acceptanceCriteria":["Works"]}],"targetUsers":[{"id":"1","persona":"User","description":"Test user","needs":["Use it"],"painPoints":[]}],"successCriteria":[],"inScope":["Basic features"],"outOfScope":[],"constraints":[],"assumptions":[],"risks":[],"references":[]},"reasoning":"Generated from conversation","confidenceScore":0.8}',
        structuredOutput: {
          brief: {
            title: 'Test',
            summary: 'Test summary for testing purposes',
            goals: [
              {
                id: '1',
                description: 'Main goal',
                priority: 'must_have',
                acceptanceCriteria: ['Works'],
              },
            ],
            targetUsers: [
              {
                id: '1',
                persona: 'User',
                description: 'Test user',
                needs: ['Use it'],
                painPoints: [],
              },
            ],
            successCriteria: [],
            inScope: ['Basic features'],
            outOfScope: [],
            constraints: [],
            assumptions: [],
            risks: [],
            references: [],
          },
          reasoning: 'Generated from conversation',
          confidenceScore: 0.8,
        },
        usage: { inputTokens: 100, outputTokens: 200 },
        model: 'claude-opus-4-7',
        provider: 'anthropic',
        durationMs: 500,
        cached: false,
        costUsd: 0.02,
      }),
    ),
    async *generateStream() {
      yield { type: 'text_delta' as const, delta: 'Test response' };
      yield {
        type: 'done' as const,
        usage: { inputTokens: 100, outputTokens: 50 },
        stopReason: 'end_turn' as const,
      };
    },
  } as unknown as GenerationService;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('IntentCaptureService', () => {
  const ctx = makeUserContext({ workspaceId: 'ws-1', userId: 'user-1' });
  let artifactRepo: ArtifactRepositoryPort;
  let service: IntentCaptureService;
  let authz: ReturnType<typeof createInMemoryAuthz>;
  let audit: ReturnType<typeof createInMemoryAudit>;

  beforeEach(() => {
    authz = createInMemoryAuthz();
    audit = createInMemoryAudit();
    const logger = createInMemoryLogger();
    artifactRepo = makeArtifactRepo();

    const artifactService = new ArtifactService(authz, artifactRepo, audit, logger);
    const stagePipeline = new StagePipelineService(authz, artifactRepo, audit, logger);
    const generation = makeGenerationService();
    const templateRepo = createInMemoryRepo<{
      id: string;
      workspaceId: string | null;
      name: string;
      description: string;
      category: string;
      starterMessage: string;
      suggestedFocusAreas: string[];
      builtIn: boolean;
      createdByUserId: string | null;
      _version: number;
      _archivedAt: Date | null;
      _createdAt: Date;
      _updatedAt: Date;
    }>();

    service = new IntentCaptureService(
      authz,
      artifactService,
      generation,
      stagePipeline,
      templateRepo,
      audit,
      logger,
    );
  });

  describe('startConversation', () => {
    it('creates a new conversation artifact', async () => {
      const result = await service.startConversation(ctx, {});
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().type).toBe('intent_conversation');
      expect(result._unsafeUnwrap().stage).toBe('intent_capture');
    });

    it('emits conversation_started audit event', async () => {
      await service.startConversation(ctx, {});
      expect(
        audit.events.some((e) => e.eventType === 'ai.intent_capture.conversation_started'),
      ).toBe(true);
    });

    it('rejects if not authorized', async () => {
      const denyAuthz = createInMemoryAuthz({ deny: true });
      const artifactService = new ArtifactService(
        denyAuthz,
        artifactRepo,
        createInMemoryAudit(),
        createInMemoryLogger(),
      );
      const stagePipeline = new StagePipelineService(
        denyAuthz,
        artifactRepo,
        createInMemoryAudit(),
        createInMemoryLogger(),
      );
      const restrictedService = new IntentCaptureService(
        denyAuthz,
        artifactService,
        makeGenerationService(),
        stagePipeline,
        createInMemoryRepo(),
        createInMemoryAudit(),
        createInMemoryLogger(),
      );

      const result = await restrictedService.startConversation(ctx, {});
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('FORBIDDEN');
    });
  });

  describe('getBriefDraft', () => {
    it('returns empty brief draft for new conversation', async () => {
      const conv = await service.startConversation(ctx, {});
      const convId = conv._unsafeUnwrap().id;

      const draft = await service.getBriefDraft(ctx, convId);
      expect(draft.isOk()).toBe(true);
      expect(draft._unsafeUnwrap().goals).toEqual([]);
      expect(draft._unsafeUnwrap().completenessPercent).toBe(0);
    });
  });

  describe('generateBrief', () => {
    it('creates an intent_brief artifact', async () => {
      const conv = await service.startConversation(ctx, {});
      const convId = conv._unsafeUnwrap().id;

      const brief = await service.generateBrief(ctx, convId);
      expect(brief.isOk()).toBe(true);
      expect(brief._unsafeUnwrap().type).toBe('intent_brief');
    });

    it('emits brief_generated audit event', async () => {
      const conv = await service.startConversation(ctx, {});
      await service.generateBrief(ctx, conv._unsafeUnwrap().id);
      expect(audit.events.some((e) => e.eventType === 'ai.intent_capture.brief_generated')).toBe(
        true,
      );
    });
  });

  describe('editBrief', () => {
    it('updates brief content and emits audit event', async () => {
      const conv = await service.startConversation(ctx, {});
      const brief = await service.generateBrief(ctx, conv._unsafeUnwrap().id);
      const briefId = brief._unsafeUnwrap().id;

      const edited = await service.editBrief(ctx, briefId, { title: 'Updated Title' });
      expect(edited.isOk()).toBe(true);
      expect((edited._unsafeUnwrap().content as { title: string }).title).toBe('Updated Title');
      expect(audit.events.some((e) => e.eventType === 'ai.intent_capture.brief_edited')).toBe(true);
    });
  });

  describe('listConversations', () => {
    it('returns paginated conversations', async () => {
      await service.startConversation(ctx, {});
      await service.startConversation(ctx, {});

      const list = await service.listConversations(ctx);
      expect(list.isOk()).toBe(true);
      expect(list._unsafeUnwrap().items.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('listTemplates', () => {
    it('returns empty list when no templates exist', async () => {
      const result = await service.listTemplates(ctx);
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().items).toEqual([]);
    });
  });
});
