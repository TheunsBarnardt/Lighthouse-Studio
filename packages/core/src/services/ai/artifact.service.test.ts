import { describe, expect, it, beforeEach } from 'vitest';

import {
  createInMemoryArtifactRepo,
  createInMemoryAudit,
  createInMemoryAuthz,
  createInMemoryLogger,
} from '../../testing/index.js';
import { ArtifactService } from './artifact.service.js';

const WORKSPACE_ID = '018f5c4e-0000-7000-0000-000000000001';
const USER_ID = '018f5c4e-0000-7000-0000-000000000002';

function makeCtx() {
  return {
    userId: USER_ID,
    workspaceId: WORKSPACE_ID,
    installationRoles: [] as const,
    correlationId: 'test-correlation',
    mfaSatisfied: false,
    _kind: 'user' as const,
  };
}

function makeGenerationRecord() {
  return {
    provider: 'memory',
    model: 'memory-echo-v1',
    promptId: 'test.prompt',
    promptVersion: '1.0.0',
    inputTokens: 100,
    outputTokens: 200,
    toolUseTokens: 0,
    costUsd: 0.001,
    durationMs: 500,
    cached: false,
  };
}

function makeReasoning() {
  return {
    rationale: 'Test rationale',
    alternatives_considered: [],
    assumptions: ['assumption 1'],
    uncertainties: [],
    source_artifacts: [],
  };
}

describe('ArtifactService', () => {
  let service: ArtifactService;
  let repo: ReturnType<typeof createInMemoryArtifactRepo>;

  beforeEach(() => {
    repo = createInMemoryArtifactRepo();
    const audit = createInMemoryAudit();
    const logger = createInMemoryLogger();
    const authz = createInMemoryAuthz();
    service = new ArtifactService(authz, repo, audit, logger);
  });

  it('creates an artifact with draft status', async () => {
    const ctx = makeCtx();
    const result = await service.create(ctx, {
      workspaceId: WORKSPACE_ID,
      stage: 'intent',
      type: 'intent_brief',
      parentArtifactIds: [],
      content: { title: 'Test project' },
      reasoning: makeReasoning(),
      generatedBy: makeGenerationRecord(),
      createdByUserId: USER_ID,
    });

    expect(result.isOk()).toBe(true);
    const artifact = result._unsafeUnwrap();
    expect(artifact.status).toBe('draft');
    expect(artifact.stage).toBe('intent');
    expect(artifact.workspaceId).toBe(WORKSPACE_ID);
    expect(artifact.reasoning.rationale).toBe('Test rationale');
  });

  it('retrieves a created artifact by id', async () => {
    const ctx = makeCtx();
    const created = (
      await service.create(ctx, {
        workspaceId: WORKSPACE_ID,
        stage: 'prd',
        type: 'prd_document',
        parentArtifactIds: [],
        content: {},
        reasoning: makeReasoning(),
        generatedBy: makeGenerationRecord(),
        createdByUserId: USER_ID,
      })
    )._unsafeUnwrap();

    const getResult = await service.get(ctx, created.id);
    expect(getResult.isOk()).toBe(true);
    expect(getResult._unsafeUnwrap().id).toBe(created.id);
  });

  it('returns NotFoundError for missing artifact', async () => {
    const ctx = makeCtx();
    const result = await service.get(ctx, '018f5c4e-0000-7000-0000-000000000099');
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('NOT_FOUND');
  });

  it('submits artifact for approval, changing status to awaiting_approval', async () => {
    const ctx = makeCtx();
    const artifact = (
      await service.create(ctx, {
        workspaceId: WORKSPACE_ID,
        stage: 'intent',
        type: 'intent_brief',
        parentArtifactIds: [],
        content: {},
        reasoning: makeReasoning(),
        generatedBy: makeGenerationRecord(),
        createdByUserId: USER_ID,
      })
    )._unsafeUnwrap();

    const submitted = await service.submitForApproval(ctx, artifact.id);
    expect(submitted.isOk()).toBe(true);
    expect(submitted._unsafeUnwrap().status).toBe('awaiting_approval');
  });

  it('approves an artifact, setting approvedAt and approvedByUserId', async () => {
    const ctx = makeCtx();
    const artifact = (
      await service.create(ctx, {
        workspaceId: WORKSPACE_ID,
        stage: 'intent',
        type: 'intent_brief',
        parentArtifactIds: [],
        content: {},
        reasoning: makeReasoning(),
        generatedBy: makeGenerationRecord(),
        createdByUserId: USER_ID,
      })
    )._unsafeUnwrap();

    await service.submitForApproval(ctx, artifact.id);
    const approved = await service.approve(ctx, artifact.id);
    expect(approved.isOk()).toBe(true);
    const a = approved._unsafeUnwrap();
    expect(a.status).toBe('approved');
    expect(a.approvedByUserId).toBe(USER_ID);
    expect(a.approvedAt).toBeInstanceOf(Date);
  });

  it('rejects an artifact with a reason', async () => {
    const ctx = makeCtx();
    const artifact = (
      await service.create(ctx, {
        workspaceId: WORKSPACE_ID,
        stage: 'intent',
        type: 'intent_brief',
        parentArtifactIds: [],
        content: {},
        reasoning: makeReasoning(),
        generatedBy: makeGenerationRecord(),
        createdByUserId: USER_ID,
      })
    )._unsafeUnwrap();

    const rejected = await service.reject(ctx, artifact.id, 'Goals were too vague');
    expect(rejected.isOk()).toBe(true);
    expect(rejected._unsafeUnwrap().status).toBe('rejected');
    expect(rejected._unsafeUnwrap().qualitySignals.rejectedWithFeedback).toBe(
      'Goals were too vague',
    );
  });

  it('lists artifacts by stage', async () => {
    const ctx = makeCtx();
    await service.create(ctx, {
      workspaceId: WORKSPACE_ID,
      stage: 'intent',
      type: 'intent_brief',
      parentArtifactIds: [],
      content: {},
      reasoning: makeReasoning(),
      generatedBy: makeGenerationRecord(),
      createdByUserId: null,
    });
    await service.create(ctx, {
      workspaceId: WORKSPACE_ID,
      stage: 'prd',
      type: 'prd_document',
      parentArtifactIds: [],
      content: {},
      reasoning: makeReasoning(),
      generatedBy: makeGenerationRecord(),
      createdByUserId: null,
    });

    const intentArtifacts = await service.listByStage(ctx, 'intent');
    expect(intentArtifacts.isOk()).toBe(true);
    expect(intentArtifacts._unsafeUnwrap()).toHaveLength(1);
    expect(intentArtifacts._unsafeUnwrap()[0]!.stage).toBe('intent');
  });
});
