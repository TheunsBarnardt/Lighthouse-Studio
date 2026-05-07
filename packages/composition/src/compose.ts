import type {
  ArtifactRepositoryPort,
  ArtifactRepositoryError,
  CreateArtifactInput,
  UpdateArtifactInput,
  ArtifactFilter,
  PaginatedArtifacts,
  UsageQueryOptions,
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
  AIProviderError,
  GenerationEvent,
  GenerationRequest,
  GenerationResponse,
  HealthStatus,
  ModelInfo,
} from '@platform/ports-ai-provider';
import type { AICachePort, AICacheError, CachedResponse } from '@platform/ports-ai-provider';

import { EchoAiAdapter } from '@platform/adapter-ai-memory';
import { InMemoryAuditPort } from '@platform/adapter-audit-memory';
import { InMemoryEmailPort } from '@platform/adapter-communication-memory';
import { InMemorySecretStore } from '@platform/adapter-config-memory';
import { InMemoryEventBus } from '@platform/adapter-eventing-memory';
import { InMemoryIdentityProvider } from '@platform/adapter-identity-memory';
import { InMemoryJobQueue } from '@platform/adapter-jobs-memory';
import {
  NoopErrorReporter,
  NoopLogger,
  NoopMetrics,
  NoopTracer,
} from '@platform/adapter-observability-memory';
import { InMemoryRepository, InMemoryUnitOfWork } from '@platform/adapter-persistence-memory';
import { InMemoryRateLimiter } from '@platform/adapter-rate-limiter-memory';
import { InMemoryFullTextSearch } from '@platform/adapter-search-memory';
import { InMemoryObjectStorage } from '@platform/adapter-storage-memory';
import { err, ok, type Result } from 'neverthrow';
import { uuidv7 } from 'uuidv7';

import type { PlatformContainer } from './container.js';

// ── In-memory AI port stubs (for test/dev environments) ──────────────────────

class StubAIProvider implements AIProviderPort {
  readonly providerId = 'stub';

  listModels(): Promise<Result<ModelInfo[], AIProviderError>> {
    return Promise.resolve(ok([]));
  }

  generate(_req: GenerationRequest): Promise<Result<GenerationResponse, AIProviderError>> {
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

  countTokens(_text: string, _model: string): Promise<Result<number, AIProviderError>> {
    return Promise.resolve(ok(0));
  }

  healthCheck(): Promise<Result<HealthStatus, AIProviderError>> {
    return Promise.resolve(ok({ healthy: true, latencyMs: 0 }));
  }
}

class InMemoryAICache implements AICachePort {
  private store = new Map<
    string,
    { response: GenerationResponse; cachedAt: Date; hitCount: number; expiresAt: number }
  >();

  get(cacheKey: string): Promise<Result<CachedResponse | null, AICacheError>> {
    const entry = this.store.get(cacheKey);
    if (!entry || entry.expiresAt < Date.now()) return Promise.resolve(ok(null));
    entry.hitCount++;
    const cached: CachedResponse = {
      response: entry.response,
      cachedAt: entry.cachedAt,
      hitCount: entry.hitCount,
    };
    return Promise.resolve(ok(cached));
  }

  set(
    cacheKey: string,
    _workspaceId: string,
    _promptId: string,
    response: GenerationResponse,
    ttlSeconds = 3600,
  ): Promise<Result<void, AICacheError>> {
    this.store.set(cacheKey, {
      response,
      cachedAt: new Date(),
      hitCount: 0,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    return Promise.resolve(ok(undefined));
  }

  invalidate(cacheKey: string): Promise<Result<void, AICacheError>> {
    this.store.delete(cacheKey);
    return Promise.resolve(ok(undefined));
  }

  invalidateByPrompt(
    _promptId: string,
    _workspaceId?: string,
  ): Promise<Result<void, AICacheError>> {
    return Promise.resolve(ok(undefined));
  }
}

class InMemoryArtifactRepository implements ArtifactRepositoryPort {
  private artifacts = new Map<string, Artifact>();
  private usageRecords: AiUsageRecord[] = [];
  private cache = new Map<string, { value: unknown; expiresAt: number }>();

  create(input: CreateArtifactInput): Promise<Result<Artifact, ArtifactRepositoryError>> {
    const now = new Date();
    const artifact: Artifact = {
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
    this.artifacts.set(artifact.id, artifact);
    return Promise.resolve(ok(artifact));
  }

  findById(
    id: string,
    workspaceId: string,
  ): Promise<Result<Artifact | null, ArtifactRepositoryError>> {
    const artifact = this.artifacts.get(id);
    if (!artifact || artifact.workspaceId !== workspaceId || artifact.status === 'archived') {
      return Promise.resolve(ok(null));
    }
    return Promise.resolve(ok(artifact));
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
    parentArtifactId: string,
    workspaceId: string,
  ): Promise<Result<Artifact[], ArtifactRepositoryError>> {
    const items = Array.from(this.artifacts.values()).filter(
      (a) =>
        a.workspaceId === workspaceId &&
        a.status !== 'archived' &&
        a.parentArtifactIds.includes(parentArtifactId),
    );
    return Promise.resolve(ok(items));
  }

  update(input: UpdateArtifactInput): Promise<Result<Artifact, ArtifactRepositoryError>> {
    const artifact = this.artifacts.get(input.id);
    if (!artifact || artifact.workspaceId !== input.workspaceId) {
      return Promise.resolve(err({ code: 'not_found', message: 'Artifact not found' }));
    }
    if (artifact.currentVersion !== input.expectedVersion) {
      return Promise.resolve(err({ code: 'conflict', message: 'Version mismatch' }));
    }
    const updated: Artifact = {
      ...artifact,
      ...(input.content !== undefined && { content: input.content }),
      ...(input.reasoning !== undefined && {
        reasoning: { ...artifact.reasoning, ...input.reasoning },
      }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.approvalId !== undefined && { approvalId: input.approvalId }),
      ...(input.approvedAt !== undefined && { approvedAt: input.approvedAt }),
      ...(input.approvedByUserId !== undefined && { approvedByUserId: input.approvedByUserId }),
      currentVersion: artifact.currentVersion + 1,
      updatedAt: new Date(),
    };
    this.artifacts.set(input.id, updated);
    return Promise.resolve(ok(updated));
  }

  archive(id: string, workspaceId: string): Promise<Result<void, ArtifactRepositoryError>> {
    const artifact = this.artifacts.get(id);
    if (!artifact || artifact.workspaceId !== workspaceId) {
      return Promise.resolve(err({ code: 'not_found', message: 'Artifact not found' }));
    }
    this.artifacts.set(id, { ...artifact, status: 'archived', updatedAt: new Date() });
    return Promise.resolve(ok(undefined));
  }

  recordQualitySignal(
    _id: string,
    _workspaceId: string,
    _signal: QualitySignal,
  ): Promise<Result<void, ArtifactRepositoryError>> {
    return Promise.resolve(ok(undefined));
  }

  recordUsage(record: AiUsageRecord): Promise<Result<void, ArtifactRepositoryError>> {
    this.usageRecords.push(record);
    return Promise.resolve(ok(undefined));
  }

  getUsageSummary(
    workspaceId: string,
    _opts: UsageQueryOptions,
  ): Promise<Result<UsageSummary, ArtifactRepositoryError>> {
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

  checkBudget(
    _workspaceId: string,
    _stage: string,
    _estimatedTokens: number,
  ): Promise<Result<BudgetStatus, ArtifactRepositoryError>> {
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

  getCached(cacheKey: string): Promise<Result<unknown, ArtifactRepositoryError>> {
    const entry = this.cache.get(cacheKey);
    if (!entry || entry.expiresAt < Date.now()) return Promise.resolve(ok(null));
    return Promise.resolve(ok(entry.value));
  }

  setCached(
    cacheKey: string,
    _workspaceId: string,
    _promptId: string,
    value: unknown,
    ttlSeconds = 3600,
  ): Promise<Result<void, ArtifactRepositoryError>> {
    this.cache.set(cacheKey, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    return Promise.resolve(ok(undefined));
  }
}

// ── Composition ───────────────────────────────────────────────────────────────

export function composeMemory(): PlatformContainer {
  const repositories = new Map<string, InMemoryRepository<{ id: string }>>();

  return {
    persistence: {
      unitOfWork: new InMemoryUnitOfWork(),
      schemaIntrospection: null,
      schemaDdl: null,
      schemaMigration: null,
      query: null,
      repository: <TEntity extends { id: string }>(entityName: string) => {
        if (!repositories.has(entityName)) {
          repositories.set(entityName, new InMemoryRepository<TEntity>());
        }
        return repositories.get(entityName) as InMemoryRepository<TEntity>;
      },
      customerRepositoryProvider: null,
    },
    rateLimiter: new InMemoryRateLimiter(),
    identity: new InMemoryIdentityProvider(),
    userDirectory: null,
    session: null,
    storage: new InMemoryObjectStorage(),
    email: new InMemoryEmailPort(),
    eventBus: new InMemoryEventBus(),
    changeStream: null,
    fullTextSearch: new InMemoryFullTextSearch(),
    vectorStore: null,
    embeddings: null,
    ai: new EchoAiAdapter(),
    aiProvider: new StubAIProvider(),
    aiCache: new InMemoryAICache(),
    artifactRepo: new InMemoryArtifactRepository(),
    jobs: new InMemoryJobQueue(),
    scheduler: null,
    audit: new InMemoryAuditPort(),
    logger: new NoopLogger(),
    metrics: new NoopMetrics(),
    tracer: new NoopTracer(),
    errorReporter: new NoopErrorReporter(),
    secrets: new InMemorySecretStore(),
    featureFlags: null,
  };
}
