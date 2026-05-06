import type {
  Artifact,
  ArtifactQualityRecord,
  ArtifactRepositoryPort,
  ArtifactVersion,
  CreateArtifactInput,
  PaginatedArtifacts,
  ListArtifactsOptions,
  RecordQualitySignalInput,
  ReasoningRecord,
  UpdateArtifactInput,
} from '@platform/ports-ai';
import type { Result } from 'neverthrow';

import { AiError } from '@platform/ports-ai';
import { err, ok } from 'neverthrow';
import { uuidv7 } from 'uuidv7';

export class InMemoryArtifactRepository implements ArtifactRepositoryPort {
  readonly store = new Map<string, Artifact>();
  readonly versions = new Map<string, ArtifactVersion[]>();
  readonly qualityRecords: ArtifactQualityRecord[] = [];

  create(input: CreateArtifactInput): Promise<Result<Artifact, AiError>> {
    const now = new Date();
    const artifact: Artifact = {
      id: uuidv7(),
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
    this.store.set(artifact.id, artifact);
    return Promise.resolve(ok(artifact));
  }

  findById(id: string, workspaceId: string): Promise<Result<Artifact | null, AiError>> {
    const artifact = this.store.get(id);
    if (!artifact || artifact.workspaceId !== workspaceId) {
      return Promise.resolve(ok(null));
    }
    return Promise.resolve(ok(artifact));
  }

  list(
    workspaceId: string,
    opts?: ListArtifactsOptions,
  ): Promise<Result<PaginatedArtifacts, AiError>> {
    let items = [...this.store.values()].filter((a) => a.workspaceId === workspaceId);
    if (opts?.stage) items = items.filter((a) => a.stage === opts.stage);
    if (opts?.status) items = items.filter((a) => a.status === opts.status);
    if (opts?.parentArtifactId) {
      const pid = opts.parentArtifactId;
      items = items.filter((a) => a.parentArtifactIds.includes(pid));
    }
    const total = items.length;
    const offset = opts?.offset ?? 0;
    const limit = opts?.limit ?? 50;
    return Promise.resolve(
      ok({ items: items.slice(offset, offset + limit), total, limit, offset }),
    );
  }

  update(
    id: string,
    workspaceId: string,
    _expectedVersion: number,
    changes: UpdateArtifactInput,
  ): Promise<Result<Artifact, AiError>> {
    const existing = this.store.get(id);
    if (!existing || existing.workspaceId !== workspaceId) {
      return Promise.resolve(err(new AiError('UNKNOWN', `Artifact not found: ${id}`)));
    }

    // Build updated object handling optional fields with exactOptionalPropertyTypes
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
    if (changes.approvedByUserId !== undefined) updated.approvedByUserId = changes.approvedByUserId;

    this.store.set(id, updated);
    return Promise.resolve(ok(updated));
  }

  archive(id: string, workspaceId: string): Promise<Result<void, AiError>> {
    const existing = this.store.get(id);
    if (existing && existing.workspaceId === workspaceId) {
      this.store.set(id, { ...existing, status: 'archived', archivedAt: new Date() });
    }
    return Promise.resolve(ok(undefined));
  }

  listVersions(
    artifactId: string,
    _workspaceId: string,
  ): Promise<Result<ArtifactVersion[], AiError>> {
    return Promise.resolve(ok(this.versions.get(artifactId) ?? []));
  }

  saveVersion(
    artifactId: string,
    version: number,
    content: Record<string, unknown>,
    reasoning: ReasoningRecord,
    changeSummary: string,
    editedByUserId: string | null,
  ): Promise<Result<ArtifactVersion, AiError>> {
    const artifactVersion: ArtifactVersion = {
      id: uuidv7(),
      artifactId,
      version,
      content,
      reasoning,
      changeSummary,
      editedByUserId,
      createdAt: new Date(),
    };
    const existing = this.versions.get(artifactId) ?? [];
    this.versions.set(artifactId, [...existing, artifactVersion]);
    return Promise.resolve(ok(artifactVersion));
  }

  recordQualitySignal(
    input: RecordQualitySignalInput,
  ): Promise<Result<ArtifactQualityRecord, AiError>> {
    const record: ArtifactQualityRecord = {
      id: uuidv7(),
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
    this.qualityRecords.push(record);
    return Promise.resolve(ok(record));
  }
}
