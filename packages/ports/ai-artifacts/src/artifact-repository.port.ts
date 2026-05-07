import type { Result } from 'neverthrow';

import type {
  Artifact,
  AiUsageRecord,
  ArtifactStatus,
  BudgetStatus,
  QualitySignal,
  StageName,
  UsageSummary,
} from './types.js';

export interface ArtifactRepositoryError {
  code: 'not_found' | 'conflict' | 'validation' | 'persistence_error';
  message: string;
}

export interface CreateArtifactInput {
  workspaceId: string;
  stage: StageName;
  type: string;
  parentArtifactIds?: string[];
  content: unknown;
  reasoning: Artifact['reasoning'];
  generatedBy?: Artifact['generatedBy'];
  createdByUserId: string | null;
}

export interface UpdateArtifactInput {
  id: string;
  workspaceId: string;
  expectedVersion: number;
  content?: unknown;
  reasoning?: Partial<Artifact['reasoning']>;
  status?: ArtifactStatus;
  approvalId?: string;
  approvedAt?: Date;
  approvedByUserId?: string;
}

export interface ArtifactFilter {
  workspaceId: string;
  stage?: StageName;
  type?: string;
  status?: ArtifactStatus | ArtifactStatus[];
  parentArtifactId?: string;
  createdByUserId?: string;
}

export interface ArtifactPage {
  limit: number;
  offset: number;
}

export interface PaginatedArtifacts {
  items: Artifact[];
  total: number;
  limit: number;
  offset: number;
}

export interface UsageQueryOptions {
  startDate?: Date;
  endDate?: Date;
  stage?: string;
  groupByDay?: boolean;
}

export interface ArtifactRepositoryPort {
  create(input: CreateArtifactInput): Promise<Result<Artifact, ArtifactRepositoryError>>;

  findById(
    id: string,
    workspaceId: string,
  ): Promise<Result<Artifact | null, ArtifactRepositoryError>>;

  findMany(
    filter: ArtifactFilter,
    page?: ArtifactPage,
  ): Promise<Result<PaginatedArtifacts, ArtifactRepositoryError>>;

  findByParent(
    parentArtifactId: string,
    workspaceId: string,
  ): Promise<Result<Artifact[], ArtifactRepositoryError>>;

  update(input: UpdateArtifactInput): Promise<Result<Artifact, ArtifactRepositoryError>>;

  archive(id: string, workspaceId: string): Promise<Result<void, ArtifactRepositoryError>>;

  recordQualitySignal(
    id: string,
    workspaceId: string,
    signal: QualitySignal,
  ): Promise<Result<void, ArtifactRepositoryError>>;

  // Usage tracking
  recordUsage(record: AiUsageRecord): Promise<Result<void, ArtifactRepositoryError>>;

  getUsageSummary(
    workspaceId: string,
    opts: UsageQueryOptions,
  ): Promise<Result<UsageSummary, ArtifactRepositoryError>>;

  checkBudget(
    workspaceId: string,
    stage: string,
    estimatedTokens: number,
  ): Promise<Result<BudgetStatus, ArtifactRepositoryError>>;

  // Cache
  getCached(cacheKey: string): Promise<Result<unknown, ArtifactRepositoryError>>;

  setCached(
    cacheKey: string,
    workspaceId: string,
    promptId: string,
    value: unknown,
    ttlSeconds?: number,
  ): Promise<Result<void, ArtifactRepositoryError>>;
}
