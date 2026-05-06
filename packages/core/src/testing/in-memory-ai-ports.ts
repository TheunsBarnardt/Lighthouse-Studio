import type {
  AICachePort,
  AiUsageRecord,
  Artifact,
  ArtifactQualityRecord,
  ArtifactRepositoryPort,
  ArtifactVersion,
  BudgetStatus,
  CostTrackingPort,
  CreateArtifactInput,
  GenerationResponse,
  ListArtifactsOptions,
  PaginatedArtifacts,
  RecordQualitySignalInput,
  ReasoningRecord,
  StageName,
  UpdateArtifactInput,
  UsageQueryOptions,
  UsageSummary,
  WorkspaceAiConfig,
} from '@platform/ports-ai';

import { AiError } from '@platform/ports-ai';
import { ok, err, type Result } from 'neverthrow';

function nextId(): string {
  return `test-${String(Math.random()).slice(2)}`;
}

// ── ArtifactRepositoryPort ───────────────────────────────────────────────────

export function createInMemoryArtifactRepo(): ArtifactRepositoryPort & {
  store: Map<string, Artifact>;
  versions: Map<string, ArtifactVersion[]>;
  qualityRecords: ArtifactQualityRecord[];
} {
  const store = new Map<string, Artifact>();
  const versions = new Map<string, ArtifactVersion[]>();
  const qualityRecords: ArtifactQualityRecord[] = [];

  return {
    store,
    versions,
    qualityRecords,

    create(input: CreateArtifactInput): Promise<Result<Artifact, AiError>> {
      const now = new Date();
      const artifact: Artifact = {
        id: nextId(),
        version: 1,
        workspaceId: input.workspaceId,
        stage: input.stage,
        type: input.type,
        parentArtifactIds: input.parentArtifactIds,
        childArtifactIds: [],
        status: 'draft',
        currentVersion: 1,
        content: input.content,
        reasoning: input.reasoning,
        qualitySignals: { revisionCount: 0, causedDownstreamIssue: false },
        generatedBy: input.generatedBy,
        createdByUserId: input.createdByUserId,
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
        createdBy: input.createdByUserId,
        updatedBy: null,
      };
      store.set(artifact.id, artifact);
      return Promise.resolve(ok(artifact));
    },

    findById(id: string, workspaceId: string): Promise<Result<Artifact | null, AiError>> {
      const artifact = store.get(id);
      if (!artifact || artifact.workspaceId !== workspaceId) return Promise.resolve(ok(null));
      return Promise.resolve(ok(artifact));
    },

    list(
      workspaceId: string,
      opts?: ListArtifactsOptions,
    ): Promise<Result<PaginatedArtifacts, AiError>> {
      let items = [...store.values()].filter((a) => a.workspaceId === workspaceId);
      if (opts?.stage) items = items.filter((a) => a.stage === opts.stage);
      if (opts?.status) items = items.filter((a) => a.status === opts.status);
      if (opts?.parentArtifactId) {
        items = items.filter((a) => a.parentArtifactIds.includes(opts.parentArtifactId ?? ''));
      }
      const total = items.length;
      const offset = opts?.offset ?? 0;
      const limit = opts?.limit ?? 50;
      return Promise.resolve(
        ok({ items: items.slice(offset, offset + limit), total, limit, offset }),
      );
    },

    update(
      id: string,
      workspaceId: string,
      _expectedVersion: number,
      changes: UpdateArtifactInput,
    ): Promise<Result<Artifact, AiError>> {
      const existing = store.get(id);
      if (!existing || existing.workspaceId !== workspaceId) {
        return Promise.resolve(err(new AiError('UNKNOWN', `Artifact not found: ${id}`)));
      }
      const updated: Artifact = {
        ...existing,
        version: existing.version + 1,
        currentVersion: existing.currentVersion + (changes.content ? 1 : 0),
        status: changes.status ?? existing.status,
        content: changes.content ?? existing.content,
        reasoning: changes.reasoning ?? existing.reasoning,
        childArtifactIds: changes.childArtifactIds ?? existing.childArtifactIds,
        qualitySignals: changes.qualitySignals
          ? { ...existing.qualitySignals, ...changes.qualitySignals }
          : existing.qualitySignals,
        updatedAt: new Date(),
      };
      if (changes.approvalId !== undefined) updated.approvalId = changes.approvalId;
      if (changes.approvedAt !== undefined) updated.approvedAt = changes.approvedAt;
      if (changes.approvedByUserId !== undefined)
        updated.approvedByUserId = changes.approvedByUserId;
      store.set(id, updated);
      return Promise.resolve(ok(updated));
    },

    archive(id: string, workspaceId: string): Promise<Result<void, AiError>> {
      const existing = store.get(id);
      if (existing && existing.workspaceId === workspaceId) {
        store.set(id, { ...existing, status: 'archived', archivedAt: new Date() });
      }
      return Promise.resolve(ok(undefined));
    },

    listVersions(artifactId: string): Promise<Result<ArtifactVersion[], AiError>> {
      return Promise.resolve(ok(versions.get(artifactId) ?? []));
    },

    saveVersion(
      artifactId: string,
      version: number,
      content: Record<string, unknown>,
      reasoning: ReasoningRecord,
      changeSummary: string,
      editedByUserId: string | null,
    ): Promise<Result<ArtifactVersion, AiError>> {
      const artifactVersion: ArtifactVersion = {
        id: nextId(),
        artifactId,
        version,
        content,
        reasoning,
        changeSummary,
        editedByUserId,
        createdAt: new Date(),
      };
      const existing = versions.get(artifactId) ?? [];
      versions.set(artifactId, [...existing, artifactVersion]);
      return Promise.resolve(ok(artifactVersion));
    },

    recordQualitySignal(
      input: RecordQualitySignalInput,
    ): Promise<Result<ArtifactQualityRecord, AiError>> {
      const record: ArtifactQualityRecord = {
        id: nextId(),
        artifactId: input.artifactId,
        workspaceId: input.workspaceId,
        stage: input.stage,
        promptId: input.promptId,
        promptVersion: input.promptVersion,
        provider: input.provider,
        model: input.model,
        outcome: input.outcome,
        revisionCount: input.revisionCount,
        ...(input.editDistance !== undefined ? { editDistance: input.editDistance } : {}),
        ...(input.timeToApprovalSeconds !== undefined
          ? { timeToApprovalSeconds: input.timeToApprovalSeconds }
          : {}),
        ...(input.rejectedWithFeedback !== undefined
          ? { rejectedWithFeedback: input.rejectedWithFeedback }
          : {}),
        causedDownstreamIssue: input.causedDownstreamIssue,
        createdAt: new Date(),
      };
      qualityRecords.push(record);
      return Promise.resolve(ok(record));
    },
  };
}

// ── AICachePort ──────────────────────────────────────────────────────────────

export function createInMemoryAiCache(): AICachePort & { store: Map<string, GenerationResponse> } {
  const store = new Map<string, GenerationResponse>();

  return {
    store,

    get(key: string): Promise<Result<GenerationResponse | null, AiError>> {
      return Promise.resolve(ok(store.get(key) ?? null));
    },

    set(
      key: string,
      _promptId: string,
      _promptVersion: string,
      _provider: string,
      _model: string,
      response: GenerationResponse,
      _ttlSeconds?: number,
    ): Promise<Result<void, AiError>> {
      store.set(key, response);
      return Promise.resolve(ok(undefined));
    },

    invalidateByPrompt(
      _promptId: string,
      _promptVersion: string,
    ): Promise<Result<number, AiError>> {
      return Promise.resolve(ok(0));
    },

    purgeExpired(): Promise<Result<number, AiError>> {
      return Promise.resolve(ok(0));
    },
  };
}

// ── CostTrackingPort ─────────────────────────────────────────────────────────

export function createInMemoryCostTracking(): CostTrackingPort & {
  usageRecords: AiUsageRecord[];
} {
  const usageRecords: AiUsageRecord[] = [];
  const configs = new Map<string, WorkspaceAiConfig>();

  return {
    usageRecords,

    checkBudget(
      workspaceId: string,
      _stage: StageName,
      _estimatedTokens: number,
    ): Promise<Result<BudgetStatus, AiError>> {
      const config = configs.get(workspaceId);
      const budget = config?.monthlyBudgetUsd ?? 50;
      const used = usageRecords
        .filter((r) => r.workspaceId === workspaceId)
        .reduce((s, r) => s + r.costUsd, 0);
      const usedPct = (used / budget) * 100;
      if (usedPct >= 100)
        return Promise.resolve(ok({ withinBudget: false, reason: 'hard_limit', usedPct }));
      if (usedPct >= 80)
        return Promise.resolve(ok({ withinBudget: false, reason: 'soft_warning', usedPct }));
      return Promise.resolve(ok({ withinBudget: true, usedPct }));
    },

    recordUsage(
      record: Omit<AiUsageRecord, 'id' | 'createdAt'>,
    ): Promise<Result<AiUsageRecord, AiError>> {
      const full: AiUsageRecord = { ...record, id: nextId(), createdAt: new Date() };
      usageRecords.push(full);
      return Promise.resolve(ok(full));
    },

    getWorkspaceUsage(
      workspaceId: string,
      _opts?: UsageQueryOptions,
    ): Promise<Result<UsageSummary, AiError>> {
      const records = usageRecords.filter((r) => r.workspaceId === workspaceId);
      return Promise.resolve(
        ok({
          totalInputTokens: records.reduce((s, r) => s + r.inputTokens, 0),
          totalOutputTokens: records.reduce((s, r) => s + r.outputTokens, 0),
          totalToolUseTokens: records.reduce((s, r) => s + r.toolUseTokens, 0),
          totalCostUsd: records.reduce((s, r) => s + r.costUsd, 0),
        }),
      );
    },

    getConfig(workspaceId: string): Promise<Result<WorkspaceAiConfig | null, AiError>> {
      return Promise.resolve(ok(configs.get(workspaceId) ?? null));
    },

    saveConfig(config: WorkspaceAiConfig): Promise<Result<WorkspaceAiConfig, AiError>> {
      configs.set(config.workspaceId, config);
      return Promise.resolve(ok(config));
    },
  };
}
