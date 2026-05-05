/**
 * Cross-workspace isolation tests for the Storage module.
 *
 * Verifies that one workspace's files, buckets, and quota cannot be accessed
 * or leaked into another workspace, even with valid credentials for workspace A.
 *
 * All tests use in-memory adapters — no real storage backend required.
 */
import { StorageService } from '@platform/core';
import {
  createInMemoryAudit,
  createInMemoryAuthz,
  createInMemoryLogger,
  createInMemoryObjectStorage,
  createInMemoryRepo,
  makeUserContext,
} from '@platform/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';

function makeService() {
  return new StorageService(
    createInMemoryAuthz(),
    createInMemoryObjectStorage(),
    createInMemoryRepo(),
    createInMemoryRepo(),
    createInMemoryRepo(),
    createInMemoryRepo(),
    createInMemoryRepo(),
    createInMemoryAudit(),
    createInMemoryLogger(),
  );
}

const WS_A = '00000000-0000-0000-0000-000000000001';
const WS_B = '00000000-0000-0000-0000-000000000002';

describe('cross-workspace storage isolation', () => {
  let service: StorageService;

  beforeEach(() => {
    service = makeService();
  });

  it('listBuckets returns only the requesting workspace buckets', async () => {
    const ctxA = makeUserContext({ workspaceId: WS_A });
    const ctxB = makeUserContext({ workspaceId: WS_B });

    await service.createBucket(ctxA, { name: 'Workspace A Bucket', slug: 'ws-a-bucket' });
    await service.createBucket(ctxB, { name: 'Workspace B Bucket', slug: 'ws-b-bucket' });

    const resultA = await service.listBuckets(ctxA);
    expect(resultA.isOk()).toBe(true);
    const bucketsA = resultA._unsafeUnwrap();
    expect(bucketsA.every((b) => b.workspaceId === WS_A)).toBe(true);
    expect(bucketsA.find((b) => b.workspaceId === WS_B)).toBeUndefined();
  });

  it('listFiles does not return files from a different workspace', async () => {
    const ctxA = makeUserContext({ workspaceId: WS_A });
    const ctxB = makeUserContext({ workspaceId: WS_B });

    // Create a bucket in workspace A and upload a file
    const bucketAResult = await service.createBucket(ctxA, { name: 'A Files', slug: 'a-files' });
    const bucketA = bucketAResult._unsafeUnwrap();

    await service.uploadFile(
      ctxA,
      { bucketId: bucketA.id, filename: 'secret-a.txt', sizeBytes: 100, folderPath: '' },
      Buffer.from('workspace A secret'),
    );

    // Workspace B asks for all files — should get nothing from workspace A
    const resultB = await service.listFiles(ctxB, {});
    expect(resultB.isOk()).toBe(true);
    const filesB = resultB._unsafeUnwrap();
    const leakedFile = filesB.items.find((f) => f.filename === 'secret-a.txt');
    expect(leakedFile).toBeUndefined();
  });

  it('getBucket from workspace A cannot be accessed by workspace B context', async () => {
    const ctxA = makeUserContext({ workspaceId: WS_A });
    const ctxB = makeUserContext({ workspaceId: WS_B });

    const bucketAResult = await service.createBucket(ctxA, { name: 'Private', slug: 'private' });
    const bucketA = bucketAResult._unsafeUnwrap();

    // Workspace B tries to get workspace A's bucket by ID
    const resultB = await service.getBucket(ctxB, bucketA.id);

    // Must either fail (NOT_FOUND or FORBIDDEN) or succeed but return null-equivalent.
    // Under the in-memory authz (allow-all) the service still filters by workspaceId.
    if (resultB.isOk()) {
      // If it returns ok, the bucket must belong to workspace B (it shouldn't)
      expect(resultB.value.workspaceId).not.toBe(WS_A);
    } else {
      expect(['NOT_FOUND', 'FORBIDDEN', 'WORKSPACE_CONTEXT_REQUIRED']).toContain(
        resultB.error.code,
      );
    }
  });

  it('getQuota is workspace-scoped and does not reveal workspace B quota', async () => {
    const ctxA = makeUserContext({ workspaceId: WS_A });
    const ctxB = makeUserContext({ workspaceId: WS_B });

    // Upload something in workspace A to initialize quota
    const bucketAResult = await service.createBucket(ctxA, { name: 'A', slug: 'a' });
    const bucketA = bucketAResult._unsafeUnwrap();
    await service.uploadFile(
      ctxA,
      { bucketId: bucketA.id, filename: 'file.txt', sizeBytes: 1024, folderPath: '' },
      Buffer.from('data'),
    );

    const quotaA = (await service.getQuota(ctxA))._unsafeUnwrap();
    const quotaB = (await service.getQuota(ctxB))._unsafeUnwrap();

    // Workspace B's quota record must be separate from workspace A's
    expect(quotaA.workspaceId).toBe(WS_A);
    expect(quotaB.workspaceId).toBe(WS_B);
    expect(quotaA.id).not.toBe(quotaB.id);
    // Workspace B usage must be 0 (nothing uploaded there)
    expect(quotaB.usedBytes).toBe(0);
  });

  it('deleteFile from workspace A cannot be invoked by workspace B context', async () => {
    const ctxA = makeUserContext({ workspaceId: WS_A });
    const ctxB = makeUserContext({ workspaceId: WS_B });

    const bucketAResult = await service.createBucket(ctxA, { name: 'A', slug: 'a' });
    const bucketA = bucketAResult._unsafeUnwrap();
    const uploadResult = await service.uploadFile(
      ctxA,
      { bucketId: bucketA.id, filename: 'precious.txt', sizeBytes: 42, folderPath: '' },
      Buffer.from('precious data'),
    );
    const fileId = uploadResult._unsafeUnwrap().id;

    // Workspace B tries to delete workspace A's file
    const deleteResult = await service.deleteFile(ctxB, fileId);

    // Must fail — either NOT_FOUND (can't see across workspace) or FORBIDDEN
    expect(deleteResult.isErr()).toBe(true);
    expect(['NOT_FOUND', 'FORBIDDEN', 'WORKSPACE_CONTEXT_REQUIRED']).toContain(
      deleteResult._unsafeUnwrapErr().code,
    );

    // File must still exist in workspace A
    const stillExists = await service.getFile(ctxA, fileId);
    expect(stillExists.isOk()).toBe(true);
  });
});
