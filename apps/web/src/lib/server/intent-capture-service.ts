import type { IntentBriefTemplate } from '@platform/core';
import type {
  ArtifactRepositoryPort,
  ArtifactRepositoryError,
  CreateArtifactInput,
  UpdateArtifactInput,
  ArtifactFilter,
  PaginatedArtifacts,
} from '@platform/ports-ai-artifacts';
import type {
  Artifact,
  AiUsageRecord,
  BudgetStatus,
  QualitySignal,
  UsageSummary,
} from '@platform/ports-ai-artifacts';
import type {
  AIProviderPort,
  GenerationEvent,
  GenerationRequest,
  GenerationResponse,
  HealthStatus,
  ModelInfo,
} from '@platform/ports-ai-provider';

import {
  ArtifactService,
  CostTrackingService,
  GenerationService,
  IntentCaptureService,
  PromptService,
  StagePipelineService,
  ToolRegistry,
} from '@platform/core';
import {
  createInMemoryAudit,
  createInMemoryAuthz,
  createInMemoryLogger,
  createInMemoryRepo,
} from '@platform/core/testing';
import { ok, err, type Result } from 'neverthrow';
import { uuidv7 } from 'uuidv7';

// ── Stub AI provider (returns empty responses — replace with real provider) ────

class StubAIProvider implements AIProviderPort {
  readonly providerId = 'stub';
  listModels(): Promise<Result<ModelInfo[], never>> {
    return Promise.resolve(ok([]));
  }
  generate(_req: GenerationRequest): Promise<Result<GenerationResponse, never>> {
    return Promise.resolve(
      ok({
        content: '',
        model: 'stub',
        usage: { inputTokens: 0, outputTokens: 0 },
        stopReason: 'end_turn' as const,
        durationMs: 0,
      }),
    );
  }
  async *generateStream(_req: GenerationRequest): AsyncIterable<GenerationEvent> {
    await Promise.resolve();
    yield {
      type: 'done',
      usage: { inputTokens: 0, outputTokens: 0 },
      stopReason: 'end_turn',
      durationMs: 0,
    };
  }
  countTokens(): Promise<Result<number, never>> {
    return Promise.resolve(ok(0));
  }
  healthCheck(): Promise<Result<HealthStatus, never>> {
    return Promise.resolve(ok({ healthy: true, latencyMs: 0 }));
  }
}

// ── In-memory artifact repository ─────────────────────────────────────────────

class InMemoryArtifactRepository implements ArtifactRepositoryPort {
  private artifacts = new Map<string, Artifact>();
  private cache = new Map<string, { value: unknown; expiresAt: number }>();

  create(input: CreateArtifactInput): Promise<Result<Artifact, ArtifactRepositoryError>> {
    const now = new Date();
    const a: Artifact = {
      id: uuidv7(),
      workspaceId: input.workspaceId,
      stage: input.stage,
      type: input.type,
      parentArtifactIds: input.parentArtifactIds ?? [],
      childArtifactIds: [],
      status: 'draft',
      currentVersion: 1,
      content: input.content,
      reasoning: input.reasoning,
      qualitySignals: {
        submissionCount: 0,
        rejectionCount: 0,
        approvedFirstSubmit: false,
        revisionCount: 0,
        editsAfterGeneration: 0,
        totalEditCharCount: 0,
      },
      ...(input.generatedBy !== undefined && { generatedBy: input.generatedBy }),
      createdByUserId: input.createdByUserId,
      createdAt: now,
      updatedAt: now,
    };
    this.artifacts.set(a.id, a);
    return Promise.resolve(ok(a));
  }

  findById(
    id: string,
    workspaceId: string,
  ): Promise<Result<Artifact | null, ArtifactRepositoryError>> {
    const a = this.artifacts.get(id);
    return Promise.resolve(
      ok(!a || a.workspaceId !== workspaceId || a.status === 'archived' ? null : a),
    );
  }

  findMany(
    filter: ArtifactFilter,
    page?: { limit: number; offset: number },
  ): Promise<Result<PaginatedArtifacts, ArtifactRepositoryError>> {
    let items = Array.from(this.artifacts.values()).filter(
      (a) =>
        a.workspaceId === filter.workspaceId &&
        a.status !== 'archived' &&
        (!filter.stage || a.stage === filter.stage) &&
        (!filter.type || a.type === filter.type) &&
        (!filter.status ||
          (Array.isArray(filter.status)
            ? filter.status.includes(a.status)
            : a.status === filter.status)),
    );
    const total = items.length;
    if (page) items = items.slice(page.offset, page.offset + page.limit);
    return Promise.resolve(
      ok({ items, total, limit: page?.limit ?? total, offset: page?.offset ?? 0 }),
    );
  }

  findByParent(
    parentId: string,
    workspaceId: string,
  ): Promise<Result<Artifact[], ArtifactRepositoryError>> {
    return Promise.resolve(
      ok(
        Array.from(this.artifacts.values()).filter(
          (a) =>
            a.workspaceId === workspaceId &&
            a.status !== 'archived' &&
            a.parentArtifactIds.includes(parentId),
        ),
      ),
    );
  }

  update(input: UpdateArtifactInput): Promise<Result<Artifact, ArtifactRepositoryError>> {
    const a = this.artifacts.get(input.id);
    if (!a || a.workspaceId !== input.workspaceId)
      return Promise.resolve(err({ code: 'not_found' as const, message: 'Not found' }));
    if (a.currentVersion !== input.expectedVersion)
      return Promise.resolve(err({ code: 'conflict' as const, message: 'Version mismatch' }));
    const updated: Artifact = {
      ...a,
      ...(input.content !== undefined && { content: input.content }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.approvedAt !== undefined && { approvedAt: input.approvedAt }),
      ...(input.approvedByUserId !== undefined && { approvedByUserId: input.approvedByUserId }),
      currentVersion: a.currentVersion + 1,
      updatedAt: new Date(),
    };
    this.artifacts.set(input.id, updated);
    return Promise.resolve(ok(updated));
  }

  archive(id: string, workspaceId: string): Promise<Result<void, ArtifactRepositoryError>> {
    const a = this.artifacts.get(id);
    if (a && a.workspaceId === workspaceId)
      this.artifacts.set(id, { ...a, status: 'archived', updatedAt: new Date() });
    return Promise.resolve(ok(undefined));
  }

  recordQualitySignal(
    _id: string,
    _wid: string,
    _s: QualitySignal,
  ): Promise<Result<void, ArtifactRepositoryError>> {
    return Promise.resolve(ok(undefined));
  }
  recordUsage(_r: AiUsageRecord): Promise<Result<void, ArtifactRepositoryError>> {
    return Promise.resolve(ok(undefined));
  }
  getUsageSummary(workspaceId: string): Promise<Result<UsageSummary, ArtifactRepositoryError>> {
    return Promise.resolve(
      ok({
        workspaceId,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalToolUseTokens: 0,
        totalCostUsd: 0,
        byStage: {},
        byDay: [],
      }),
    );
  }
  checkBudget(): Promise<Result<BudgetStatus, ArtifactRepositoryError>> {
    return Promise.resolve(
      ok({
        withinBudget: true,
        monthlyLimitUsd: 100,
        usedThisMonthUsd: 0,
        remainingUsd: 100,
        percentUsed: 0,
        warning: false,
      }),
    );
  }
  getCached(k: string): Promise<Result<unknown, ArtifactRepositoryError>> {
    const e = this.cache.get(k);
    return Promise.resolve(ok(!e || e.expiresAt < Date.now() ? null : e.value));
  }
  setCached(
    k: string,
    _w: string,
    _p: string,
    v: unknown,
    ttl = 3600,
  ): Promise<Result<void, ArtifactRepositoryError>> {
    this.cache.set(k, { value: v, expiresAt: Date.now() + ttl * 1000 });
    return Promise.resolve(ok(undefined));
  }
}

// ── Service singleton ─────────────────────────────────────────────────────────

let _service: IntentCaptureService | null = null;

export function getIntentCaptureService(): IntentCaptureService {
  if (!_service) {
    const authz = createInMemoryAuthz();
    const audit = createInMemoryAudit();
    const logger = createInMemoryLogger();
    const artifactRepo = new InMemoryArtifactRepository();
    const templateRepo = createInMemoryRepo<IntentBriefTemplate>();

    const costTracking = new CostTrackingService(artifactRepo, logger);
    const promptService = new PromptService(authz, logger);
    const toolRegistry = new ToolRegistry();
    const artifactService = new ArtifactService(authz, artifactRepo, audit, logger);
    const stagePipeline = new StagePipelineService(authz, artifactRepo, audit, logger);

    const generation = new GenerationService(
      authz,
      [new StubAIProvider()],
      promptService,
      artifactRepo,
      costTracking,
      toolRegistry,
      audit,
      logger,
    );

    _service = new IntentCaptureService(
      authz,
      artifactService,
      generation,
      stagePipeline,
      templateRepo,
      audit,
      logger,
    );
  }
  return _service;
}
