import type { Result } from 'neverthrow';

import type { AiError } from './errors.js';
import type {
  Artifact,
  ArtifactOutcome,
  ArtifactQualityRecord,
  ArtifactStatus,
  ArtifactVersion,
  StageName,
} from './types.js';

export interface ListArtifactsOptions {
  stage?: StageName;
  status?: ArtifactStatus;
  parentArtifactId?: string;
  limit?: number;
  offset?: number;
}

export interface PaginatedArtifacts {
  items: Artifact[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreateArtifactInput {
  workspaceId: string;
  stage: StageName;
  type: string;
  parentArtifactIds: string[];
  content: Record<string, unknown>;
  reasoning: Artifact['reasoning'];
  generatedBy: Artifact['generatedBy'];
  createdByUserId: string | null;
}

export interface UpdateArtifactInput {
  content?: Record<string, unknown>;
  reasoning?: Artifact['reasoning'];
  status?: ArtifactStatus;
  approvalId?: string;
  approvedAt?: Date;
  approvedByUserId?: string;
  childArtifactIds?: string[];
  qualitySignals?: Partial<Artifact['qualitySignals']>;
}

export interface RecordQualitySignalInput {
  artifactId: string;
  workspaceId: string;
  stage: StageName;
  promptId: string;
  promptVersion: string;
  provider: string;
  model: string;
  outcome: ArtifactOutcome;
  revisionCount: number;
  editDistance?: number;
  timeToApprovalSeconds?: number;
  rejectedWithFeedback?: string;
  causedDownstreamIssue: boolean;
}

export interface ArtifactRepositoryPort {
  create(input: CreateArtifactInput): Promise<Result<Artifact, AiError>>;

  findById(id: string, workspaceId: string): Promise<Result<Artifact | null, AiError>>;

  list(
    workspaceId: string,
    opts?: ListArtifactsOptions,
  ): Promise<Result<PaginatedArtifacts, AiError>>;

  update(
    id: string,
    workspaceId: string,
    expectedVersion: number,
    changes: UpdateArtifactInput,
  ): Promise<Result<Artifact, AiError>>;

  archive(id: string, workspaceId: string): Promise<Result<void, AiError>>;

  listVersions(
    artifactId: string,
    workspaceId: string,
  ): Promise<Result<ArtifactVersion[], AiError>>;

  saveVersion(
    artifactId: string,
    version: number,
    content: Record<string, unknown>,
    reasoning: Artifact['reasoning'],
    changeSummary: string,
    editedByUserId: string | null,
  ): Promise<Result<ArtifactVersion, AiError>>;

  recordQualitySignal(
    input: RecordQualitySignalInput,
  ): Promise<Result<ArtifactQualityRecord, AiError>>;
}
